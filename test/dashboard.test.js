import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startTestServer } from './helpers.js';
import { readCoverage } from '../src/dashboard.js';

test('GET /dashboard serves the mobile page', async () => {
  const s = await startTestServer();
  try {
    const r = await fetch(`${s.baseUrl}/dashboard`);
    assert.equal(r.status, 200);
    assert.match(r.headers.get('content-type'), /text\/html/);
    const html = await r.text();
    assert.match(html, /viewport/);
    assert.match(html, /Create PAPK/);
    assert.match(html, /\/dashboard\/api\/state/);
  } finally { await s.close(); }
});

test('GET /dashboard/api/state reports checklist, accounts, coverage, logs', async () => {
  const s = await startTestServer();
  try {
    await fetch(`${s.baseUrl}/health`);
    const r = await fetch(`${s.baseUrl}/dashboard/api/state`);
    assert.equal(r.status, 200);
    const state = await r.json();
    assert.deepEqual(state.accounts.map((a) => a.username), ['fffoxie', 'friend']);
    assert.ok(!JSON.stringify(state).includes('password'));
    assert.equal(state.checklist.length, 4);
    assert.equal(state.server.running, true);
    assert.ok(state.coverage.confirmed > 0);
    assert.ok(state.coverage.percent > 0 && state.coverage.percent <= 100);
    assert.ok(Array.isArray(state.logs));
  } finally { await s.close(); }
});

test('dashboard download rejects traversal and missing files', async () => {
  const s = await startTestServer();
  try {
    const a = await fetch(`${s.baseUrl}/dashboard/download/..%2F..%2Fdata%2Ffrever.db`);
    assert.equal(a.status, 404);
    const b = await fetch(`${s.baseUrl}/dashboard/download/nope.apk`);
    assert.equal(b.status, 404);
  } finally { await s.close(); }
});

test('readCoverage parses docs/protocol.md', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frevers-cov-'));
  const file = path.join(dir, 'protocol.md');
  fs.writeFileSync(file, '## 4. Implemented\n| 1 | IMPLEMENTED | `GET /a` | none |\n| 2 | IMPLEMENTED | `GET /health` | not called by the game |\n## 5. Unknown\n| `/b` | x |\n| `/c` | y |\n## 6. Next\n');
  const c = readCoverage(file);
  assert.deepEqual(c, { available: true, confirmed: 3, implemented: 1, unknown: 2, percent: 33.3 });
  fs.rmSync(dir, { recursive: true, force: true });
});

test('requests are appended to the log file', async () => {
  const s = await startTestServer();
  try {
    await fetch(`${s.baseUrl}/health`);
    const text = fs.readFileSync(process.env.FREVERS_LOG_FILE, 'utf8');
    assert.match(text, /\[http\] GET \/health 200/);
  } finally { await s.close(); }
});
