/**
 * Minimal Android binary-XML (AXML) editor.
 *
 * We only need to change two integer attributes in <uses-sdk>:
 *   minSdkVersion 28 -> 27, targetSdkVersion 34 -> 27
 * Lowering targetSdk below 28 makes the platform's default cleartext policy
 * allow HTTP, which is required for a local server. The attribute values are
 * fixed-width, so no chunk sizes or offsets change.
 */
import { Buffer } from 'node:buffer';

const RES_XML_START_ELEMENT = 0x0102;
const RES_STRING_POOL = 0x0001;
const TYPE_INT_DEC = 0x10;
const ATTR_IDS = {
  minSdkVersion: 0x0101020c,
  targetSdkVersion: 0x01010270
};

function decodeLength(buffer, offset, lengthBytes) {
  if (lengthBytes === 1) return { value: buffer[offset], next: offset + 1 };
  const value = ((buffer[offset] & 0x7f) << 8) | buffer[offset + 1];
  return { value, next: offset + 2 };
}

function readStringPool(buffer, chunkStart) {
  const headerSize = buffer.readUInt16LE(chunkStart + 2);
  const stringCount = buffer.readUInt32LE(chunkStart + 8);
  const flags = buffer.readUInt32LE(chunkStart + 16);
  const stringsStart = buffer.readUInt32LE(chunkStart + 20);
  const utf8 = (flags & 0x100) !== 0;
  const offsets = [];
  for (let i = 0; i < stringCount; i += 1) {
    offsets.push(buffer.readUInt32LE(chunkStart + headerSize + i * 4));
  }
  const cache = new Map();
  const get = (index) => {
    if (index === 0xffffffff || index < 0 || index >= offsets.length) return null;
    if (cache.has(index)) return cache.get(index);
    const base = chunkStart + stringsStart + offsets[index];
    let value;
    if (utf8) {
      const first = decodeLength(buffer, base, buffer[base] & 0x80 ? 2 : 1);
      const second = decodeLength(buffer, first.next, buffer[first.next] & 0x80 ? 2 : 1);
      value = buffer.subarray(second.next, second.next + second.value).toString('utf8');
    } else {
      const length = buffer.readUInt16LE(base);
      value = buffer.subarray(base + 2, base + 2 + length * 2).toString('utf16le');
    }
    cache.set(index, value);
    return value;
  };
  return { get, stringCount };
}

export function patchManifest(source, { minSdk = 27, targetSdk = 27 } = {}) {
  const buffer = Buffer.from(source);
  if (buffer.length < 8 || buffer.readUInt16LE(0) !== 0x0003) {
    throw new Error('Not an Android binary XML file');
  }
  const totalSize = buffer.readUInt32LE(4);
  if (totalSize > buffer.length) throw new Error('Truncated AndroidManifest.xml');

  let pool = null;
  const changed = [];
  let position = 8;
  while (position + 8 <= totalSize) {
    const type = buffer.readUInt16LE(position);
    const headerSize = buffer.readUInt16LE(position + 2);
    const size = buffer.readUInt32LE(position + 4);
    if (size < 8 || position + size > totalSize) throw new Error('Invalid AXML chunk');
    if (type === RES_STRING_POOL && !pool) {
      pool = readStringPool(buffer, position);
    }
    if (type === RES_XML_START_ELEMENT && pool) {
      const nameIndex = buffer.readUInt32LE(position + 20);
      const elementName = pool.get(nameIndex);
      if (elementName === 'uses-sdk') {
        const attributeStart = buffer.readUInt16LE(position + 24);
        const attributeSize = buffer.readUInt16LE(position + 26);
        const attributeCount = buffer.readUInt16LE(position + 28);
        const attributesBase = position + 16 + attributeStart;
        for (let i = 0; i < attributeCount; i += 1) {
          const attr = attributesBase + i * attributeSize;
          const attrName = pool.get(buffer.readUInt32LE(attr + 4));
          const dataType = buffer[attr + 15];
          const dataOffset = attr + 16;
          if (dataType !== TYPE_INT_DEC) continue;
          if (attrName === 'minSdkVersion') {
            const oldValue = buffer.readInt32LE(dataOffset);
            buffer.writeInt32LE(minSdk, dataOffset);
            changed.push({ attribute: attrName, id: ATTR_IDS.minSdkVersion, from: oldValue, to: minSdk });
          } else if (attrName === 'targetSdkVersion') {
            const oldValue = buffer.readInt32LE(dataOffset);
            buffer.writeInt32LE(targetSdk, dataOffset);
            changed.push({ attribute: attrName, id: ATTR_IDS.targetSdkVersion, from: oldValue, to: targetSdk });
          }
        }
      }
    }
    position += size;
  }

  if (!changed.some((entry) => entry.attribute === 'targetSdkVersion')) {
    throw new Error('targetSdkVersion attribute not found in AndroidManifest.xml');
  }
  return { buffer, report: { changed, totalSize } };
}
