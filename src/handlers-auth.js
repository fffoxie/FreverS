import { issueAccessToken, bearerToken, verifyAccessToken, basicCredentials } from './auth.js';
import {
  findUserByUsername,
  findUserById,
  verifyPassword,
  hashPassword,
  createRefreshToken,
  consumeRefreshToken
} from './db.js';
import { HttpError } from './http.js';
import { tokenResponse } from './models.js';
import config from './config.js';

export function authenticate(ctx, required) {
  const token = bearerToken(ctx.req);
  if (!token) {
    if (required) throw new HttpError(401, 'Missing access token');
    return null;
  }
  const claims = verifyAccessToken(token);
  if (!claims) {
    if (required) throw new HttpError(401, 'Invalid or expired access token');
    return null;
  }
  const user = findUserById(ctx.db, Number(claims.sub));
  if (!user && required) throw new HttpError(401, 'Unknown user');
  return user || null;
}

export function formValue(body, ...names) {
  for (const name of names) {
    if (body && body[name] !== undefined && body[name] !== null && String(body[name]).length > 0) {
      return String(body[name]);
    }
  }
  return undefined;
}

export async function login(ctx) {
  const body = ctx.body || {};
  const grantType = formValue(body, 'grant_type', 'grantType') || 'password';

  if (grantType === 'refresh_token') {
    const refreshToken = formValue(body, 'refresh_token', 'refreshToken');
    if (!refreshToken) throw new HttpError(400, 'refresh_token is required', 'invalid_request');
    const user = consumeRefreshToken(ctx.db, refreshToken);
    if (!user) throw new HttpError(400, 'Invalid refresh token', 'invalid_grant');
    const issued = createRefreshToken(ctx.db, user.id, config.refreshTokenTtlSeconds);
    return { body: tokenResponse(issueAccessToken(user), issued.token) };
  }

  if (grantType !== 'password') {
    // email_auth_token / phone_number_token / google_auth_token /
    // apple_auth_token exist in the real service. This server only has local
    // password accounts, so return a normal OAuth error.
    throw new HttpError(400, `Unsupported grant_type: ${grantType}`, 'unsupported_grant_type');
  }

  const username = formValue(body, 'username', 'userName', 'email');
  const password = formValue(body, 'password');
  if (!username || !password) {
    throw new HttpError(400, 'username and password are required', 'invalid_request');
  }

  const user = findUserByUsername(ctx.db, username) || findUserByUsername(ctx.db, username.split('@')[0]);
  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    throw new HttpError(400, 'Invalid username or password', 'invalid_grant');
  }

  const basic = basicCredentials(ctx.req);
  if (basic) ctx.logNote = `client=${basic.clientId}`;

  const issued = createRefreshToken(ctx.db, user.id, config.refreshTokenTtlSeconds);
  return { body: tokenResponse(issueAccessToken(user), issued.token) };
}

export async function updateUsername(ctx) {
  const user = authenticate(ctx, true);
  const body = ctx.body || {};
  const username = formValue(body, 'username', 'userName', 'newUsername', 'Username');
  if (!username) throw new HttpError(400, 'username is required');
  if (!/^[A-Za-z0-9._-]{3,30}$/.test(username)) {
    throw new HttpError(400, 'username must be 3-30 characters of A-Z, 0-9, dot, underscore or dash');
  }
  const existing = findUserByUsername(ctx.db, username);
  if (existing && existing.id !== user.id) throw new HttpError(409, 'Username is already taken');
  ctx.db.prepare('UPDATE users SET username = ?, nickname = ? WHERE id = ?').run(username, username, user.id);
  return { body: {} };
}

export async function requestVerification(ctx) {
  const body = ctx.body || {};
  const value = formValue(body, 'email', 'phoneNumber', 'phone_number');
  if (!value) throw new HttpError(400, 'email or phoneNumber is required');
  // No e-mail/SMS delivery on a local-only server. Log it so the operator can
  // see the target from the server console.
  console.log(`[verification] path=${ctx.path} target=${value}`);
  return { body: {} };
}

/**
 * AuthService.RegisterTemporaryAccount. Creates (once) a local `guest` account
 * and returns the same TokenResponse shape as a normal login.
 */
export async function registerTemporaryAccount(ctx) {
  let user = findUserByUsername(ctx.db, 'guest');
  if (!user) {
    const nextGroupRow = ctx.db.prepare('SELECT COALESCE(MAX(group_id), 0) + 1 AS next FROM users').get();
    const nextGroup = nextGroupRow ? nextGroupRow.next : 10;
    const { salt, hash } = hashPassword('guestpass');
    ctx.db
      .prepare(
        `INSERT INTO users (username, nickname, email, group_id, password_salt, password_hash)
         VALUES ('guest', 'guest', 'guest@localhost', ?, ?, ?)`
      )
      .run(nextGroup, salt, hash);
    user = findUserByUsername(ctx.db, 'guest');
  }
  const issued = createRefreshToken(ctx.db, user.id, config.refreshTokenTtlSeconds);
  return { body: tokenResponse(issueAccessToken(user), issued.token) };
}

/**
 * AuthService.CheckIfParentEmailBound. The local server has no parental
 * consent e-mail flow, so the account always reports a bound parent e-mail
 * under every key spelling the stripped client may read.
 */
export async function parentalConsent(ctx) {
  return {
    body: {
      isSuccess: true,
      success: true,
      isBound: true,
      isEmailBound: true,
      bound: true
    }
  };
}
