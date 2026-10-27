import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

export function logFilePath() {
  return process.env.FREVERS_LOG_FILE || config.logFile;
}

function emit(line) {
  console.log(line);
  const file = logFilePath();
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} ${line}\n`);
  } catch {
    // logging must never break a request
  }
}

export class HttpError extends Error {
  constructor(status, message, code) {
    super(message);
    this.status = status;
    this.code = code || undefined;
  }
}

export function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > config.maxBodyBytes) {
        reject(new HttpError(413, 'Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function parseMultipart(buffer, boundary) {
  const result = {};
  const delimiter = Buffer.from(`--${boundary}`);
  let position = buffer.indexOf(delimiter);
  while (position !== -1) {
    const start = position + delimiter.length;
    const next = buffer.indexOf(delimiter, start);
    if (next === -1) break;
    const part = buffer.subarray(start, next);
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const body = part.subarray(headerEnd + 4, part.length - 2);
      const nameMatch = /name="([^"]*)"/i.exec(headers);
      if (nameMatch) {
        result[nameMatch[1]] = body.toString('utf8');
      }
    }
    position = next;
  }
  return result;
}

export async function parseRequestBody(req) {
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  const raw = await readBody(req);
  const text = raw.toString('utf8');
  if (raw.length === 0) return { raw, text, body: {}, contentType };
  if (contentType.includes('application/json')) {
    try {
      return { raw, text, body: JSON.parse(text), contentType };
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return { raw, text, body: Object.fromEntries(new URLSearchParams(text)), contentType };
  }
  if (contentType.includes('multipart/form-data')) {
    const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
    const boundary = match ? (match[1] || match[2]).trim() : null;
    if (!boundary) throw new HttpError(400, 'Missing multipart boundary');
    return { raw, text, body: parseMultipart(raw, boundary), contentType };
  }
  // Last resort: accept a form-encoded body, as some Unity HTTP helpers omit
  // the content type on small requests.
  try {
    const parsed = Object.fromEntries(new URLSearchParams(text));
    return { raw, text, body: parsed, contentType };
  } catch {
    return { raw, text, body: { value: text }, contentType };
  }
}

export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = Buffer.from(JSON.stringify(payload));
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.length,
    'cache-control': 'no-store',
    ...extraHeaders
  });
  res.end(body);
}

export function sendEmpty(res, status = 200) {
  res.writeHead(status, { 'content-length': '0', 'cache-control': 'no-store' });
  res.end();
}

export function logRequest(entry) {
  if (!config.logRequests) return;
  const { method, path, status, bytes, ms, note } = entry;
  const suffix = note ? ` ${note}` : '';
  emit(`[http] ${method} ${path} ${status} ${bytes}B ${ms}ms${suffix}`);
}

export function logUnknown({ method, path, bodySize, contentType, preview }) {
  emit(
    `[unknown-route] method=${method} path=${path} bodySize=${bodySize} contentType=${contentType || '-'}` +
      (preview ? ` body=${JSON.stringify(preview)}` : '')
  );
}

export function logCapturedRequest({ method, path: reqPath, headers = {}, body = null }) {
  const sanitizeHeaders = { ...headers };
  delete sanitizeHeaders.authorization;
  delete sanitizeHeaders.cookie;
  delete sanitizeHeaders['x-access-token'];

  const entry = {
    timestamp: new Date().toISOString(),
    method,
    path: reqPath,
    headers: sanitizeHeaders,
    body
  };

  const captureDir = path.join(config.rootDir, 'data', 'capture');
  try {
    fs.mkdirSync(captureDir, { recursive: true });
    fs.appendFileSync(path.join(captureDir, 'capture.jsonl'), JSON.stringify(entry) + '\n');
  } catch {
    // capture must never break request handling
  }
}
