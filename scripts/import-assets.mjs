import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'data', 'assets');
const vendorDir = path.join(rootDir, 'vendor');

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

export function importAssetFile(sourcePath, { name, type = 'bundle', category = 'general', author = 'Unknown' } = {}) {
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
    category,
    name: filename,
    author,
    license: 'Local Import',
    source: sourcePath,
    hash,
    importedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(assetsDir, 'manifest', `${filename}.json`), JSON.stringify(manifest, null, 2));

  updateManifestLists(manifest);
  return manifest;
}

export function updateManifestLists(manifest) {
  if (manifest.category === 'map' || manifest.id.includes('setlocation')) {
    appendLineUnique(path.join(assetsDir, 'maps.txt'), manifest.id);
  } else if (manifest.category === 'animation' || manifest.id.includes('animation')) {
    appendLineUnique(path.join(assetsDir, 'animations.txt'), manifest.id);
  }
}

function appendLineUnique(filePath, line) {
  let existing = [];
  try {
    if (fs.existsSync(filePath)) {
      existing = fs.readFileSync(filePath, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
    }
  } catch {
    existing = [];
  }
  if (!existing.includes(line)) {
    existing.push(line);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, existing.join('\n') + '\n', 'utf8');
  }
}

export function scanVendorRepos() {
  ensureAssetStoreDirectories();
  if (!fs.existsSync(vendorDir)) {
    console.log('[import-assets] vendor/ directory does not exist yet. Run scripts/fetch-vendor.sh first.');
    return;
  }

  const entries = fs.readdirSync(vendorDir, { withFileTypes: true });
  let importedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const repoName = entry.name;
    const repoPath = path.join(vendorDir, repoName);

    let category = 'general';
    if (repoName.includes('setlocation')) category = 'map';
    else if (repoName.includes('animation')) category = 'animation';
    else if (repoName.includes('wardrobe') || repoName.includes('uma')) category = 'wardrobe';

    const assetManifest = {
      id: repoName,
      type: repoName.includes('tool') ? 'tool' : 'package',
      category,
      name: repoName,
      author: 'FriendFactory',
      license: 'MIT',
      source: repoPath,
      importedAt: new Date().toISOString()
    };

    fs.writeFileSync(
      path.join(assetsDir, 'manifest', `${repoName}.json`),
      JSON.stringify(assetManifest, null, 2)
    );

    updateManifestLists(assetManifest);
    importedCount++;
  }

  console.log(`[import-assets] Cataloged ${importedCount} vendored assets in data/assets/manifest/`);
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    scanVendorRepos();
  } else {
    const source = args[0];
    if (fs.existsSync(source) && fs.statSync(source).isDirectory()) {
      const files = fs.readdirSync(source);
      for (const f of files) {
        const fullPath = path.join(source, f);
        if (fs.statSync(fullPath).isFile()) {
          importAssetFile(fullPath);
          console.log(`[import-assets] Imported file ${f}`);
        }
      }
    } else if (fs.existsSync(source)) {
      importAssetFile(source);
      console.log(`[import-assets] Imported ${source}`);
    } else {
      scanVendorRepos();
    }
  }
}
