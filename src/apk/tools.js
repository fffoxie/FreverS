import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import config from '../config.js';

let activeDbPath = config.dbPath;
export function setActiveDbPath(dbPath) {
  activeDbPath = dbPath;
}
export function getDataDir() {
  return path.dirname(activeDbPath);
}
export function getBuildsDir() {
  return path.join(getDataDir(), 'builds');
}
export function getApkDir() {
  return path.join(getDataDir(), 'apk');
}
export function getKeysDir() {
  return path.join(getDataDir(), 'keys');
}

export const TOOLS = {
  unzip: 'unzip',
  zip: 'zip',
  zipalign: 'zipalign',
  apksigner: 'apksigner',
  keytool: 'keytool'
};

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    const out = [];
    const err = [];
    child.stdout.on('data', (chunk) => out.push(chunk));
    child.stderr.on('data', (chunk) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8')
      });
    });
  });
}

const VERSION_ARGS = {
  unzip: ['-v'],
  zip: ['-v'],
  zipalign: [],
  apksigner: ['--version'],
  keytool: ['-help']
};

export async function toolVersion(name) {
  try {
    const result = await run(name, VERSION_ARGS[name] || ['--version']);
    const output = `${result.stdout}\n${result.stderr}`.trim();
    if (!output) return null;
    if (result.code === 0 || /version|Zip alignment|Key and Certificate|UnZip/i.test(output)) {
      return output.split('\n').find((line) => line.trim().length > 0)?.trim() || 'present';
    }
    return null;
  } catch {
    return null;
  }
}

export async function toolReport() {
  const report = {};
  for (const [key, command] of Object.entries(TOOLS)) {
    report[key] = { command, version: await toolVersion(command) };
  }
  return report;
}

export async function ensureKeystore(log = () => {}) {
  const keysDir = getKeysDir();
  await fsp.mkdir(keysDir, { recursive: true, mode: 0o700 });
  const keystore = path.join(keysDir, 'frevers.keystore');
  const passFile = path.join(keysDir, 'keystore.pass');
  if (!fs.existsSync(passFile)) {
    await fsp.writeFile(
      passFile,
      `${process.env.FREVERS_KEYSTORE_PASS || randomBytes(18).toString('base64url')}\n`,
      { mode: 0o600 }
    );
  }
  const password = (await fsp.readFile(passFile, 'utf8')).trim();
  if (!fs.existsSync(keystore)) {
    log('generating signing keystore');
    const result = await run(TOOLS.keytool, [
      '-genkeypair',
      '-keystore', keystore,
      '-storetype', 'PKCS12',
      '-storepass', password,
      '-keypass', password,
      '-alias', 'frevers',
      '-keyalg', 'RSA',
      '-keysize', '2048',
      '-validity', '10000',
      '-dname', 'CN=FreverS, OU=Local, O=FreverS, C=US'
    ]);
    if (result.code !== 0) {
      throw new Error(`keytool failed: ${(result.stderr || result.stdout).slice(-1500)}`);
    }
  }
  return { keystore, passFile };
}

export async function extractEntry(apk, entry, destination) {
  await new Promise((resolve, reject) => {
    const child = spawn(TOOLS.unzip, ['-p', apk, entry], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(destination, { mode: 0o600 });
    let err = '';
    child.stderr.on('data', (chunk) => { err += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`unzip ${entry} failed: ${err.slice(-500)}`));
    });
    out.on('error', reject);
    out.on('finish', resolve);
    child.stdout.pipe(out);
  });
  return fsp.readFile(destination);
}

export async function zipReplace(apk, files, cwd) {
  const result = await run(TOOLS.zip, ['-X', '-0', apk, ...files], { cwd });
  if (result.code !== 0) {
    throw new Error(`zip update failed: ${(result.stderr || result.stdout).slice(-1000)}`);
  }
}
