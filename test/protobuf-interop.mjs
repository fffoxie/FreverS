import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, describe } from 'node:test';
import protobuf from 'protobufjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const schemasDir = path.join(rootDir, 'docs', 'schemas', 'start-pack');

describe('Protobuf Start-Pack Schemas Interoperability', () => {
  test('Node.js encodes and decodes PreFetchPack, DefaultUserAssets, and MetadataPack', async () => {
    const root = new protobuf.Root();
    root.resolvePath = (origin, target) => {
      return path.resolve(schemasDir, path.basename(target));
    };
    await root.load([
      path.join(schemasDir, 'Common.proto'),
      path.join(schemasDir, 'PreFetchPack.proto'),
      path.join(schemasDir, 'DefaultUserAssets.proto'),
      path.join(schemasDir, 'MetadataPack.proto')
    ], { keepCase: false });

    const PreFetchPack = root.lookupType('frever.startpack.prefetch.PreFetchPack');
    const DefaultUserAssets = root.lookupType('frever.startpack.userassets.DefaultUserAssets');
    const MetadataPack = root.lookupType('frever.startpack.metadata.MetadataPack');

    // 1. PreFetchPack roundtrip
    const preFetchObj = {
      bodyAnimations: [
        {
          id: 1001,
          files: [{ version: '1.0', unityVersion: '2022.3.28f1', file: 1, extension: 2, source: 0 }]
        }
      ]
    };
    const preFetchBuf = PreFetchPack.encode(PreFetchPack.create(preFetchObj)).finish();
    const preFetchDecoded = PreFetchPack.decode(preFetchBuf);
    assert.equal(preFetchDecoded.bodyAnimations[0].id.toString(), '1001');
    assert.equal(preFetchDecoded.bodyAnimations[0].files[0].unityVersion, '2022.3.28f1');

    // 2. DefaultUserAssets roundtrip
    const userAssetsObj = {
      mainCharacterId: 42,
      templateId: 505,
      hasInvitationReward: true,
      purchasedAssetsData: { wardrobes: [10, 20], bodyAnimations: [30] },
      userCharacters: [{ id: 42, name: 'Maya', genderId: 1, raceId: 2 }]
    };
    const userAssetsBuf = DefaultUserAssets.encode(DefaultUserAssets.create(userAssetsObj)).finish();
    const userAssetsDecoded = DefaultUserAssets.decode(userAssetsBuf);
    assert.equal(userAssetsDecoded.mainCharacterId.toString(), '42');
    assert.equal(userAssetsDecoded.userCharacters[0].name, 'Maya');

    // 3. MetadataPack roundtrip
    const metadataObj = {
      unlockVideoToFeedOnLevel: 5,
      unlockCrewCreationOnLevel: 10,
      editorMetadata: { canCreateCharacters: true },
      wardrobeCategories: [{ id: 1, name: 'Tops', sortOrder: 1 }]
    };
    const metadataBuf = MetadataPack.encode(MetadataPack.create(metadataObj)).finish();
    const metadataDecoded = MetadataPack.decode(metadataBuf);
    assert.equal(metadataDecoded.wardrobeCategories[0].name, 'Tops');
  });
});
