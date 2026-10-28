import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'data', 'assets');
const catalogPath = path.join(assetsDir, 'catalog.json');
const overridesPath = path.join(rootDir, 'data', 'catalog-overrides.json');

export function reconstructCatalog() {
  const manifestsDir = path.join(assetsDir, 'manifest');
  let items = [];

  if (fs.existsSync(manifestsDir)) {
    const files = fs.readdirSync(manifestsDir);
    for (const f of files) {
      if (f.endsWith('.json')) {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(manifestsDir, f), 'utf8'));
          items.push({
            id: data.id,
            name: data.id.replace(/\.[^/.]+$/, ''),
            type: data.type || 'bundle',
            hash: data.hash,
            size: data.size,
            unlocked: true,
            price: 0
          });
        } catch {
          // skip invalid json
        }
      }
    }
  }

  if (fs.existsSync(overridesPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
      if (Array.isArray(overrides)) {
        for (const override of overrides) {
          const index = items.findIndex((i) => i.id === override.id);
          if (index >= 0) {
            items[index] = { ...items[index], ...override };
          } else {
            items.push(override);
          }
        }
      }
    } catch {
      // skip invalid overrides
    }
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(catalogPath, JSON.stringify(items, null, 2));
  return items;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const catalog = reconstructCatalog();
  console.log(`[reconstruct-catalog] Catalog reconstructed with ${catalog.length} items at ${catalogPath}`);
}
