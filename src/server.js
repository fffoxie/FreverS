import http from 'node:http';
import path from 'node:path';
import { config as globalConfig } from './config.js';
import { openDatabase, seedAccounts } from './db.js';
import { matchEndpoint, normalizePath } from './endpoints.js';
import { setPublicBaseUrl } from './models.js';
import { handleDashboard } from './dashboard.js';
import { serveAsset } from './assets.js';
import { HttpError, parseRequestBody, sendJson, logRequest, logUnknown } from './http.js';

function errorPayload(error) {
  if (error instanceof HttpError) {
    const payload = {
      error: error.code || 'request_error',
      error_description: error.message,
      message: error.message,
      isError: true,
      errorMessage: error.message
    };
    return { status: error.status, payload };
  }
  return {
    status: 500,
    payload: { error: 'server_error', error_description: 'Internal server error', isError: true }
  };
}

export function createApp({ dbPath = globalConfig.dbPath, seed = globalConfig.seed } = {}) {
  const db = openDatabase(dbPath);
  const seedResult = seedAccounts(db, seed);
  // Files live next to the database so tests and operators can point
  // FREVERS_DB_PATH at an isolated directory (docs/ASSET_CREATION.md §3).
  const dataDir = path.dirname(path.resolve(dbPath));
  const assetRoot = path.join(dataDir, 'assets');
  const mediaRoot = path.join(dataDir, 'videos');

  const server = http.createServer(async (req, res) => {
    const started = process.hrtime.bigint();
    let url;
    try {
      url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    } catch {
      sendJson(res, 400, { error: 'bad_request', error_description: 'Malformed URL' });
      return;
    }
    const method = (req.method || 'GET').toUpperCase();
    const reqPath = normalizePath(url.pathname);

    let parsed;
    try {
      parsed = await parseRequestBody(req);
    } catch (error) {
      const { status, payload } = errorPayload(error);
      sendJson(res, status, payload);
      logRequest({ method, path: reqPath, status, bytes: 0, ms: Number(process.hrtime.bigint() - started) / 1e6 });
      return;
    }

    let status = 200;
    let bytes = 0;
    let note = '';
    try {
      const match = matchEndpoint(method, reqPath);
      if (match) {
        const ctx = {
          req,
          res,
          url,
          method,
          path: reqPath,
          body: parsed.body,
          text: parsed.text,
          raw: parsed.raw,
          db,
          assetRoot,
          params: match.params,
          logNote: ''
        };
        const result = await match.endpoint.handler(ctx);
        if (!result) throw new Error(`Handler for ${match.endpoint.id} returned no result`);
        const payload = result.body;
        const body = Buffer.from(payload === undefined || payload === null ? '' : JSON.stringify(payload));
        status = result.status || 200;
        res.writeHead(status, {
          'content-type': 'application/json; charset=utf-8',
          'content-length': body.length,
          'cache-control': 'no-store',
          ...(result.headers || {})
        });
        res.end(body);
        bytes = body.length;
        note = ctx.logNote || '';
      } else {
        const asset = serveAsset(req, res, { requestPath: reqPath, assetRoot, mediaRoot });
        if (asset) {
          status = asset.status;
          bytes = asset.bytes;
          note = 'asset';
        } else {
          const dashboard = await handleDashboard({ req, res, method, path: reqPath, db, body: parsed.body });
          if (dashboard) {
            status = dashboard.status;
            bytes = dashboard.bytes;
            note = 'dashboard';
          } else {
            status = 404;
            const preview =
              globalConfig.logUnknownBodyPreview > 0 && parsed.text
                ? parsed.text.slice(0, globalConfig.logUnknownBodyPreview)
                : '';
            logUnknown({
              method,
              path: reqPath,
              bodySize: parsed.raw.length,
              contentType: req.headers['content-type'],
              preview,
              raw: parsed.raw,
              headers: req.headers
            });
            const body = Buffer.from(
              JSON.stringify({ error: 'not_found', error_description: `No route for ${method} ${reqPath}` })
            );
            res.writeHead(404, {
              'content-type': 'application/json; charset=utf-8',
              'content-length': body.length
            });
            res.end(body);
            bytes = body.length;
          }
        }
      }
    } catch (error) {
      const { status: errorStatus, payload } = errorPayload(error);
      status = errorStatus;
      if (errorStatus === 500) console.error('[error]', error);
      const body = Buffer.from(JSON.stringify(payload));
      res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': body.length
      });
      res.end(body);
      bytes = body.length;
    }

    logRequest({
      method,
      path: reqPath,
      status,
      bytes,
      ms: Math.round(Number(process.hrtime.bigint() - started) / 1e6),
      note
    });
  });

  return { server, db, seedResult };
}

export async function start({ port = globalConfig.port, host = globalConfig.host, ...options } = {}) {
  const app = createApp(options);
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(port, host, resolve);
  });
  const address = app.server.address();
  if (!process.env.FREVERS_PUBLIC_BASE_URL) {
    const advertisedHost = host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;
    setPublicBaseUrl(`http://${advertisedHost}:${address.port}`);
  }
  console.log(`[frevers] listening on http://${host}:${address.port}`);
  if (app.seedResult.created.length > 0) {
    console.log(`[frevers] seeded accounts: ${app.seedResult.created.join(', ')}`);
  }
  if (app.seedResult.credentialsPath) {
    console.log(`[frevers] generated passwords written to ${app.seedResult.credentialsPath}`);
  }
  console.log('[frevers] log every request; unknown routes are logged as [unknown-route]');
  return app;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain || process.env.FREVERS_AUTOSTART === '1') {
  start().catch((error) => {
    console.error('[frevers] failed to start:', error);
    process.exitCode = 1;
  });
}
