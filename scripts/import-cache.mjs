import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'data', 'assets');
const rawDir = path.join(assetsDir, 'raw');

export function ensureCacheDirectories() {
  const dirs = [
    assetsDir,
    rawDir,
    path.join(assetsDir, 'bundles', 'Android'),
    path.join(assetsDir, 'thumbs'),
    path.join(assetsDir, 'manifest')
  ];
  for (const dir of dirs) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function isUnityFsBundle(buffer) {
  if (!buffer || buffer.length < 7) return false;
  return buffer.subarray(0, 7).toString('ascii') === 'UnityFS';
}

export function importCacheFolder(targetDir) {
  ensureCacheDirectories();
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Target cache directory does not exist: ${targetDir}`);
  }

  const report = {
    scanned: 0,
    imported: 0,
    rejected: 0,
    bundles: []
  };

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        report.scanned++;
        try {
          const content = fs.readFileSync(fullPath);
          if (isUnityFsBundle(content)) {
            const hash = createHash('sha256').update(content).digest('hex');
            const rawPath = path.join(rawDir, hash);
            fs.writeFileSync(rawPath, content);

            const filename = path.basename(fullPath);
            const bundlePath = path.join(assetsDir, 'bundles', 'Android', filename);
            fs.writeFileSync(bundlePath, content);

            const manifest = {
              id: filename,
              hash,
              size: content.length,
              sourcePath: fullPath,
              format: 'UnityFS',
              importedAt: new Date().toISOString()
            };
            fs.writeFileSync(
              path.join(assetsDir, 'manifest', `${filename}.json`),
              JSON.stringify(manifest, null, 2)
            );

            report.imported++;
            report.bundles.push(manifest);
          } else {
            report.rejected++;
          }
        } catch {
          report.rejected++;
        }
      }
    }
  }

  walk(targetDir);
  return report;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/import-cache.mjs <cache-folder-path>');
    process.exit(1);
  }
  const result = importCacheFolder(args[0]);
  console.log(`[import-cache] Scanned ${result.scanned} files. Imported ${result.imported} UnityFS bundles.`);
}
