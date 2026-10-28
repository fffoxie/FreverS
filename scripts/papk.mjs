// Create PAPK: patch the original APK so it talks to this FreverS server.
//
// usage: node scripts/papk.mjs [--url http://<ip>:<port>/] [--apk <path>]
// Steps are logged to data/logs/papk.log and data/papk-status.json. The first
// failing step stops the run and no APK is written to output/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { patchMetadata } from './patch-metadata.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const analysisDir = path.join(root, 'analysis');
const workDir = path.join(analysisDir, 'papk-work');
const outDir = path.join(root, 'output');
const logFile = path.join(root, 'data', 'logs', 'papk.log');
const statusFile = path.join(root, 'data', 'papk-status.json');
const keyDir = process.env.FREVERS_KEY_DIR || path.join(os.homedir(), '.frevers');
const ORIGINAL_MD5 = 'c53f40eb25c8738538981ac923871917';
const OUTPUT_NAME = 'Frever_4.0.5_FreverS.apk';

export function lanUrl(port = process.env.FREVERS_PORT || process.env.PORT || 8080) {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family === 'IPv4' && !i.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)) {
        return `http://${i.address}:${port}/`;
      }
    }
  }
  return `http://127.0.0.1:${port}/`;
}

function which(cmd) {
  for (const d of (process.env.PATH || '').split(path.delimiter)) {
    const p = path.join(d, cmd);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.error) throw new Error(`${cmd}: ${r.error.message}`);
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}: ${out.split('\n').slice(-8).join(' | ')}`);
  return out;
}

function md5(file) {
  const hash = crypto.createHash('md5');
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(1 << 20);
  let n;
  while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  fs.closeSync(fd);
  return hash.digest('hex');
}

export function isAllowedPath(filePath) {
  const resolved = path.resolve(filePath);
  const home = os.homedir();
  const tmp = os.tmpdir();
  const allowedPrefixes = [
    root,
    home,
    tmp,
    '/storage',
    '/sdcard',
    '/data/data/com.termux'
  ];
  return allowedPrefixes.some((p) => resolved.startsWith(p));
}

export function findApkCandidates() {
  const candidates = [];
  const home = os.homedir();
  const searchDirs = [
    analysisDir,
    path.join(home, 'storage', 'downloads'),
    path.join(home, 'storage', 'shared', 'Download'),
    '/storage/emulated/0/Download',
    '/sdcard/Download',
    path.join(home, 'Downloads')
  ];

  for (const dir of searchDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (!f.toLowerCase().endsWith('.apk')) continue;
        const fullPath = path.join(dir, f);
        if (dir === analysisDir || f.toLowerCase().includes('frever')) {
          if (fs.existsSync(fullPath) && !candidates.includes(fullPath)) {
            candidates.push(fullPath);
          }
        }
      }
    } catch {
      // skip unreadable
    }
  }
  return candidates;
}

/** Tools: PATH first (Termux: pkg install apktool apksigner), then analysis/tools (PC fallback). */
function findTools() {
  const local = path.join(analysisDir, 'tools');
  const localJava = path.join(local, 'jre/bin/java');
  const java = which('java') || (fs.existsSync(localJava) ? localJava : null);
  const apktoolJar = path.join(local, 'apktool.jar');
  const signerJar = path.join(local, 'signer.jar');
  const apktool = which('apktool') ? { cmd: which('apktool'), args: [] } :
    fs.existsSync(apktoolJar) && java ? { cmd: java, args: ['-Xmx2g', '-jar', apktoolJar] } : null;
  const apksigner = which('apksigner') ? { kind: 'apksigner', cmd: which('apksigner'), args: [] } :
    fs.existsSync(signerJar) && java ? { kind: 'uber', cmd: java, args: ['-jar', signerJar] } : null;
  const localKeytool = path.join(local, 'jre/bin/keytool');
  const keytool = which('keytool') || (fs.existsSync(localKeytool) ? localKeytool : null);
  const zipalign = which('zipalign');
  return { java, apktool, apksigner, keytool, zipalign };
}

export function readStatus(file = statusFile) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { state: 'never-run', steps: [] };
  }
}

export function outputPath(dir = outDir) {
  return path.join(dir, OUTPUT_NAME);
}

export function createPapk({ url = lanUrl(), apkPath, statusPath = statusFile, logPath = logFile, out = outDir } = {}) {
  const status = { state: 'running', url, startedAt: new Date().toISOString(), steps: [] };
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const save = () => fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
  const log = (m) => fs.appendFileSync(logPath, `${new Date().toISOString()} ${m}\n`);
  const step = (name, fn) => {
    const entry = { name, state: 'running' };
    status.steps.push(entry);
    log(`STEP ${name}: start`);
    save();
    try {
      entry.detail = fn() || '';
      entry.state = 'ok';
      log(`STEP ${name}: ok ${entry.detail}`);
      save();
    } catch (error) {
      entry.state = 'failed';
      entry.detail = error.message;
      status.state = 'failed';
      status.failedStep = name;
      status.finishedAt = new Date().toISOString();
      log(`STEP ${name}: FAILED ${error.message}`);
      save();
      throw error;
    }
  };
  fs.rmSync(outputPath(out), { force: true });
  try {
    runSteps({ status, step, url, out, apkOverride: apkPath });
    status.state = 'ok';
    status.finishedAt = new Date().toISOString();
    save();
  } catch {
    // status already records the failing step; no output APK is produced
    fs.rmSync(outputPath(out), { force: true });
  }
  return status;
}

function runSteps({ status, step, url, out, apkOverride }) {
  let tools;
  let apkFile;

  step('check-target-url', () => {
    if (!/^http:\/\/[A-Za-z0-9.\-]+(:\d+)?\/$/.test(url)) throw new Error(`bad URL ${url}`);
    if (url.length > 36) throw new Error(`URL ${url} is ${url.length} chars; the production literal holds 36`);
    return `${url} (${url.length} chars; production literal 36)`;
  });

  step('locate-original-apk', () => {
    const rawPath = process.env.FREVERS_ORIGINAL_APK || apkOverride || path.join(analysisDir, 'Frever_4.0.5_APKPure.apk');
    apkFile = path.resolve(rawPath);

    if (!isAllowedPath(apkFile)) {
      throw new Error(`Path ${apkFile} is outside allowed home or storage folders.`);
    }

    if (!apkFile.toLowerCase().endsWith('.apk')) {
      throw new Error(`File ${apkFile} must end in .apk`);
    }

    if (!fs.existsSync(apkFile)) {
      const candidates = findApkCandidates();
      status.candidates = candidates;
      status.missingPath = apkFile;
      if (candidates.length > 0) {
        const primaryCandidate = candidates[0];
        const targetDest = path.join(analysisDir, 'Frever_4.0.5_APKPure.apk');
        const copyCmd = `cp "${primaryCandidate}" "${targetDest}"`;
        status.candidateFix = copyCmd;
        throw new Error(`Original APK not found at ${apkFile}.\nFound candidate: ${primaryCandidate}\nCopy command: ${copyCmd}`);
      } else {
        const msg = `Copy your Frever APK into ~/FreverS/analysis/ and name it Frever_4.0.5_APKPure.apk, then press Create PAPK again. If Android hides the Downloads folder, run termux-setup-storage first.`;
        status.missingInstruction = msg;
        throw new Error(`Original APK not found at ${apkFile}.\n${msg}`);
      }
    }

    const sum = md5(apkFile);
    if (sum !== ORIGINAL_MD5) throw new Error(`MD5 ${sum} != expected ${ORIGINAL_MD5}`);
    return `${apkFile} md5=${sum}`;
  });

  step('check-tools', () => {
    tools = findTools();
    const missing = ['java', 'apktool', 'apksigner', 'keytool'].filter((k) => !tools[k]);
    if (missing.length) throw new Error(`missing tools: ${missing.join(', ')}. Termux: pkg install openjdk-17 apktool apksigner; otherwise build on a PC (docs/papk.md)`);
    return `apktool=${tools.apktool.cmd} signer=${tools.apksigner.kind}`;
  });

  const decoded = path.join(workDir, 'decoded');
  step('apktool-decode', () => {
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });
    run(tools.apktool.cmd, [...tools.apktool.args, 'd', '-f', '-s', '-o', decoded, apkFile]);
    return decoded;
  });

  step('patch-metadata-hosts', () => {
    const file = path.join(decoded, 'assets/bin/Data/Managed/Metadata/global-metadata.dat');
    const buffer = fs.readFileSync(file);
    const report = patchMetadata(buffer, url);
    const prod = report.find((r) => r.host.startsWith('https://content-prod.'));
    if (!prod || !prod.patched) throw new Error(`production host not patched: ${JSON.stringify(prod)}`);
    fs.writeFileSync(file, buffer);
    return report.map((r) => `${r.host}:${r.patched ? 'patched' : r.reason}`).join('; ');
  });

  step('patch-manifest-cleartext', () => {
    const file = path.join(decoded, 'AndroidManifest.xml');
    let xml = fs.readFileSync(file, 'utf8');
    if (xml.includes('usesCleartextTraffic')) throw new Error('manifest already has usesCleartextTraffic; refusing to guess');
    if (!xml.includes('<application ')) throw new Error('no <application> tag');
    xml = xml.replace('<application ', '<application android:usesCleartextTraffic="true" ');
    fs.writeFileSync(file, xml);
    return 'android:usesCleartextTraffic=true';
  });

  const unsigned = path.join(workDir, 'unsigned.apk');
  step('apktool-build', () => {
    run(tools.apktool.cmd, [...tools.apktool.args, 'b', '-o', unsigned, decoded]);
    if (!fs.existsSync(unsigned)) throw new Error('apktool produced no APK');
    return `${fs.statSync(unsigned).size} bytes`;
  });

  const keystore = path.join(keyDir, 'frevers.keystore');
  const passFile = path.join(keyDir, 'keystore.pass');
  step('keystore', () => {
    fs.mkdirSync(keyDir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(keystore) && fs.existsSync(passFile)) return `reusing ${keystore}`;
    const pass = crypto.randomBytes(18).toString('base64url');
    fs.writeFileSync(passFile, pass, { mode: 0o600 });
    run(tools.keytool, ['-genkeypair', '-keystore', keystore, '-storepass', pass, '-keypass', pass, '-alias', 'frevers',
      '-keyalg', 'RSA', '-keysize', '2048', '-validity', '10000', '-dname', 'CN=FreverS local']);
    return `generated ${keystore} (outside the repository)`;
  });

  const aligned = path.join(workDir, 'aligned.apk');
  step('zipalign', () => {
    if (tools.zipalign) {
      run(tools.zipalign, ['-p', '-f', '4', unsigned, aligned]);
      return 'aligned 4-byte boundaries';
    } else {
      fs.copyFileSync(unsigned, aligned);
      return 'zipalign binary not present; skipped (alignment done by apktool)';
    }
  });

  step('sign', () => {
    const pass = fs.readFileSync(passFile, 'utf8').trim();
    fs.mkdirSync(out, { recursive: true });
    const signedTmp = path.join(workDir, 'signed.apk');
    if (tools.apksigner.kind === 'apksigner') {
      run(tools.apksigner.cmd, ['sign', '--ks', keystore, '--ks-pass', `file:${passFile}`, '--ks-key-alias', 'frevers', '--out', signedTmp, aligned]);
    } else {
      const dir = path.join(workDir, 'signed');
      run(tools.apksigner.cmd, [...tools.apksigner.args, '-a', aligned, '--ks', keystore, '--ksAlias', 'frevers',
        '--ksPass', pass, '--ksKeyPass', pass, '--allowResign', '-o', dir]);
      const f = fs.readdirSync(dir).find((n) => n.endsWith('.apk'));
      if (!f) throw new Error('signer produced no APK');
      fs.copyFileSync(path.join(dir, f), signedTmp);
    }
    fs.copyFileSync(signedTmp, outputPath(out));
    return outputPath(out);
  });

  step('md5', () => {
    status.output = OUTPUT_NAME;
    status.md5 = md5(outputPath(out));
    status.size = fs.statSync(outputPath(out)).size;
    return `${status.md5} ${status.size} bytes`;
  });
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const i = process.argv.indexOf('--url');
  const a = process.argv.indexOf('--apk');
  const urlArg = i > -1 ? process.argv[i + 1] : lanUrl();
  const apkArg = a > -1 ? process.argv[a + 1] : undefined;
  const result = createPapk({ url: urlArg, apkPath: apkArg });
  for (const s of result.steps) console.log(`${s.state.padEnd(7)} ${s.name} ${s.detail || ''}`);
  console.log(result.state === 'ok' ? `OK ${result.md5} output/${result.output}` : `FAILED at step ${result.failedStep}`);
  process.exit(result.state === 'ok' ? 0 : 1);
}
