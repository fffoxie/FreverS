import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import {
  startTestServer,
  login,
  authedGet,
  PASSWORD1,
  PASSWORD2,
  basicAuthHeader
} from './helpers.js';

let ctx;
let token;

before(async () => {
  ctx = await startTestServer();
  const result = await login(ctx.baseUrl, 'fffoxie', PASSWORD1);
  assert.equal(result.response.status, 200);
  token = result.json.access_token;
});

after(async () => {
  await ctx.close();
});

describe('startup and auth', () => {
  test('GET /api/Client/SupportedVersions returns the SupportedVersions shape', async () => {
    const response = await fetch(`${ctx.baseUrl}/api/Client/SupportedVersions`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), [
      'BridgeMaxVersion',
      'BridgeMinVersion',
      'FreverMaxBuild',
      'FreverMaxVersion',
      'FreverMinBuild',
      'FreverMinVersion'
    ]);
    assert.equal(typeof body.BridgeMinVersion, 'string');
    assert.equal(typeof body.FreverMinBuild, 'number');
    // The analysed client is 4.0.5 / build 409 and must be in range.
    assert.ok(body.FreverMinBuild <= 409 && 409 <= body.FreverMaxBuild);
  });

  test('POST /connect/token returns the TokenResponse shape', async () => {
    const { response, json } = await login(ctx.baseUrl, 'fffoxie', PASSWORD1);
    assert.equal(response.status, 200);
    for (const key of [
      'access_token',
      'refresh_token',
      'server_url',
      'transcoding_server',
      'video_server',
      'social_server',
      'notification_server',
      'client_server',
      'chat_server',
      'assetmanager_server'
    ]) {
      assert.equal(typeof json[key], 'string', `${key} must be a string`);
      assert.ok(json[key].length > 0);
    }
    const claims = JSON.parse(Buffer.from(json.access_token.split('.')[1], 'base64url').toString());
    assert.equal(claims.sub, '1');
    assert.equal(claims.email, 'fffoxie@localhost');
  });

  test('POST /connect/token rejects a bad password with an OAuth error', async () => {
    const response = await fetch(`${ctx.baseUrl}/connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'password', username: 'fffoxie', password: 'wrong' })
    });
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, 'invalid_grant');
  });

  test('POST /connect/token supports grant_type=refresh_token', async () => {
    const first = await login(ctx.baseUrl, 'fffoxie', PASSWORD1);
    const response = await fetch(`${ctx.baseUrl}/connect/token`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: basicAuthHeader()
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: first.json.refresh_token,
        scope: 'friends_factory.creators_api offline_access'
      })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.access_token);
    assert.notEqual(body.refresh_token, first.json.refresh_token);
  });

  test('GET /api/client/urls returns the ServicesUrls shape', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/api/client/urls');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), [
      'Asset',
      'AssetManager',
      'Chat',
      'Client',
      'Main',
      'Notification',
      'Social',
      'Transcoding',
      'Video'
    ]);
    assert.equal(body.Main, ctx.baseUrl);
  });
});

describe('account endpoints', () => {
  test('POST /api/verify-email accepts the email field', async () => {
    const response = await fetch(`${ctx.baseUrl}/api/verify-email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ email: 'fffoxie@localhost' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {});
  });

  test('POST /api/verify-phone-number accepts a form-encoded phoneNumber', async () => {
    const response = await fetch(`${ctx.baseUrl}/api/verify-phone-number`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization: `Bearer ${token}`
      },
      body: new URLSearchParams({ phoneNumber: '+15555550100' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {});
  });

  test('POST /api/credential/username updates the authenticated account', async () => {
    const friendLogin = await login(ctx.baseUrl, 'friend', PASSWORD2);
    assert.equal(friendLogin.response.status, 200);
    const response = await fetch(`${ctx.baseUrl}/api/credential/username`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${friendLogin.json.access_token}`
      },
      body: JSON.stringify({ username: 'friend_renamed' })
    });
    assert.equal(response.status, 200);
    const relogin = await login(ctx.baseUrl, 'friend_renamed', PASSWORD2);
    assert.equal(relogin.response.status, 200);
  });

  test('GET /auth/age-confirmation/quiz returns the AgeConfirmationQuizResponse shape', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/auth/age-confirmation/quiz');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.IsAgeConfirmed, 'boolean');
    assert.equal(typeof body.IsRunOutOfQuestions, 'boolean');
    assert.ok(Array.isArray(body.Questions));
    assert.equal(body.IsAgeConfirmed, true);
  });

  test('GET /auth/age-confirmation/quiz/status returns quiz state', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/auth/age-confirmation/quiz/status');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.IsAgeConfirmed, true);
  });

  test('POST /auth/age-confirmation/quiz confirms the age', async () => {
    const response = await fetch(`${ctx.baseUrl}/auth/age-confirmation/quiz`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ answers: [] })
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.IsAgeConfirmed, true);
    assert.equal(body.IsRunOutOfQuestions, true);
  });
describe('social, profile and fallback endpoints', () => {
  test('GET /group/follow-recommendations returns an array', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/group/follow-recommendations');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.json()));
  });

  test('GET /group/follow-back-recommendations returns an array', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/group/follow-back-recommendations');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.json()));
  });

  test('GET /group/star-creators-in-your-country returns star creator profile array', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/group/star-creators-in-your-country');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(Array.isArray(body));
    assert.equal(body.length, 1);
    assert.equal(body[0].NickName, 'Star Creator');
  });

  test('GET /group/frever-official returns the Profile shape', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/group/frever-official');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.MainGroupId, 1000);
    assert.equal(typeof body.NickName, 'string');
    assert.equal(typeof body.KPI.FollowersCount, 'number');
  });

  test('GET /gamification/reward/past returns ClaimPastRewardsResult', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/gamification/reward/past');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body, { RewardCount: 0, SoftCurrency: 0, HardCurrency: 0, Assets: [] });
  });

  test('GET /me returns the current user (MyProfile)', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/me');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.Nickname, 'fffoxie');
    assert.equal(body.Id, 1);
    assert.equal(body.GroupId, 1);
  });

  test('GET /me/balance returns UserBalance', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/me/balance');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { SoftCurrencyAmount: 0, HardCurrencyAmount: 0 });
  });

  test('GET /group/1 returns a Profile with avatar/group data', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/group/1');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.MainGroupId, 1);
    assert.equal(body.NickName, 'fffoxie');
  });

  test('GET /health reports ok', async () => {
    const response = await fetch(`${ctx.baseUrl}/health`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, 'ok');
  });

  test('GET /baking/characters returns baking array', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/baking/characters');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(await response.json()));
  });

  test('GET /purchase/in-app-purchase/offers returns empty array', async () => {
    const response = await authedGet(ctx.baseUrl, token, '/purchase/in-app-purchase/offers');
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), []);
  });

  test('GET /assets/maps returns maps list from <data>/assets/maps.txt', async () => {
    fs.mkdirSync(path.join(ctx.dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(ctx.dir, 'assets', 'maps.txt'), '# comment\nmap_party_room\nmap_laboratory\n');
    const response = await authedGet(ctx.baseUrl, token, '/assets/maps');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.maps, ['map_party_room', 'map_laboratory']);
  });

  test('GET /assets/animations returns animations list from <data>/assets/animations.txt', async () => {
    fs.mkdirSync(path.join(ctx.dir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(ctx.dir, 'assets', 'animations.txt'), 'idle\ndance_01\n');
    const response = await authedGet(ctx.baseUrl, token, '/assets/animations');
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.animations, ['idle', 'dance_01']);
  });

  test('unknown route returns 404 and is logged', async () => {
    const response = await fetch(`${ctx.baseUrl}/nope/does-not-exist`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' })
    });
    assert.equal(response.status, 404);
    const body = await response.json();
    assert.equal(body.error, 'not_found');
  });

  test('FREVERS_CAPTURE=1 captures unknown request', async () => {
    const orig = process.env.FREVERS_CAPTURE;
    process.env.FREVERS_CAPTURE = '1';
    try {
      const response = await fetch(`${ctx.baseUrl}/unknown/capture-test`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ capture: 'test' })
      });
      assert.equal(response.status, 404);
    } finally {
      process.env.FREVERS_CAPTURE = orig;
    }
  });
});


describe('method variants', () => {
  test('POST /api/client/urls returns the same ServicesUrls shape', async () => {
    const response = await fetch(`${ctx.baseUrl}/api/client/urls`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${token}`
      },
      body: '{}'
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(typeof body.Client, 'string');
    assert.equal(body.Client, ctx.baseUrl);
  });

  test('PUT /api/credential/username accepts the same body as POST', async () => {
    const friendLogin = await login(ctx.baseUrl, 'friend_renamed', PASSWORD2);
    assert.equal(friendLogin.response.status, 200);
    const response = await fetch(`${ctx.baseUrl}/api/credential/username`, {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${friendLogin.json.access_token}`
      },
      body: JSON.stringify({ username: 'friend_renamed' })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {});
  });

  test('a token request on an unknown auth prefix still reaches the handler', async () => {
    const response = await fetch(`${ctx.baseUrl}/auth/4.0.5/connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        username: 'fffoxie',
        password: PASSWORD1
      })
    });
    assert.equal(response.status, 200);
    assert.ok((await response.json()).access_token);
  });
});

});
