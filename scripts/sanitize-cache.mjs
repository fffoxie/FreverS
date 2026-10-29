import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sensitivePatterns = [
  /token/i,
  /credential/i,
  /password/i,
  /auth/i,
  /session/i,
  /user/i,
  /\.json$/i
];

export function sanitizeCacheFolder(targetDir) {
  if (!fs.existsSync(targetDir)) {
    throw new Error(`Directory does not exist: ${targetDir}`);
  }

  let removedCount = 0;

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const isSensitive = sensitivePatterns.some((pattern) => pattern.test(entry.name));
        if (isSensitive) {
          try {
            fs.unlinkSync(fullPath);
            removedCount++;
            console.log(`[sanitize-cache] Removed potential sensitive file: ${fullPath}`);
          } catch {
            // ignore
          }
        }
      }
    }
  }

  walk(targetDir);
  return { removedCount };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node scripts/sanitize-cache.mjs <target-folder>');
    process.exit(1);
  }
  const result = sanitizeCacheFolder(args[0]);
  console.log(`[sanitize-cache] Sanitization complete. Removed ${result.removedCount} sensitive files.`);
}
