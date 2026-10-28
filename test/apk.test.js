import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { patchMetadata, normalizeBaseUrl, FREVER_HOSTS, MAX_BASE_URL_LENGTH } from '../src/apk/metadata.js';
import { patchManifest } from '../src/apk/manifest.js';

function syntheticMetadata() {
  const buffer = Buffer.alloc(0x400);
  buffer.writeUInt32LE(0xfab11baf, 0);
  buffer.writeInt32LE(29, 4);
  const tableOffset = 0x40;
  const dataOffset = 0x100;
  const data = Buffer.concat(FREVER_HOSTS.map((host) => Buffer.from(host)));
  buffer.writeInt32LE(tableOffset, 8);
  buffer.writeInt32LE(FREVER_HOSTS.length * 8, 12);
  buffer.writeInt32LE(dataOffset, 16);
  buffer.writeInt32LE(data.length, 20);
  let index = 0;
  for (let i = 0; i < FREVER_HOSTS.length; i += 1) {
    buffer.writeUInt32LE(FREVER_HOSTS[i].length, tableOffset + i * 8);
    buffer.writeUInt32LE(index, tableOffset + i * 8 + 4);
    index += FREVER_HOSTS[i].length;
  }
  data.copy(buffer, dataOffset);
  return buffer;
}

test('patchMetadata replaces every host and updates literal lengths', () => {
  const source = syntheticMetadata();
  const result = patchMetadata(source, 'http://127.0.0.1:8080/');
  assert.equal(result.report.baseUrl, 'http://127.0.0.1:8080');
  assert.equal(result.report.replacements.length, FREVER_HOSTS.length);
  for (const host of FREVER_HOSTS) {
    assert.equal(result.buffer.includes(Buffer.from(host)), false, `${host} should be gone`);
  }
  assert.equal(result.buffer.toString('utf8').split('http://127.0.0.1:8080').length - 1, FREVER_HOSTS.length);
});

test('patchMetadata rejects URLs longer than the shortest Frever host slot', () => {
  const source = syntheticMetadata();
  const tooLong = `http://${'a'.repeat(MAX_BASE_URL_LENGTH)}`;
  assert.throws(() => patchMetadata(source, tooLong), /at most|maximum|characters/i);
});

test('normalizeBaseUrl fills the scheme, strips slashes and rejects paths', () => {
  assert.equal(normalizeBaseUrl('192.168.1.42:8080/'), 'http://192.168.1.42:8080');
  assert.equal(normalizeBaseUrl('http://phone:8080///'), 'http://phone:8080');
  assert.throws(() => normalizeBaseUrl('http://phone:8080/foo'), /path/);
});

test(
  'patchManifest lowers minSdk/targetSdk in the real Frever 4.0.5 manifest',
  { skip: !fs.existsSync('/workspace/analysis/apk/AndroidManifest.xml') },
  () => {
    const source = fs.readFileSync('/workspace/analysis/apk/AndroidManifest.xml');
    const { buffer, report } = patchManifest(source);
    assert.equal(buffer.length, source.length);
    const target = report.changed.find((entry) => entry.attribute === 'targetSdkVersion');
    const min = report.changed.find((entry) => entry.attribute === 'minSdkVersion');
    assert.equal(target.from, 34);
    assert.equal(target.to, 27);
    assert.equal(min.from, 28);
    assert.equal(min.to, 27);
  }
);
