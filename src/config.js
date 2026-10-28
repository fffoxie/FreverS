import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function intEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be an integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

const port = intEnv('FREVERS_PORT', intEnv('PORT', 8080));
const host = process.env.FREVERS_HOST || '0.0.0.0';
const publicBaseUrl = (process.env.FREVERS_PUBLIC_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/+$/, '');

export const config = {
  rootDir,
  host,
  port,
  publicBaseUrl,
  dbPath: process.env.FREVERS_DB_PATH || path.join(rootDir, 'data', 'frever.db'),
  logFile: process.env.FREVERS_LOG_FILE || path.join(rootDir, 'data', 'logs', 'server.log'),
  logRequests: process.env.FREVERS_LOG_REQUESTS !== '0',
  logUnknownBodyPreview: intEnv('FREVERS_LOG_BODY_PREVIEW', 512),
  maxBodyBytes: intEnv('FREVERS_MAX_BODY_BYTES', 2 * 1024 * 1024),
  accessTokenTtlSeconds: intEnv('FREVERS_ACCESS_TOKEN_TTL', 3600),
  refreshTokenTtlSeconds: intEnv('FREVERS_REFRESH_TOKEN_TTL', 60 * 60 * 24 * 30),
  // The client build analysed is 4.0.5 (versionCode 409).
  apiVersion: process.env.FREVERS_API_VERSION || '4.0.5',
  // Values the client compares against GET /api/Client/SupportedVersions.
  supportedVersions: {
    BridgeMinVersion: process.env.FREVERS_BRIDGE_MIN || '0.0.0',
    BridgeMaxVersion: process.env.FREVERS_BRIDGE_MAX || '99.99.99',
    FreverMinBuild: intEnv('FREVERS_MIN_BUILD', 0),
    FreverMaxBuild: intEnv('FREVERS_MAX_BUILD', 999999),
    FreverMinVersion: process.env.FREVERS_MIN_VERSION || '0.0.0',
    FreverMaxVersion: process.env.FREVERS_MAX_VERSION || '99.99.99'
  },
  seed: {
    user1: process.env.FREVERS_USER1 || 'fffoxie',
    user2: process.env.FREVERS_USER2 || 'friend',
    password1: process.env.FREVERS_USER1_PASSWORD || '',
    password2: process.env.FREVERS_USER2_PASSWORD || ''
  },
  // Optional local timezone hint; the client sends timestamps itself.
  logLevel: process.env.FREVERS_LOG_LEVEL || 'info'
};

export default config;
