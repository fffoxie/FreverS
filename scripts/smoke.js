#!/usr/bin/env node
/**
 * Smoke test against a running local server:
 *   1. log in as user 1 (fffoxie)
 *   2. read the current profile
 *   3. fetch avatar/group data for the account
 *
 * Usage:
 *   FREVERS_URL=http://127.0.0.1:8080 npm run smoke
 * Credentials come from FREVERS_USER1 / FREVERS_USER1_PASSWORD, or from
 * data/generated-credentials.txt created on first start.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultPort = process.env.FREVERS_PORT || process.env.PORT || '8080';
const baseUrl = (process.env.FREVERS_URL || process.env.FREVERS_PUBLIC_BASE_URL || `http://127.0.0.1:${defaultPort}`).replace(/\/+$/, '');

function credentialsFromFile(username) {
  const file = path.join(root, 'data', 'generated-credentials.txt');
  if (!fs.existsSync(file)) return null;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = /^([^:#]+):\s*(.+)$/.exec(line.trim());
    if (match && match[1] === username) return match[2].trim();
  }
  return null;
}

const username = process.env.FREVERS_USER1 || 'fffoxie';
const password = process.env.FREVERS_USER1_PASSWORD || credentialsFromFile(username);

if (!password) {
  console.error(
    'No password available. Set FREVERS_USER1_PASSWORD, or start the server once so ' +
      'data/generated-credentials.txt is created.'
  );
  process.exit(1);
}

function fail(message, detail) {
  console.error(`SMOKE FAIL: ${message}`);
  if (detail !== undefined) console.error(detail);
  process.exit(1);
}

async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${response.url}, got: ${text.slice(0, 200)}`);
  }
}

const health = await fetch(`${baseUrl}/health`).catch((error) => fail(`server not reachable at ${baseUrl}`, error.message));
if (!health || !health.ok) fail(`health check failed (${health && health.status})`);
const healthBody = await json(health);
if (healthBody.service !== 'frevers') fail(`port ${baseUrl} is answering but is not FreverS`, healthBody);
console.log(`health: ${health.status} (${healthBody.service})`);

const loginResponse = await fetch(`${baseUrl}/connect/token`, {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    authorization: `Basic ${Buffer.from('Server:smoke').toString('base64')}`
  },
  body: new URLSearchParams({
    grant_type: 'password',
    scope: 'friends_factory.creators_api offline_access',
    username,
    password
  })
});
const tokenBody = await json(loginResponse);
if (!loginResponse.ok || !tokenBody.access_token) {
  fail(`login failed (${loginResponse.status})`, tokenBody);
}
console.log(`login: ${username} ok (access token ${tokenBody.access_token.length} chars)`);

const auth = { authorization: `Bearer ${tokenBody.access_token}` };
const meResponse = await fetch(`${baseUrl}/me`, { headers: auth });
const me = await json(meResponse);
if (!meResponse.ok) fail(`GET /me failed (${meResponse.status})`, me);
console.log(`profile: Id=${me.Id} GroupId=${me.GroupId} Nickname=${me.Nickname}`);

const avatarUrl = `${baseUrl}/group/${me.GroupId}`;
const avatarResponse = await fetch(avatarUrl, { headers: auth });
const avatar = await json(avatarResponse);
if (!avatarResponse.ok) fail(`GET ${avatarUrl} failed (${avatarResponse.status})`, avatar);
if (avatar.MainGroupId !== me.GroupId) {
  fail('avatar/group response does not belong to the logged-in user', avatar);
}
console.log(
  `avatar data: group=${avatar.MainGroupId} nickname=${avatar.NickName} ` +
    `followers=${avatar.KPI && avatar.KPI.FollowersCount}`
);

console.log('SMOKE OK');
