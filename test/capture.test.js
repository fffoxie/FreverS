import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { startTestServer } from './helpers.js';
import { config } from '../src/config.js';

let ctx;

before(async () => {
  config.captureMode = true;
  ctx = await startTestServer();
});

after(async () => {
  config.captureMode = false;
  await ctx.close();
});

describe('traffic capture mode', () => {
  test('unknown route returns 200 {} and writes to capture.jsonl when FREVERS_CAPTURE is enabled', async () => {
    const captureFile = path.join(config.rootDir, 'data', 'capture', 'capture.jsonl');
    if (fs.existsSync(captureFile)) {
      fs.unlinkSync(captureFile);
    }

    const response = await fetch(`${ctx.baseUrl}/api/unknown/test-endpoint`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testKey: 'testVal' })
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, {});

    assert.ok(fs.existsSync(captureFile));
    const lines = fs.readFileSync(captureFile, 'utf8').split('\n').filter(Boolean);
    assert.ok(lines.length >= 1);
    const lastEntry = JSON.parse(lines[lines.length - 1]);
    assert.equal(lastEntry.method, 'POST');
    assert.equal(lastEntry.path, '/api/unknown/test-endpoint');
    assert.deepEqual(lastEntry.body, { testKey: 'testVal' });
  });
});
