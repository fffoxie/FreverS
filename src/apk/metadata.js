/**
 * Patch the five Frever API host literals inside global-metadata.dat.
 *
 * IL2CPP stores string literals as a table of { length, dataIndex } records
 * (8 bytes each) plus a concatenated UTF-8 data block. The host strings are
 * plain UTF-8 in that block and each is referenced by exactly one table record.
 * We overwrite the bytes and the record length; no offsets move, so the rest of
 * the metadata stays valid.
 */
import { Buffer } from 'node:buffer';

export const FREVER_HOSTS = [
  'https://content-prod.frever-api.com/',
  'https://content-prod-us.frever-api.com/',
  'https://content-stage.frever-api.com/',
  'https://content-test.frever-api.com/',
  'https://dev.frever-api.com/'
];

const HEADER_OFFSETS = {
  stringLiteralOffset: 8,
  stringLiteralCount: 12,
  stringLiteralDataOffset: 16,
  stringLiteralDataCount: 20
};

export function normalizeBaseUrl(input) {
  let value = String(input || '').trim();
  if (!value) throw new Error('A server URL is required');
  if (!/^https?:\/\//i.test(value)) value = `http://${value}`;
  value = value.replace(/\/+$/, '');
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid server URL: ${input}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Server URL must use http:// or https://');
  }
  if (url.hostname.includes(':')) {
    throw new Error('IPv6 addresses are not supported by the APK patcher; use an IPv4 address or hostname');
  }
  if (url.pathname && url.pathname !== '/') {
    throw new Error('Server URL must not contain a path; use scheme://host:port');
  }
  return `${url.protocol}//${url.host}`;
}

/**
 * The shortest Frever host literal is "https://dev.frever-api.com/" (27 bytes),
 * so the replacement URL cannot exceed that without rewriting metadata offsets.
 */
export const MAX_BASE_URL_LENGTH = Math.min(...FREVER_HOSTS.map((host) => host.length));

export function patchMetadata(source, baseUrl) {
  const target = normalizeBaseUrl(baseUrl);
  if (target.length > MAX_BASE_URL_LENGTH) {
    throw new Error(
      `Server URL "${target}" is ${target.length} characters; the APK allows at most ` +
        `${MAX_BASE_URL_LENGTH}. Use a shorter IPv4 address or hostname (e.g. http://phone:8080).`
    );
  }

  const buffer = Buffer.from(source);
  if (buffer.length < 64) throw new Error('global-metadata.dat is too small');
  const sanity = buffer.readUInt32LE(0);
  const version = buffer.readInt32LE(4);
  if (sanity !== 0xfab11baf) {
    throw new Error(`Unexpected metadata sanity 0x${sanity.toString(16)}`);
  }
  const literalOffset = buffer.readInt32LE(HEADER_OFFSETS.stringLiteralOffset);
  const literalCount = buffer.readInt32LE(HEADER_OFFSETS.stringLiteralCount);
  const dataOffset = buffer.readInt32LE(HEADER_OFFSETS.stringLiteralDataOffset);
  const dataCount = buffer.readInt32LE(HEADER_OFFSETS.stringLiteralDataCount);
  if (
    literalOffset < 0 ||
    dataOffset < 0 ||
    literalCount % 8 !== 0 ||
    literalOffset + literalCount > buffer.length ||
    dataOffset + dataCount > buffer.length
  ) {
    throw new Error('global-metadata.dat has an unexpected string-literal layout');
  }

  const replacements = [];
  const targetBytes = Buffer.from(target, 'utf8');
  for (const host of FREVER_HOSTS) {
    const hostBytes = Buffer.from(host, 'utf8');
    let position = dataOffset;
    let patchedForHost = 0;
    while (position < dataOffset + dataCount) {
      const found = buffer.indexOf(hostBytes, position);
      if (found === -1 || found >= dataOffset + dataCount) break;
      const dataIndex = found - dataOffset;
      let matchedRecord = false;
      for (let record = literalOffset; record < literalOffset + literalCount; record += 8) {
        const length = buffer.readUInt32LE(record);
        const index = buffer.readUInt32LE(record + 4);
        if (index !== dataIndex) continue;
        if (length < targetBytes.length) {
          throw new Error(`Literal record for ${host} is shorter than the replacement`);
        }
        // Zero the old literal, write the new one, update its length.
        buffer.fill(0, found, found + length);
        targetBytes.copy(buffer, found);
        buffer.writeUInt32LE(targetBytes.length, record);
        matchedRecord = true;
        patchedForHost += 1;
        break;
      }
      if (!matchedRecord) {
        throw new Error(`No string-literal record found for ${host} at data index ${dataIndex}`);
      }
      position = found + hostBytes.length;
    }
    if (patchedForHost === 0) throw new Error(`Host literal not found in metadata: ${host}`);
    replacements.push({ host, target, count: patchedForHost });
  }

  return {
    buffer,
    report: {
      version,
      baseUrl: target,
      maxLength: MAX_BASE_URL_LENGTH,
      replacements
    }
  };
}
