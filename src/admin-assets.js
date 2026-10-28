import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { corsHeaders, send, sendError, publicAsset } from './admin-core.js';
import { getDataDir } from './apk/tools.js';

const assetsDir = () => path.join(getDataDir(), 'assets');

export function serveAsset(req, res, db, id) {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  if (!row) return { status: 404, bytes: sendError(res, 404, 'Asset not found') };
  const file = path.join(assetsDir(), row.filename);
  if (!fs.existsSync(file)) return { status: 404, bytes: sendError(res, 404, 'Asset file missing') };
  const stat = fs.statSync(file);
  res.writeHead(200, {
    ...corsHeaders(),
    'content-type': row.mime,
    'content-length': stat.size,
    'cache-control': 'public, max-age=3600'
  });
  fs.createReadStream(file).pipe(res);
  return { status: 200, bytes: stat.size };
}

export async function uploadAsset(req, res, db, admin, type, name) {
  if (!['avatar', 'music', 'accessory'].includes(type)) {
    return { status: 400, bytes: sendError(res, 400, 'type must be avatar, music or accessory') };
  }
  const mime = (req.headers['content-type'] || 'application/octet-stream').split(';')[0];
  await fsp.mkdir(assetsDir(), { recursive: true, mode: 0o700 });
  const stamp = `${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  const ext = mime.includes('png') ? 'png'
    : mime.includes('jpeg') ? 'jpg'
    : mime.includes('mp3') ? 'mp3'
    : mime.includes('wav') ? 'wav'
    : mime.includes('ogg') ? 'ogg'
    : mime.includes('json') ? 'json'
    : 'bin';
  const filename = `${type}-${stamp}.${ext}`;
  const target = path.join(assetsDir(), filename);
  let size = 0;
  try {
    await new Promise((resolve, reject) => {
      const out = fs.createWriteStream(target, { mode: 0o600 });
      req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 50 * 1024 * 1024) {
          req.destroy();
          out.destroy();
          reject(new Error('Asset larger than 50 MB'));
        }
      });
      req.on('error', reject);
      out.on('error', reject);
      out.on('finish', resolve);
      req.pipe(out);
    });
  } catch (error) {
    await fsp.rm(target, { force: true }).catch(() => {});
    return { status: 400, bytes: sendError(res, 400, error.message) };
  }
  const info = db
    .prepare('INSERT INTO assets (type, name, filename, mime, size, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(type, name.slice(0, 100), filename, mime, size, admin.id);
  const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(Number(info.lastInsertRowid));
  return { status: 201, bytes: send(res, 201, { asset: publicAsset(asset) }) };
}

export async function deleteAsset(res, db, id) {
  const row = db.prepare('SELECT * FROM assets WHERE id = ?').get(id);
  if (!row) return { status: 404, bytes: sendError(res, 404, 'Asset not found') };
  db.prepare('UPDATE users SET avatar_asset_id = NULL WHERE avatar_asset_id = ?').run(row.id);
  db.prepare('DELETE FROM assets WHERE id = ?').run(row.id);
  await fsp.rm(path.join(assetsDir(), row.filename), { force: true }).catch(() => {});
  return { status: 200, bytes: send(res, 200, { deleted: row.id }) };
}
