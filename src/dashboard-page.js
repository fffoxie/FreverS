import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';

const rootDir = config?.rootDir || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDashboardPath = path.join(rootDir, 'public', 'dashboard.html');

export function renderPage() {
  try {
    return fs.readFileSync(publicDashboardPath, 'utf8');
  } catch (err) {
    return `<!doctype html><html><body><h1>FreverS Dashboard</h1><p>Error loading dashboard.html: ${err.message}</p></body></html>`;
  }
}
