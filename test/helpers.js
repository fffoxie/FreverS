import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.js';
import { setPublicBaseUrl } from '../src/models.js';

process.env.FREVERS_LOG_FILE = path.join(os.tmpdir(), 'frevers-test-server.log');

export const PASSWORD1 = 'test-password-one';
export const PASSWORD2 = 'test-password-two';

export async function startTestServer() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frevers-test-'));
  const app = createApp({
    dbPath: path.join(dir, 'test.db'),
    seed: {
      user1: 'fffoxie',
      user2: 'friend',
      password1: PASSWORD1,
      password2: PASSWORD2
    }
  });
  const server = app.server;
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;
  setPublicBaseUrl(baseUrl);

  return {
    app,
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      app.db.close();
      fs.rmSync(dir, { recursive: true, force: true });
    }
  };
}

export function basicAuthHeader() {
  // Same shape the APK uses (client id "Server", long secret); value is
  // irrelevant to this server, only presence is recorded.
  return `Basic ${Buffer.from('Server:test-secret').toString('base64')}`;
}

export async function login(baseUrl, username = 'fffoxie', password = PASSWORD1) {
  const response = await fetch(`${baseUrl}/connect/token`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      authorization: basicAuthHeader()
    },
    body: new URLSearchParams({
      grant_type: 'password',
      scope: 'friends_factory.creators_api offline_access',
      username,
      password
    })
  });
  const json = await response.json();
  return { response, json };
}

export async function authedGet(baseUrl, token, route) {
  return fetch(`${baseUrl}${route}`, { headers: { authorization: `Bearer ${token}` } });
}
