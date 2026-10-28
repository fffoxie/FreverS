import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import config from '../config.js';
import { patchMetadata, normalizeBaseUrl, MAX_BASE_URL_LENGTH } from './metadata.js';
import { patchManifest } from './manifest.js';
import {
  getApkDir,
  getBuildsDir,
  run,
  toolVersion,
  toolReport,
  ensureKeystore,
  extractEntry,
  zipReplace,
  TOOLS
} from './tools.js';

const jobs = new Map();
export { toolReport };

export function sourceApkPath() {
  return process.env.FREVERS_APK_PATH || path.join(getApkDir(), 'source.apk');
}

function newJob(baseUrl) {
  const id = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
  const job = {
    id,
    baseUrl,
    status: 'queued',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    log: [],
    error: null,
    output: null,
    report: null
  };
  jobs.set(id, job);
  return job;
}

function log(job, message, progress) {
  job.log.push({ at: new Date().toISOString(), message });
  job.updatedAt = new Date().toISOString();
  if (typeof progress === 'number') job.progress = Math.max(job.progress, Math.min(100, progress));
  console.log(`[apk ${job.id}] ${message}`);
}

async function requireTool(job, name) {
  const version = await toolVersion(TOOLS[name]);
  if (!version) {
    throw new Error(
      `Missing tool '${TOOLS[name]}'. On Termux run: pkg install openjdk-17 zip unzip zipalign apksigner`
    );
  }
  log(job, `${name}: ${version}`);
}

export function listBuilds() {
  return [...jobs.values()]
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((job) => {
      const { log: entries, ...rest } = job;
      return { ...rest, logLines: entries.length, lastLog: entries.at(-1)?.message || null };
    });
}

export function getBuild(id) {
  return jobs.get(id) || null;
}

export function buildOutputPath(job) {
  return job?.output ? path.join(getBuildsDir(), job.id, job.output) : null;
}

export async function startBuild({ baseUrl } = {}) {
  const normalized = normalizeBaseUrl(baseUrl || config.publicBaseUrl);
  if (normalized.length > MAX_BASE_URL_LENGTH) {
    throw new Error(
      `Server URL "${normalized}" is ${normalized.length} characters; maximum is ${MAX_BASE_URL_LENGTH}. ` +
        'Use a short hostname or IPv4 address (e.g. http://phone:8080).'
    );
  }
  const source = sourceApkPath();
  if (!fs.existsSync(source)) {
    throw new Error(`Original APK not found at ${source}. Upload it in the dashboard or set FREVERS_APK_PATH.`);
  }
  const job = newJob(normalized);
  runBuild(job, source).catch((error) => {
    job.status = 'failed';
    job.error = error.message;
    log(job, `FAILED: ${error.message}`, job.progress);
  });
  return job;
}

