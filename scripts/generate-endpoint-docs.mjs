import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { endpoints } from '../src/endpoints.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outputPath = path.join(rootDir, 'docs', 'ENDPOINTS.md');

let content = '# FreverS Endpoint Inventory\n\n';
content += '| Endpoint ID | Method | Primary Path | Description | Status |\n';
content += '| --- | --- | --- | --- | --- |\n';

for (const ep of endpoints) {
  const primaryPath = ep.paths && ep.paths.length > 0 ? ep.paths[0] : '-';
  const desc = ep.description || '';
  content += `| \`${ep.id}\` | \`${ep.method}\` | \`${primaryPath}\` | ${desc} | \`implemented\` |\n`;
}

fs.writeFileSync(outputPath, content, 'utf8');
console.log(`[generate-endpoint-docs] Written ${endpoints.length} endpoints to ${outputPath}`);
