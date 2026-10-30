# Frever 4.0.5 Client Contract & Reverse-Engineering Technical Reference

This document summarizes findings extracted from static inspection of `com.FriendFactory.Frever` v4.0.5 (`global-metadata.dat` string literal index and IL2CPP metadata dump).

---

## 1. Asset Delivery & Bundle Architecture

### 1.1 URL Construction & Hosts
The client constructs asset bundle download requests using `AssetUrlProvider` and `AssetBundleDownloadRequest`.
Base API hostnames compiled into the binary:
- **Production (default):** `https://content-prod.frever-api.com/`
- **Production USA:** `https://content-prod-us.frever-api.com/`
- **Stage:** `https://content-stage.frever-api.com/`
- **Test:** `https://content-test.frever-api.com/`
- **Develop:** `https://dev.frever-api.com/`

When `patchMetadata` replaces `content-prod.frever-api.com` with `http://127.0.0.1:8080/`, all subsequent bundle requests point directly to FreverS.

### 1.2 AssetBundle Index & Cache System
- **Classes:** `AssetBundleIndex`, `AssetBundleIndexItem`, `AssetBundleIndexList`, `AssetsCache`, `AssetBundleReader`, `RedownloadAssetBundleIndex`.
- **On-Disk Cache Location:**
  On Android, Unity's `Caching` system and `AssetsCache` store downloaded UnityFS bundles under:
  `/sdcard/Android/data/com.FriendFactory.Frever/files/`
- **Cache Validation:** Validated via SHA-256/MD5 hashes and CRC values in the `AssetBundleIndex` DTO.

### 1.3 `AssetBundleLoadEncryptedOperation` & Encryption
- **Classes:** `AssetBundleLoadEncryptedOperation`, `BundleDecompressor`.
- **Encryption Scheme:** The client contains load paths for encrypted bundles (`AssetBundle.LoadFromMemoryAsync` with an in-memory decryption step).
- **On-Disk Form:** Bundles stored in the app's local device cache after complete download are decrypted or raw `UnityFS` archive files.

---

## 2. Avatar System & UMA Structure

- **Framework:** **UMA (Unity Multipurpose Avatar)** 2.x adapted for Frever.
- **Key Types:**
  - `UMACharacterEditor`, `UMADefaultMeshCombiner`
  - `UmaRecipe`, `UmaRecipeId`, `UmaAsset`, `UmaRaceKey`
  - `FreverDNAPreset`, `UmaDnaEditCommand`, `UmaDnaPresetCommand`
  - `UmaSharedColor`, `UmaSharedColorId`, `SharedColorTable`
  - `WardrobeCategory`, `WardrobeSubCategory`, `OutfitApplyCommand`
- **Universal Rig (`UNI_01`):** The base avatar skeleton uses the universal bone proxy hierarchy (`pelvisProxy_geo`, `spineProxy_geo`, `headProxy_geo`, `l_/r_UNI_eye`, `UNI_01_TongueBaseProxy`).

---

## 3. Catalog & API Endpoint Expectations

When the app launches and opens the character editor, it expects JSON responses from the local server for:
- `/baking/characters` (Character baking list)
- `/moderation/wardrobe/baking/availability`
- `/group/star-creators-in-your-country` (Star Creators)
- `/assets/maps` & `/assets/animations`