async function runBuild(job, sourceApk) {
  const dir = path.join(getBuildsDir(), job.id);
  const workApk = path.join(dir, 'work.apk');
  const alignedApk = path.join(dir, 'aligned.apk');
  const outputApk = path.join(dir, 'FreverS-patched.apk');
  const metadataEntry = 'assets/bin/Data/Managed/Metadata/global-metadata.dat';
  const metadataPath = path.join(dir, metadataEntry);
  const manifestPath = path.join(dir, 'AndroidManifest.xml');
  await fsp.mkdir(path.dirname(metadataPath), { recursive: true });
  job.status = 'running';
  log(job, `source: ${sourceApk}`, 2);
  log(job, `target: ${job.baseUrl}`, 3);
  for (const tool of ['unzip', 'zip', 'apksigner', 'keytool']) await requireTool(job, tool);
  const hasZipalign = Boolean(await toolVersion('zipalign'));
  if (hasZipalign) log(job, 'zipalign: present');
  else log(job, 'zipalign: missing, signing without extra alignment (install zipalign for best results)');

  log(job, 'copying APK', 5);
  await fsp.copyFile(sourceApk, workApk);

  log(job, 'extracting global-metadata.dat and AndroidManifest.xml', 10);
  const metadataRaw = await extractEntry(workApk, metadataEntry, metadataPath);
  const manifestRaw = await extractEntry(workApk, 'AndroidManifest.xml', manifestPath);

  log(job, 'patching API hosts', 20);
  const metadata = patchMetadata(metadataRaw, job.baseUrl);
  await fsp.writeFile(metadataPath, metadata.buffer);
  for (const replacement of metadata.report.replacements) {
    log(job, `  ${replacement.host} -> ${replacement.target} (${replacement.count} literal)`);
  }

  log(job, 'patching manifest (cleartext + legacy target)', 30);
  const manifest = patchManifest(manifestRaw);
  await fsp.writeFile(manifestPath, manifest.buffer);
  for (const change of manifest.report.changed) {
    log(job, `  ${change.attribute}: ${change.from} -> ${change.to}`);
  }

  log(job, 'rewriting APK entries', 45);
  await zipReplace(workApk, [metadataEntry, 'AndroidManifest.xml'], dir);

  log(job, 'removing old signatures', 55);
  const remove = await run(TOOLS.zip, [
    '-d', workApk,
    'META-INF/*.SF', 'META-INF/*.RSA', 'META-INF/*.DSA', 'META-INF/*.EC'
  ]);
  if (remove.code !== 0 && !/nothing to do|not found/i.test(`${remove.stdout}${remove.stderr}`)) {
    log(job, `  note: ${(remove.stderr || remove.stdout).trim().slice(0, 300)}`);
  }

  log(job, 'aligning APK', 65);
  let signInput = workApk;
  if (hasZipalign) {
    const align = await run(TOOLS.zipalign, ['-f', '4', workApk, alignedApk]);
    if (align.code !== 0) throw new Error(`zipalign failed: ${(align.stderr || align.stdout).slice(-1000)}`);
    signInput = alignedApk;
  }

  log(job, 'preparing signing key', 75);
  const { keystore, passFile } = await ensureKeystore((message) => log(job, message));

  log(job, 'signing APK (v1 + v2)', 85);
  const sign = await run(TOOLS.apksigner, [
    'sign',
    '--ks', keystore,
    '--ks-key-alias', 'frevers',
    '--ks-pass', `file:${passFile}`,
    '--out', outputApk,
    signInput
  ]);
  if (sign.code !== 0) throw new Error(`apksigner failed: ${(sign.stderr || sign.stdout).slice(-1500)}`);

  log(job, 'verifying signature', 95);
  const verify = await run(TOOLS.apksigner, ['verify', '--print-certs', outputApk]);
  if (verify.code !== 0) {
    throw new Error(`apksigner verify failed: ${(verify.stderr || verify.stdout).slice(-1000)}`);
  }
  log(job, verify.stdout.trim().split('\n').slice(0, 3).join(' | '), 98);

  job.output = path.basename(outputApk);
  job.report = {
    baseUrl: job.baseUrl,
    metadata: metadata.report,
    manifest: manifest.report,
    sourceBytes: (await fsp.stat(sourceApk)).size,
    outputBytes: (await fsp.stat(outputApk)).size,
    signed: true
  };
  await fsp.writeFile(path.join(dir, 'report.json'), JSON.stringify({ ...job, output: job.output }, null, 2));
  job.status = 'succeeded';
  log(job, 'done', 100);

  for (const file of [workApk, alignedApk, path.join(dir, 'assets'), manifestPath]) {
    await fsp.rm(file, { force: true, recursive: true }).catch(() => {});
  }
}

export async function saveUploadedApk(stream, maxBytes = 400 * 1024 * 1024) {
  await fsp.mkdir(getApkDir(), { recursive: true, mode: 0o700 });
  const target = path.join(getApkDir(), 'source.apk');
  const temp = `${target}.uploading`;
  let size = 0;
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(temp, { mode: 0o600 });
    stream.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        stream.destroy();
        out.destroy();
        reject(new Error(`APK is larger than ${maxBytes} bytes`));
      }
    });
    stream.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    stream.pipe(out);
  });
  await fsp.rename(temp, target);
  return { path: target, size };
}

