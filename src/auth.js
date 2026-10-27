import fs from 'node:fs';
import path from 'node:path';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import config from './config.js';

let cachedSecret = null;

function tokenSecret() {
  if (cachedSecret) return cachedSecret;
  if (process.env.FREVERS_TOKEN_SECRET) {
    cachedSecret = process.env.FREVERS_TOKEN_SECRET;
    return cachedSecret;
  }
  const secretPath = path.join(path.dirname(config.dbPath), 'token-secret');
  try {
    cachedSecret = fs.readFileSync(secretPath, 'utf8').trim();
    if (cachedSecret) return cachedSecret;
  } catch {
    // create below
  }
  fs.mkdirSync(path.dirname(secretPath), { recursive: true });
  cachedSecret = randomBytes(48).toString('base64url');
  fs.writeFileSync(secretPath, `${cachedSecret}\n`, { mode: 0o600 });
  return cachedSecret;
}

function b64urlJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(input) {
  return createHmac('sha256', tokenSecret()).update(input).digest('base64url');
}

export function issueAccessToken(user, ttlSeconds = config.accessTokenTtlSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const groupId = Number(user.group_id);
  const userId = Number(user.id);
  const payload = {
    iss: config.publicBaseUrl,
    aud: 'friends_factory.creators_api',
    sub: String(userId),
    iat: now,
    nbf: now,
    exp: now + ttlSeconds,
    // The token payload is deserialized into UserInfo by AuthService.ParseToken.
    // The exact property names were inferred from that struct (the stripped
    // binary does not reveal the JSON keys), so common spellings are emitted.
    user_id: userId,
    userId,
    primary_group_id: groupId,
    primaryGroupId: groupId,
    group_id: groupId,
    groupId,
    GroupId: groupId,
    group_ids: [groupId],
    groupIds: [groupId],
    email: user.email,
    Email: user.email,
    nickname: user.nickname,
    NickName: user.nickname,
    name: user.nickname,
    unique_name: user.nickname,
    employee: Boolean(user.is_employee),
    qa: Boolean(user.is_qa),
    moderator: Boolean(user.is_moderator),
    artist: Boolean(user.is_artist),
    registered_with_apple_id: false,
    onboarding_completed: Boolean(user.onboarding_completed),
    main_character_id: user.main_character_id ?? null,
    // PascalCase names of Bridge.Authorization.Models.UserInfo.
    UserId: userId,
    PrimaryGroupId: groupId,
    GroupIds: [groupId],
    QA: Boolean(user.is_qa),
    Moderator: Boolean(user.is_moderator),
    Artist: Boolean(user.is_artist),
    Employee: Boolean(user.is_employee),
    RegisteredWithAppleId: false,
    OnboardingCompleted: Boolean(user.onboarding_completed),
    MainCharacterId: user.main_character_id ?? null
  };
  const header = { alg: 'HS256', typ: 'JWT' };
  const body = `${b64urlJson(header)}.${b64urlJson(payload)}`;
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(token) {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;
  const expected = sign(`${header}.${payload}`);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && claims.exp < now) return null;
  return claims;
}

export function bearerToken(req) {
  const header = req.headers.authorization;
  if (header && /^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '');
  const url = new URL(req.url, 'http://localhost');
  return url.searchParams.get('access_token');
}

export function basicCredentials(req) {
  const header = req.headers.authorization;
  if (!header || !/^Basic\s+/i.test(header)) return null;
  try {
    const decoded = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return { clientId: decoded, clientSecret: '' };
    return { clientId: decoded.slice(0, separator), clientSecret: decoded.slice(separator + 1) };
  } catch {
    return null;
  }
}

/**
 * The APK's AuthService hard-codes the Basic client id/secret
 * "Server:<long-secret>" (see docs/protocol.md). We do not enforce it: this is
 * a private two-user server and enforcing a secret baked into the client adds
 * no security. We only require that a Basic header is present when the client
 * sends one, and we record the client id for diagnostics.
 */
export const HARD_CODED_CLIENT_ID = 'Server';
