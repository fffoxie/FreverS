import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { config } from './config.js';
import { logFilePath } from './http.js';
import { renderPage } from './dashboard-page.js';

const root = config.rootDir;
const statusFile = path.join(root, 'data', 'papk-status.json');
const testStatusFile = path.join(root, 'data', 'test-status.json');
const outDir = path.join(root, 'output');
const startedAt = new Date().toISOString();

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Coverage comes from docs/protocol.md: rows of §4 (implemented) and §5 (UNKNOWN). */
export function readCoverage(file = path.join(root, 'docs', 'protocol.md')) {
  let text = '';
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return { available: false, confirmed: 0, implemented: 0, unknown: 0, percent: 0 };
  }
  const section = (from, to) => {
    const start = text.search(from);
    const end = text.search(to);
    return start === -1 ? '' : text.slice(start, end === -1 ? undefined : end);
  };
  const rows = (s) => s.split('\n').filter((l) => /^\| (\d+ \| IMPLEMENTED|`)/.test(l));
  const implemented = rows(section(/^## 4\./m, /^## 5\./m)).filter((l) => !/not called by the game/.test(l)).length;
  const unknown = rows(section(/^## 5\./m, /^## 6\./m)).length;
  const confirmed = implemented + unknown;
  return {
    available: true,
    confirmed,
    implemented,
    unknown,
    percent: confirmed ? Math.round((implemented / confirmed) * 1000) / 10 : 0
  };
}

export function readCapturedEndpoints(file = path.join(root, 'data', 'capture', 'capture.jsonl')) {
  try {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n').filter(Boolean);
    const counts = {};
    for (const line of lines) {
      try {
        const item = JSON.parse(line);
        const key = `${item.method || 'GET'} ${item.path || '/'}`;
        counts[key] = (counts[key] || 0) + 1;
      } catch {
        // ignore invalid lines
      }
    }
    return Object.entries(counts).map(([endpoint, hits]) => {
      const [method, ...rest] = endpoint.split(' ');
      return { method, path: rest.join(' '), hits };
    });
  } catch {
    return [];
  }
}

function tailLines(file, n) {
  try {
    const stat = fs.statSync(file);
    const size = Math.min(stat.size, 64 * 1024);
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, stat.size - size);
    fs.closeSync(fd);
    return buf.toString('utf8').split('\n').filter(Boolean).slice(-n);
  } catch {
    return [];
  }
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      // Only RFC1918 LAN addresses: a phone will use one of these.
      if (i.family === 'IPv4' && !i.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)) out.push(i.address);
    }
  }
  return out;
}

export function buildState(db) {
  const nodeEngineReq = '22.13.0';
  const [major, minor] = process.versions.node.split('.').map(Number);
  const nodeOk = major > 22 || (major === 22 && minor >= 13);
  const accounts = db.prepare('SELECT id, username FROM users ORDER BY id').all().map((u) => ({ id: u.id, username: u.username }));
  const tests = readJson(testStatusFile, null);
  const papk = readJson(statusFile, { state: 'never-run', steps: [] });
  const ips = lanAddresses();
  const download = papk.state === 'ok' && papk.output && fs.existsSync(path.join(outDir, papk.output));
  return {
    server: { running: true, startedAt, uptimeSeconds: Math.round(process.uptime()), host: config.host, port: config.port, node: process.versions.node, nodeEngineReq, captureMode: config.captureMode },
    unimplementedEndpoints: readCapturedEndpoints(),
    checklist: [
      { id: 'dependencies', label: `Dependencies (Node ${nodeEngineReq}+)`, ok: nodeOk, detail: `node ${process.versions.node}`, command: 'bash scripts/setup-termux.sh' },
      { id: 'database', label: 'Database and accounts', ok: accounts.length >= 2, detail: `${accounts.length} accounts`, command: 'npm run seed' },
      { id: 'server', label: 'Server running', ok: true, detail: `port ${config.port}`, command: 'bash scripts/start.sh' },
      { id: 'tests', label: 'Tests passing', ok: tests ? tests.ok : null, detail: tests ? `${tests.ok ? 'passed' : 'FAILED'} at ${tests.at}` : 'not run yet', command: 'npm run test:record' }
    ],
    logs: tailLines(logFilePath(), 50),
    accounts,
    coverage: readCoverage(),
    papk: { ...papk, defaultUrl: `http://${ips[0] || '127.0.0.1'}:${config.port}/`, download: download ? `/dashboard/download/${papk.output}` : null },
    lan: ips
  };
}

function send(res, status, type, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  res.writeHead(status, { 'content-type': type, 'content-length': buf.length, 'cache-control': 'no-store', ...headers });
  res.end(buf);
  return buf.length;
}

/** Returns { status, bytes } when the request belongs to the dashboard, otherwise null. */
export async function handleDashboard({ req, res, method, path: p, db, body = {} }) {
  if (p === '/dashboard' || p === '/dashboard/') {
    if (method !== 'GET') return { status: 405, bytes: send(res, 405, 'text/plain', 'method not allowed') };
    return { status: 200, bytes: send(res, 200, 'text/html; charset=utf-8', renderPage()) };
  }
  if (p === '/dashboard/api/state' && method === 'GET') {
    return { status: 200, bytes: send(res, 200, 'application/json', JSON.stringify(buildState(db))) };
  }
  if (p === '/dashboard/api/papk' && method === 'POST') {
    // Building an APK is a local action: only loopback / LAN clients may trigger it.
    const remote = (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
    if (!/^(127\.|::1$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(remote)) {
      return { status: 403, bytes: send(res, 403, 'application/json', JSON.stringify({ error: 'local network only' })) };
    }
    const current = readJson(statusFile, { state: 'never-run' });
    const running = current.state === 'running' && Date.now() - Date.parse(current.startedAt) < 15 * 60 * 1000;
    if (running) return { status: 409, bytes: send(res, 409, 'application/json', JSON.stringify({ error: 'already running' })) };
    // The body was already parsed by the server before routing.
    const url = body && typeof body === 'object' ? String(body.url || '') : '';
    const apkPath = body && typeof body === 'object' ? String(body.apkPath || '') : '';
    const args = [path.join(root, 'scripts', 'papk.mjs')];
    if (url) args.push('--url', url);
    if (apkPath) args.push('--apk', apkPath);
    spawn(process.execPath, args, { cwd: root, detached: true, stdio: 'ignore' }).unref();
    return { status: 202, bytes: send(res, 202, 'application/json', JSON.stringify({ started: true })) };
  }
  const download = /^\/dashboard\/download\/([A-Za-z0-9_.\-]+\.apk)$/.exec(p);
  if (download && method === 'GET') {
    const file = path.join(outDir, download[1]);
    if (!fs.existsSync(file)) return { status: 404, bytes: send(res, 404, 'text/plain', 'not found') };
    return {
      status: 200,
      bytes: send(res, 200, 'application/vnd.android.package-archive', fs.readFileSync(file), {
        'content-disposition': `attachment; filename="${download[1]}"`
      })
    };
  }
  if (p.startsWith('/dashboard')) return { status: 404, bytes: send(res, 404, 'text/plain', 'not found') };
  return null;
}
