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
  return createPapk({ statusPath, logPath, out: path.join(dir, 'out'), ...opts });
}

test('papk stops at locate-original-apk when the APK is missing without candidates', () => {
  const s = run({ url: 'http://127.0.0.1:8080/', apkPath: path.join(dir, 'missing.apk') });
  assert.equal(s.state, 'failed');
  assert.equal(s.failedStep, 'locate-original-apk');
  assert.equal(readStatus(statusPath).failedStep, 'locate-original-apk');
  assert.ok(s.missingInstruction);
  assert.match(s.missingInstruction, /Copy your Frever APK into/);
});

test('papk detects candidate when file is missing', () => {
  const downloadsDir = path.join(os.homedir(), 'Downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const dummyCandidate = path.join(downloadsDir, 'Frever_4.0.5_test_candidate.apk');
  fs.writeFileSync(dummyCandidate, 'dummy apk content');

  try {
    const s = run({ url: 'http://127.0.0.1:8080/', apkPath: path.join(dir, 'nonexistent.apk') });
    assert.equal(s.state, 'failed');
    assert.equal(s.failedStep, 'locate-original-apk');
    assert.ok(s.candidates && s.candidates.includes(dummyCandidate));
    assert.ok(s.candidateFix && s.candidateFix.includes(dummyCandidate));
  } finally {
    fs.rmSync(dummyCandidate, { force: true });
  }
});

test('papk override env var pointing to missing or non-.apk file fails validation', () => {
  const origEnv = process.env.FREVERS_ORIGINAL_APK;
  try {
    process.env.FREVERS_ORIGINAL_APK = path.join(dir, 'invalid.txt');
    const s = run({ url: 'http://127.0.0.1:8080/' });
    assert.equal(s.state, 'failed');
    assert.equal(s.failedStep, 'locate-original-apk');
    assert.match(s.steps.find((x) => x.name === 'locate-original-apk').detail, /must end in \.apk/);
  } finally {
    if (origEnv !== undefined) process.env.FREVERS_ORIGINAL_APK = origEnv;
    else delete process.env.FREVERS_ORIGINAL_APK;
  }
});

test('papk override env var pointing to out-of-bounds path fails validation', () => {
  const origEnv = process.env.FREVERS_ORIGINAL_APK;
  try {
    process.env.FREVERS_ORIGINAL_APK = '/etc/outside.apk';
    const s = run({ url: 'http://127.0.0.1:8080/' });
    assert.equal(s.state, 'failed');
    assert.equal(s.failedStep, 'locate-original-apk');
    assert.match(s.steps.find((x) => x.name === 'locate-original-apk').detail, /outside allowed/);
  } finally {
    if (origEnv !== undefined) process.env.FREVERS_ORIGINAL_APK = origEnv;
    else delete process.env.FREVERS_ORIGINAL_APK;
  }
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
