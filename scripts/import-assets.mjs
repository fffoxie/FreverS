import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'data', 'assets');

export function ensureAssetStoreDirectories() {
  const dirs = [
    assetsDir,
    path.join(assetsDir, 'bundles', 'Android'),
    path.join(assetsDir, 'thumbs'),
    path.join(assetsDir, 'manifest')
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function importAssetFile(sourcePath, { name, type = 'bundle', author = 'Unknown' } = {}) {
  ensureAssetStoreDirectories();
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source file does not exist: ${sourcePath}`);
  }
  const content = fs.readFileSync(sourcePath);
  const hash = createHash('sha256').update(content).digest('hex');
  const filename = name || path.basename(sourcePath);
  const targetBundlePath = path.join(assetsDir, 'bundles', 'Android', filename);

  fs.writeFileSync(targetBundlePath, content);

  const manifest = {
    id: filename,
    type,
    name: filename,
    author,
    license: 'Local Import',
    source: sourcePath,
    hash,
    importedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(assetsDir, 'manifest', `${filename}.json`), JSON.stringify(manifest, null, 2));

  updateCatalog(manifest);
  return manifest;
}

export function updateCatalog(manifest) {
  const catalogPath = path.join(assetsDir, 'catalog.json');
  let catalog = [];
  try {
    if (fs.existsSync(catalogPath)) {
      catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    }
  } catch {
    catalog = [];
  }
  const index = catalog.findIndex((item) => item.id === manifest.id);
  if (index >= 0) {
    catalog[index] = manifest;
  } else {
    catalog.push(manifest);
  }
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/import-assets.mjs <source-file-or-dir>');
    process.exit(1);
  }
  const source = args[0];
  if (fs.statSync(source).isDirectory()) {
    const files = fs.readdirSync(source);
    for (const f of files) {
      const fullPath = path.join(source, f);
      if (fs.statSync(fullPath).isFile()) {
        importAssetFile(fullPath);
        console.log(`[import-assets] Imported ${f}`);
      }
    }
  } else {
    importAssetFile(source);
    console.log(`[import-assets] Imported ${source}`);
  }
}
