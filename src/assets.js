import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sendJson } from './http.js';

/**
 * Local asset/media file delivery.
 *
 * Layout (see docs/ASSET_CREATION.md):
 *   data/assets/...  -> served at /assets/...   (catalog.json, bundles/Android/*)
 *   data/videos/...  -> served at /media/...    (local video exports)
 *
 * The original client downloads UnityFS bundles with an HTTP GET (plus Range
 * and cache revalidation), so these routes must return the exact bytes and
 * cache headers, not just a 200. The AssetBundleIndex metadata DTO is a
 * separate, still-unverified requirement (docs/CLIENT_CONTRACT.md §1.2).
 */

const CONTENT_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.fbx': 'application/octet-stream'
};

const DEFAULT_CONTENT_TYPE = 'application/octet-stream';

export function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || DEFAULT_CONTENT_TYPE;
}

function baseFor(requestPath, assetRoot, mediaRoot) {
  if (!assetRoot || !mediaRoot) return null;
  if (requestPath === '/assets' || requestPath.startsWith('/assets/')) {
    return { root: assetRoot, prefix: '/assets' };
  }
  if (requestPath === '/media' || requestPath.startsWith('/media/')) {
    return { root: mediaRoot, prefix: '/media' };
  }
  return null;
}

/**
 * Resolve a request path to a file inside the asset/media root.
 * Returns null when the target escapes its root (traversal) or is not decodable.
 */
export function resolveAssetPath(requestPath, { assetRoot, mediaRoot }) {
  const base = baseFor(requestPath, assetRoot, mediaRoot);
  if (!base) return null;
  const rawRelative = requestPath.slice(base.prefix.length);
  let relative;
  try {
    relative = decodeURIComponent(rawRelative);
  } catch {
    return null;
  }
  if (relative.includes('\0')) return null;
  const root = path.resolve(base.root);
  const target = path.resolve(root, `.${relative.startsWith('/') ? relative : `/${relative}`}`);
  const rootPrefix = root.endsWith(path.sep) ? root : `${root}${path.sep}`;
  if (target !== root && !target.startsWith(rootPrefix)) return null;
  return { root, target };
}

function statFile(target) {
  try {
    const stat = fs.statSync(target);
    return stat.isFile() ? stat : null;
  } catch {
    return null;
  }
}

function etagFor(stat) {
  const digest = createHash('sha1').update(`${stat.size}:${stat.mtimeMs}`).digest('hex');
  return `"${digest}"`;
}

/**
 * Parse a single `bytes=` Range header. Returns null when there is no usable
 * range (caller sends the whole file) and `{ invalid: true }` for an
 * unsatisfiable range (caller sends 416).
 */
export function parseRange(header, size) {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!match || (match[1] === '' && match[2] === '')) return null;
  let start;
  let end;
  if (match[1] === '') {
    const suffix = Number(match[2]);
    if (!Number.isInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(size - suffix, 0);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] === '' ? size - 1 : Number(match[2]);
    if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) return { invalid: true };
    if (start >= size) return { invalid: true };
    if (end >= size) end = size - 1;
  }
  if (size === 0) return { invalid: true };
  return { start, end };
}

function streamFile(res, target, start, end) {
  const stream = fs.createReadStream(target, { start, end });
  stream.on('error', () => res.destroy());
  // Only abort on a real disconnect; a normal keep-alive close must not cut the body.
  res.on('close', () => {
    if (!res.writableEnded) stream.destroy();
  });
  stream.pipe(res);
}

/**
 * Serve /assets/* and /media/*. Returns null when the path is not asset/media
 * traffic so the caller can continue routing; otherwise returns the status and
 * body size for request logging.
 */
export function serveAsset(req, res, { requestPath, assetRoot, mediaRoot }) {
  if (!baseFor(requestPath, assetRoot, mediaRoot)) return null;

  const resolved = resolveAssetPath(requestPath, { assetRoot, mediaRoot });
  const stat = resolved ? statFile(resolved.target) : null;
  if (!stat) {
    const payload = { error: 'not_found', error_description: 'Asset not found' };
    sendJson(res, 404, payload);
    return { status: 404, bytes: Buffer.byteLength(JSON.stringify(payload)) };
  }

  const etag = etagFor(stat);
  const lastModified = stat.mtime.toUTCString();
  const headers = {
    'content-type': contentTypeFor(resolved.target),
    'accept-ranges': 'bytes',
    etag,
    'last-modified': lastModified,
    'cache-control': 'public, max-age=300'
  };

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { etag, 'last-modified': lastModified, 'cache-control': headers['cache-control'] });
    res.end();
    return { status: 304, bytes: 0 };
  }

  const method = (req.method || 'GET').toUpperCase();
  const range = parseRange(req.headers.range, stat.size);
  if (range && range.invalid) {
    res.writeHead(416, { 'content-range': `bytes */${stat.size}`, 'accept-ranges': 'bytes', ...headers });
    res.end();
    return { status: 416, bytes: 0 };
  }

  const start = range ? range.start : 0;
  const end = range ? range.end : stat.size - 1;
  const length = stat.size === 0 ? 0 : end - start + 1;
  const status = range ? 206 : 200;

  res.writeHead(status, {
    ...headers,
    'content-length': length,
    ...(range ? { 'content-range': `bytes ${start}-${end}/${stat.size}` } : {})
  });

  if (method === 'HEAD' || length === 0) {
    res.end();
    return { status, bytes: 0 };
  }

  streamFile(res, resolved.target, start, end);
  return { status, bytes: length };
}
