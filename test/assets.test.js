import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { startTestServer } from './helpers.js';

// A minimal UnityFS-looking payload; content is opaque to the server.
const BUNDLE_BYTES = Buffer.concat([
  Buffer.from('UnityFS\0', 'binary'),
  Buffer.from(Array.from({ length: 64 }, (_, index) => index))
]);

const BUNDLE_URL = '/assets/bundles/Android/map_party_room';

const LARGE_BUNDLE = Buffer.alloc(200000);
for (let index = 0; index < LARGE_BUNDLE.length; index += 1) LARGE_BUNDLE[index] = index % 251;

let ctx;

before(async () => {
  ctx = await startTestServer();
  const assetDir = path.join(ctx.dir, 'assets');
  fs.mkdirSync(path.join(assetDir, 'bundles', 'Android'), { recursive: true });
  fs.writeFileSync(path.join(assetDir, 'bundles', 'Android', 'map_party_room'), BUNDLE_BYTES);
  const largeBundle = Buffer.alloc(200000);
  for (let index = 0; index < largeBundle.length; index += 1) largeBundle[index] = index % 251;
  fs.writeFileSync(path.join(assetDir, 'bundles', 'Android', 'large_bundle'), LARGE_BUNDLE);
  fs.writeFileSync(path.join(assetDir, 'maps.txt'), 'map_party_room\n');
  fs.writeFileSync(
    path.join(assetDir, 'catalog.json'),
    JSON.stringify([{ id: 'map_party_room', type: 'map', size: BUNDLE_BYTES.length }], null, 2)
  );
  fs.mkdirSync(path.join(ctx.dir, 'videos'), { recursive: true });
  fs.writeFileSync(path.join(ctx.dir, 'videos', 'clip.mp4'), Buffer.from('local-video-bytes'));
});

after(async () => {
  await ctx.close();
});

describe('asset file delivery', () => {
  test('GET a bundle returns the exact bytes with cache and range headers', async () => {
    const response = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/octet-stream');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(Number(response.headers.get('content-length')), BUNDLE_BYTES.length);
    assert.match(response.headers.get('etag') || '', /^"[0-9a-f]+"$/);
    assert.match(response.headers.get('cache-control') || '', /public/);
    assert.ok(response.headers.get('last-modified'));
    const body = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(body, BUNDLE_BYTES);
  });

  test('GET a large bundle streams the complete file', async () => {
    const response = await fetch(`${ctx.baseUrl}/assets/bundles/Android/large_bundle`);
    assert.equal(response.status, 200);
    assert.equal(Number(response.headers.get('content-length')), LARGE_BUNDLE.length);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.length, LARGE_BUNDLE.length);
    assert.ok(body.equals(LARGE_BUNDLE));
  });

  test('GET with a byte Range returns 206 and only the requested slice', async () => {
    const response = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`, { headers: { range: 'bytes=0-7' } });
    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-range'), `bytes 0-7/${BUNDLE_BYTES.length}`);
    const body = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(body, BUNDLE_BYTES.subarray(0, 8));
  });

  test('GET with a suffix Range returns the last bytes', async () => {
    const response = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`, { headers: { range: 'bytes=-4' } });
    assert.equal(response.status, 206);
    const body = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(body, BUNDLE_BYTES.subarray(BUNDLE_BYTES.length - 4));
  });

  test('an unsatisfiable Range returns 416 with the total size', async () => {
    const response = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`, { headers: { range: 'bytes=999999-' } });
    assert.equal(response.status, 416);
    assert.equal(response.headers.get('content-range'), `bytes */${BUNDLE_BYTES.length}`);
  });

  test('If-None-Match revalidation returns 304 without a body', async () => {
    const first = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`);
    const etag = first.headers.get('etag');
    await first.arrayBuffer();
    const second = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`, { headers: { 'if-none-match': etag } });
    assert.equal(second.status, 304);
    assert.equal((await second.arrayBuffer()).byteLength, 0);
  });

  test('HEAD returns the same headers without a body', async () => {
    const response = await fetch(`${ctx.baseUrl}${BUNDLE_URL}`, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(Number(response.headers.get('content-length')), BUNDLE_BYTES.length);
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  });

  test('the reconstructed catalog.json is downloadable as JSON', async () => {
    const response = await fetch(`${ctx.baseUrl}/assets/catalog.json`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') || '', /^application\/json/);
    const body = await response.json();
    assert.deepEqual(body, [{ id: 'map_party_room', type: 'map', size: BUNDLE_BYTES.length }]);
  });

  test('a missing asset returns a JSON 404', async () => {
    const response = await fetch(`${ctx.baseUrl}/assets/bundles/Android/does_not_exist`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'not_found', error_description: 'Asset not found' });
  });

  test('encoded traversal outside the asset root is rejected', async () => {
    const response = await fetch(`${ctx.baseUrl}/assets/%2e%2e%2Ftest.db`);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'not_found', error_description: 'Asset not found' });
  });

  test('media files are served from the sibling videos directory', async () => {
    const response = await fetch(`${ctx.baseUrl}/media/clip.mp4`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.equal(await response.text(), 'local-video-bytes');
  });
});
