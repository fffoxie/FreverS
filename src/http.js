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

export function logUnknown({ method, path, bodySize, contentType, preview, raw, headers }) {
  emit(
    `[unknown-route] method=${method} path=${path} bodySize=${bodySize} contentType=${contentType || '-'}` +
      (preview ? ` body=${JSON.stringify(preview)}` : '')
  );
  if (process.env.FREVERS_CAPTURE === '1') {
    try {
      const captureDir = path.join(path.dirname(logFilePath()), 'capture');
      fs.mkdirSync(captureDir, { recursive: true });
      const filename = `capture_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`;
      const sanitizedHeaders = { ...headers };
      delete sanitizedHeaders['authorization'];
      delete sanitizedHeaders['cookie'];
      const record = {
        timestamp: new Date().toISOString(),
        method,
        path,
        headers: sanitizedHeaders,
        bodyPreview: preview || (raw ? raw.toString('utf8').slice(0, 1000) : '')
      };
      fs.writeFileSync(path.join(captureDir, filename), JSON.stringify(record, null, 2));
    } catch {
      // capture write fail should not crash request
    }
  }
}
