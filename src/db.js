import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import config from './config.js';

const SCRYPT_KEYLEN = 64;

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function generatedPassword() {
  return randomBytes(15).toString('base64url');
}

function ensureDataDir(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

export function openDatabase(dbPath = config.dbPath) {
  ensureDataDir(dbPath);
  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nickname TEXT NOT NULL,
      email TEXT NOT NULL,
      group_id INTEGER NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_employee INTEGER NOT NULL DEFAULT 0,
      is_qa INTEGER NOT NULL DEFAULT 0,
      is_moderator INTEGER NOT NULL DEFAULT 0,
      is_artist INTEGER NOT NULL DEFAULT 0,
      main_character_id INTEGER,
      onboarding_completed INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS refresh_tokens_user_id ON refresh_tokens(user_id);
    CREATE TABLE IF NOT EXISTS age_quiz_answers (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      quiz_state TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

/**
 * Seed the two local accounts. Passwords come from the environment; when they
 * are absent a random password is generated and written to
 * data/generated-credentials.txt (which is git-ignored).
 */
export function seedAccounts(db, { user1, user2, password1, password2 } = config.seed) {
  const existing = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  if (existing > 0) return { created: [], credentialsPath: null };

  const generated = [];
  const p1 = password1 || generatedPassword();
  const p2 = password2 || generatedPassword();
  if (!password1) generated.push({ username: user1, password: p1 });
  if (!password2) generated.push({ username: user2, password: p2 });

  const insert = db.prepare(`
    INSERT INTO users (username, nickname, email, group_id, password_salt, password_hash)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const accounts = [
    { username: user1, nickname: user1, email: `${user1}@localhost`, groupId: 1 },
    { username: user2, nickname: user2, email: `${user2}@localhost`, groupId: 2 }
  ];
  db.exec('BEGIN');
  try {
    for (const [index, account] of accounts.entries()) {
      const password = index === 0 ? p1 : p2;
      const { salt, hash } = hashPassword(password);
      insert.run(account.username, account.nickname, account.email, account.groupId, salt, hash);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  let credentialsPath = null;
  if (generated.length > 0) {
    credentialsPath = path.join(path.dirname(config.dbPath), 'generated-credentials.txt');
    fs.mkdirSync(path.dirname(credentialsPath), { recursive: true });
    fs.writeFileSync(
      credentialsPath,
      '# Generated once when the database was first created. Keep this file private.\n' +
        generated.map((entry) => `${entry.username}: ${entry.password}`).join('\n') +
        '\n',
      { mode: 0o600 }
    );
  }
  return { created: accounts.map((account) => account.username), credentialsPath };
}

export function findUserByUsername(db, username) {
  return db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
}

export function findUserById(db, id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function createRefreshToken(db, userId, ttlSeconds) {
  const token = randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  db.prepare('INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES (?, ?, ?)').run(
    token,
    userId,
    expiresAt
  );
  return { token, expiresAt };
}

export function consumeRefreshToken(db, token) {
  const row = db.prepare('SELECT * FROM refresh_tokens WHERE token = ?').get(token);
  if (!row) return null;
  db.prepare('DELETE FROM refresh_tokens WHERE token = ?').run(token);
  if (row.expires_at < Math.floor(Date.now() / 1000)) return null;
  return findUserById(db, row.user_id);
}

export default { openDatabase, seedAccounts, hashPassword, verifyPassword };
