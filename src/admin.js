import { findUserByUsername, verifyPassword } from './db.js';
import { issueAccessToken } from './auth.js';
import { MAX_BASE_URL_LENGTH } from './apk/metadata.js';
import { listBuilds } from './apk/build.js';
import {
  corsHeaders,
  send,
  sendError,
  readJson,
  adminUser,
  publicUser,
  getState
} from './admin-core.js';
import { serveAsset, uploadAsset, deleteAsset } from './admin-assets.js';
import {
  apkStatus,
  uploadApk,
  createBuild,
  buildsList,
  buildDetails,
  downloadBuild,
  tools
} from './admin-builds.js';
import { updateUser } from './admin-users.js';

export async function handleAdmin(req, res, pathname, db) {
  const route = pathname.replace(/\/+$/, '') || '/';
  if (!route.startsWith('/admin/api') && !route.startsWith('/assets/')) return null;
  const method = (req.method || 'GET').toUpperCase();
  if (method === 'OPTIONS') {
    res.writeHead(204, corsHeaders());
    res.end();
    return { status: 204, bytes: 0 };
  }
  const url = new URL(req.url, 'http://localhost');

  const assetMatch = /^\/assets\/(\d+)$/.exec(route);
  if (assetMatch && method === 'GET') return serveAsset(req, res, db, Number(assetMatch[1]));

  if (route === '/admin/api/login' && method === 'POST') {
    let body;
    try {
      body = await readJson(req);
    } catch (error) {
      return { status: 400, bytes: sendError(res, 400, error.message) };
    }
    const user = findUserByUsername(db, String(body.username || ''));
    if (!user || !verifyPassword(String(body.password || ''), user.password_salt, user.password_hash)) {
      return { status: 401, bytes: sendError(res, 401, 'Invalid username or password') };
    }
    if (!user.is_admin) return { status: 403, bytes: sendError(res, 403, 'Account is not an administrator') };
    return { status: 200, bytes: send(res, 200, { token: issueAccessToken(user), user: publicUser(user) }) };
  }

  const admin = adminUser(req, db);
  if (!admin) return { status: 401, bytes: sendError(res, 401, 'Admin authentication required') };

  if (route === '/admin/api/state' && method === 'GET') {
    return { status: 200, bytes: send(res, 200, getState(db, listBuilds, MAX_BASE_URL_LENGTH)) };
  }
  if (route === '/admin/api/tools' && method === 'GET') return tools(res);

  const userMatch = /^\/admin\/api\/users\/(\d+)$/.exec(route);
  if (userMatch && (method === 'PATCH' || method === 'POST')) {
    return updateUser(req, res, db, Number(userMatch[1]));
  }

  if (route === '/admin/api/assets' && method === 'GET') {
    const assets = db.prepare('SELECT * FROM assets ORDER BY id DESC').all().map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      url: `/assets/${row.id}`,
      mime: row.mime,
      size: row.size,
      createdAt: row.created_at
    }));
    return { status: 200, bytes: send(res, 200, { assets }) };
  }
  if (route === '/admin/api/assets' && method === 'POST') {
    return uploadAsset(
      req,
      res,
      db,
      admin,
      url.searchParams.get('type'),
      url.searchParams.get('name') || 'Untitled'
    );
  }
  const deleteAssetMatch = /^\/admin\/api\/assets\/(\d+)$/.exec(route);
  if (deleteAssetMatch && method === 'DELETE') return deleteAsset(res, db, Number(deleteAssetMatch[1]));

  if (route === '/admin/api/apk' && method === 'GET') return apkStatus(res);
  if (route === '/admin/api/apk' && method === 'POST') return uploadApk(req, res);

  if (route === '/admin/api/build' && method === 'POST') return createBuild(req, res);
  if (route === '/admin/api/builds' && method === 'GET') return buildsList(res);
  const buildMatch = /^\/admin\/api\/build\/([\w-]+)$/.exec(route);
  if (buildMatch && method === 'GET') return buildDetails(res, buildMatch[1]);
  const downloadMatch = /^\/admin\/api\/build\/([\w-]+)\/download$/.exec(route);
  if (downloadMatch && method === 'GET') return downloadBuild(res, downloadMatch[1]);

  return { status: 404, bytes: sendError(res, 404, `No admin route for ${method} ${route}`) };
}
