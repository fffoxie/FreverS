import assert from 'node:assert/strict';
import { after, before, describe, test } from 'node:test';
import { startTestServer, login, authedGet, PASSWORD1, PASSWORD2 } from './helpers.js';

let ctx;
let adminToken;

async function adminFetch(path, options = {}) {
  const headers = { ...(options.headers || {}), authorization: `Bearer ${adminToken}` };
  if (options.json !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(options.json);
  }
  return fetch(`${ctx.baseUrl}${path}`, { ...options, headers });
}

before(async () => {
  ctx = await startTestServer();
  const result = await login(ctx.baseUrl, 'fffoxie', PASSWORD1);
  assert.equal(result.response.status, 200);
  adminToken = result.json.access_token;
});

after(async () => {
  await ctx.close();
});

describe('admin dashboard API', () => {
  test('GET /admin/api/state lists both seeded users and marks the first admin', async () => {
    const response = await adminFetch('/admin/api/state');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.users.length, 2);
    assert.equal(body.users[0].username, 'fffoxie');
    assert.equal(body.users[0].isAdmin, true);
    assert.equal(body.users[1].isAdmin, false);
    assert.ok(body.server.maxBaseUrlLength >= 21);
  });

  test('GET /admin/api/state requires admin authentication', async () => {
    const response = await fetch(`${ctx.baseUrl}/admin/api/state`);
    assert.equal(response.status, 401);
  });

  test('PATCH /admin/api/users/:id grants currency and premium, visible in /me', async () => {
    const response = await adminFetch('/admin/api/users/2', {
      method: 'PATCH',
      json: { softCurrency: 777, hardCurrency: 12, premiumDays: 7, nickname: 'bestie' }
    });
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.equal(updated.user.softCurrency, 777);
    assert.equal(updated.user.hardCurrency, 12);
    assert.equal(updated.user.nickname, 'bestie');
    assert.ok(updated.user.premiumUntil);

    const friend = await login(ctx.baseUrl, 'friend', PASSWORD2);
    const me = await authedGet(ctx.baseUrl, friend.json.access_token, '/me');
    assert.equal(me.status, 200);
    const profile = await me.json();
    assert.equal(profile.UserBalance.SoftCurrencyAmount, 777);
    assert.equal(profile.UserBalance.HardCurrencyAmount, 12);
    assert.equal(profile.Nickname, 'bestie');
    assert.equal(profile.IsPremium, true);
  });

  test('POST /admin/api/assets stores an upload and serves it publicly', async () => {
    const bytes = Buffer.from('89504e470d0a1a0a-fake-png');
    const response = await adminFetch('/admin/api/assets?type=avatar&name=My%20Avatar', {
      method: 'POST',
      headers: { 'content-type': 'image/png' },
      body: bytes
    });
    assert.equal(response.status, 201);
    const { asset } = await response.json();
    assert.equal(asset.type, 'avatar');
    assert.equal(asset.name, 'My Avatar');
    assert.equal(asset.size, bytes.length);

    const fetchAsset = await fetch(`${ctx.baseUrl}${asset.url}`);
    assert.equal(fetchAsset.status, 200);
    assert.deepEqual(Buffer.from(await fetchAsset.arrayBuffer()), bytes);
  });

  test('GET / serves the dashboard HTML', async () => {
    const response = await fetch(`${ctx.baseUrl}/`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/html/);
    assert.match(await response.text(), /FreverS/);
  });

  test('GET /admin/ and /admin/app.js serve the dashboard assets', async () => {
    const page = await fetch(`${ctx.baseUrl}/admin/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type'), /text\/html/);
    const script = await fetch(`${ctx.baseUrl}/admin/app.js`);
    assert.equal(script.status, 200);
    assert.match(script.headers.get('content-type'), /javascript/);
    assert.match(await script.text(), /admin\/api\/state/);
  });

  test('POST /admin/api/build fails cleanly when no source APK exists', async () => {
    const response = await adminFetch('/admin/api/build', {
      method: 'POST',
      json: { baseUrl: 'http://127.0.0.1:8080' }
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /Original APK not found/);
  });
});

describe('any-account login', () => {
  test('an unknown username creates a local account on first password login', async () => {
    const first = await login(ctx.baseUrl, 'newplayer', 'hello123');
    assert.equal(first.response.status, 200);
    const me = await authedGet(ctx.baseUrl, first.json.access_token, '/me');
    assert.equal(me.status, 200);
    const profile = await me.json();
    assert.equal(profile.Nickname, 'newplayer');
    assert.ok(profile.GroupId >= 3);

    const again = await login(ctx.baseUrl, 'newplayer', 'hello123');
    assert.equal(again.response.status, 200);
    const wrong = await login(ctx.baseUrl, 'newplayer', 'wrong-password');
    assert.equal(wrong.response.status, 400);
  });
});
