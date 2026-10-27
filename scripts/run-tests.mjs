// Runs the test suite and records the result for the dashboard checklist.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(process.execPath, ['--test', 'test/'], { cwd: root, encoding: 'utf8', stdio: 'inherit' });
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'data', 'test-status.json'),
  JSON.stringify({ ok: result.status === 0, at: new Date().toISOString(), exitCode: result.status }, null, 2)
);
process.exit(result.status || 0);
