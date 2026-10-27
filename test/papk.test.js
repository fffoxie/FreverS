import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createPapk, readStatus } from '../scripts/papk.mjs';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frevers-papk-'));
const statusPath = path.join(dir, 'status.json');
const logPath = path.join(dir, 'papk.log');

function run(opts) {
  return createPapk({ statusPath, logPath, ...opts });
}

test('papk stops at locate-original-apk when the APK is missing', () => {
  const s = run({ url: 'http://127.0.0.1:8080/', apkPath: path.join(dir, 'missing.apk') });
  assert.equal(s.state, 'failed');
  assert.equal(s.failedStep, 'locate-original-apk');
  assert.equal(readStatus(statusPath).failedStep, 'locate-original-apk');
  assert.match(fs.readFileSync(logPath, 'utf8'), /STEP locate-original-apk: FAILED/);
});

test('papk rejects a target URL longer than the 36-char literal', () => {
  const s = run({ url: 'http://this-phone-name-is-far-too-long:8080/' });
  assert.equal(s.state, 'failed');
  assert.equal(s.failedStep, 'check-target-url');
  assert.equal(s.steps.at(-1).state, 'failed');
});

test('papk rejects a malformed URL', () => {
  const s = run({ url: 'https://example.com' });
  assert.equal(s.failedStep, 'check-target-url');
});

test('a failed run records no output and no md5', () => {
  const s = run({ url: 'http://127.0.0.1:8080/', apkPath: path.join(dir, 'missing.apk') });
  assert.equal(s.state, 'failed');
  assert.equal(s.output, undefined);
  assert.equal(s.md5, undefined);
  assert.ok(s.finishedAt);
});
