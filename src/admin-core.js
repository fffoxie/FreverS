import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import config from './config.js';
import { verifyAccessToken, bearerToken } from './auth.js';
import { sourceApkPath } from './apk/build.js';

import { getDataDir } from './apk/tools.js';


export function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'authorization,content-type,x-admin-token',
    'access-control-allow-private-network': 'true',
    'access-control-expose-headers': 'content-disposition,content-length',
    'access-control-max-age': '86400'
  };
}

export function send(res, status, body, extra = {}) {
  const payload = body === null || body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    ...corsHeaders(),
    'content-type': 'application/json; charset=utf-8',
    'content-length': payload.length,
    'cache-control': 'no-store',
    ...extra
  });
  res.end(payload);
  return payload.length;
}

export function sendError(res, status, message) {
  return send(res, status, { error: message });
}

export function readJson(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (size === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

let cachedFileToken = null;
export function adminFileToken() {
  if (cachedFileToken) return cachedFileToken;
  if (process.env.FREVERS_ADMIN_TOKEN) return process.env.FREVERS_ADMIN_TOKEN;
  const file = path.join(getDataDir(), 'admin-token.txt');
  try {
    cachedFileToken = fs.readFileSync(file, 'utf8').trim();
    if (cachedFileToken) return cachedFileToken;
  } catch {
    // create below
  }
  fs.mkdirSync(getDataDir(), { recursive: true });
  cachedFileToken = randomBytes(24).toString('base64url');
  fs.writeFileSync(file, `${cachedFileToken}\n`, { mode: 0o600 });
  console.log(`[admin] generated admin token at ${file}`);
  return cachedFileToken;
}

export function adminUser(req, db) {
  const token = bearerToken(req);
  if (token) {
    const claims = verifyAccessToken(token);
    if (claims) {
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(claims.sub));
      if (user && user.is_admin) return user;
    }
  }
  const header = req.headers['x-admin-token'];
  if (header && header === adminFileToken()) {
    return { id: null, username: 'token-admin', nickname: 'Token admin', is_admin: 1 };
  }
  return null;
}

export function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    groupId: row.group_id,
    email: row.email,
    softCurrency: row.soft_currency,
    hardCurrency: row.hard_currency,
    premiumUntil: row.premium_until,
    isAdmin: Boolean(row.is_admin),
    avatarAssetId: row.avatar_asset_id,
    createdAt: row.created_at
  };
}

export function publicAsset(row) {
  return {
    id: row.id,
    type: row.type,
    name: row.name,
    url: `/assets/${row.id}`,
    mime: row.mime,
    size: row.size,
    createdAt: row.created_at
  };
}

export function getState(db, listBuilds, maxBaseUrlLength) {
  const users = db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser);
  const assets = db.prepare('SELECT * FROM assets ORDER BY id DESC').all().map(publicAsset);
  let source;
  try {
    const stat = fs.statSync(sourceApkPath());
    source = { path: sourceApkPath(), size: stat.size, modified: stat.mtime.toISOString() };
  } catch {
    source = { path: sourceApkPath(), size: 0, missing: true };
  }
  return {
    server: {
      publicBaseUrl: config.publicBaseUrl,
      version: '0.2.0',
      maxBaseUrlLength,
      officialGroupId: 1000
    },
    source,
    users,
    assets,
    builds: listBuilds(),
    settings: Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((row) => [row.key, row.value]))
  };
}
