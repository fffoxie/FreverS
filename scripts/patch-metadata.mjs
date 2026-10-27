// Patch the API host literals inside Unity IL2CPP global-metadata.dat.
//
// Measured layout (Frever 4.0.5, metadata v29): the string-literal table at
// header offset 8 holds 8-byte entries {uint32 length, uint32 dataOffset}; the
// text itself lives in a separate blob WITHOUT a length prefix. So a literal can
// be replaced in place by any string that is not longer than the original, as
// long as the entry's length field is rewritten. Longer strings do not fit.
//
// usage: node scripts/patch-metadata.mjs <global-metadata.dat> <new-base-url>
import fs from 'node:fs';

const HOSTS = [
  'https://content-prod.frever-api.com/',
  'https://content-prod-us.frever-api.com/',
  'https://content-stage.frever-api.com/',
  'https://content-test.frever-api.com/',
  'https://dev.frever-api.com/'
];

export function patchMetadata(buffer, newUrl) {
  if (buffer.readUInt32LE(0) !== 0xfab11baf) throw new Error('not a global-metadata.dat (bad magic)');
  const tableOffset = buffer.readInt32LE(8);
  const tableSize = buffer.readInt32LE(12);
  const dataOffset = buffer.readInt32LE(16);
  const dataSize = buffer.readInt32LE(20);
  const wanted = new Map(HOSTS.map((h) => [h, false]));
  const report = [];
  for (let i = 0; i < tableSize / 8; i++) {
    const entry = tableOffset + i * 8;
    const length = buffer.readUInt32LE(entry);
    const rel = buffer.readUInt32LE(entry + 4);
    if (length < 20 || length > 64 || rel + length > dataSize) continue;
    const start = dataOffset + rel;
    const text = buffer.toString('utf8', start, start + length);
    if (!wanted.has(text)) continue;
    wanted.set(text, true);
    if (newUrl.length > length) {
      report.push({ host: text, patched: false, reason: `new URL (${newUrl.length}) longer than literal (${length})` });
      continue;
    }
    buffer.fill(0, start, start + length);
    buffer.write(newUrl, start, 'utf8');
    buffer.writeUInt32LE(newUrl.length, entry);
    report.push({ host: text, patched: true, oldLength: length, newLength: newUrl.length });
  }
  for (const [host, seen] of wanted) if (!seen) report.push({ host, patched: false, reason: 'literal not found' });
  return report;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const [file, url] = process.argv.slice(2);
  if (!file || !/^http:\/\/[A-Za-z0-9.\-]+(:\d+)?\/$/.test(url || '')) {
    console.error('usage: node scripts/patch-metadata.mjs <global-metadata.dat> http://<host>[:port]/');
    process.exit(2);
  }
  const buffer = fs.readFileSync(file);
  const report = patchMetadata(buffer, url);
  for (const r of report) console.log(JSON.stringify(r));
  const production = report.find((r) => r.host === HOSTS[0]);
  if (!production || !production.patched) {
    console.error('production host was not patched; refusing to write');
    process.exit(1);
  }
  fs.writeFileSync(file, buffer);
  console.log(`patched ${report.filter((r) => r.patched).length}/${HOSTS.length} host literals`);
}
