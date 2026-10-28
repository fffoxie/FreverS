import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

const webDir = path.join(config.rootDir, 'docs');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8'
};

export function serveStatic(req, res, pathname) {
  const method = (req.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') return null;
  let route = pathname;
  if (route === '/' || route === '/admin' || route === '/admin/') route = '/index.html';
  else if (route === '/dashboard') route = '/index.html';
  else if (route.startsWith('/admin/')) route = route.slice(6);
  else if (route.startsWith('/web/')) route = route.slice(4);
  else if (!/^\/(app\.js|style\.css|favicon\.svg)$/.test(route)) return null;

  const file = path.join(webDir, route.replace(/^\/+/, ''));
  if (!file.startsWith(webDir) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return null;
  const body = fs.readFileSync(file);
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] || 'application/octet-stream',
    'content-length': body.length,
    'cache-control': 'no-cache'
  });
  res.end(method === 'HEAD' ? undefined : body);
  return { status: 200, bytes: body.length };
}
