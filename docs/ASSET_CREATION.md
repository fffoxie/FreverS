# FreverS Asset Creation, Conversion & Catalog Guide

This guide details how to create, convert, package, and import custom characters, outfits, makeup, accessories, custom maps (sets), animations, and facial expressions for **FreverS (Frever RDT)**.

---

## 1. Overview & Architecture

Frever 4.0.5 uses Unity **2022.3.28f1** with **UMA (Unity Multipurpose Avatar)** for character recipes and wardrobe slots. All content is delivered dynamically as Unity **AssetBundles** targeting **Android** (`armeabi-v7a`).

### Supported Categories:
- **Wardrobe Items:** Clothing (Tops, Bottoms, Shoes), Accessories (Hats, Scarves, Glasses), Makeup (Eye, Lip, Face overlays).
- **Characters:** Base UMA recipes, DNA slider presets, Star Creators profiles.
- **Custom Maps / Sets:** 3D Unity scenes packaged as AssetBundles.
- **Animations:** Body FBX motion clips and ARKit 52 facial blendshape curves.

---

## 2. Converting VRChat Avatars (VRChat -> Frever UMA)

VRChat avatars use standard Humanoid rigs with VRC components. Because Frever expects UMA bone hierarchies and DNA sliders, VRChat avatars must be retargeted and converted before packaging.

### Step 1: Retargeting in Blender
1. Import your VRChat `.fbx` or `.glb` model into Blender.
2. Ensure unit scale is set to `1.0` and axes match Unity standard (`+Y Up`, `-Z Forward`).
3. Rename the armature bones to standard Frever/UMA conventions (`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `UpperArm_L`, `LowerArm_L`, `Hand_L`, etc.).
4. Reduce polygon count for mobile performance:
   - **Accessories / Hats:** Under 5,000 triangles, 1x 1024x1024 ASTC/ETC2 texture.
   - **Outfits:** Under 15,000 triangles, 1x 2048x2048 texture.

### Step 2: Mapping ARKit 52 Blendshapes for Face Animations & Sliders
Frever's facial system uses 52 ARKit blendshape keys. Map VRChat viseme shape keys in Blender as follows:
- `vrc.v_aa` -> `jawOpen`
- `vrc.v_ih` -> `jawOpen` + `mouthFunnel`
- `vrc.v_smile` -> `mouthSmile_L`, `mouthSmile_R`
- `vrc.v_blink` -> `eyeBlink_L`, `eyeBlink_R`

---

## 3. Creating Custom Maps & Animations

### Custom Maps / Sets
1. Build your environment scene in Unity 2022.3.28f1 or export as an `.fbx` with baked lighting/textures.
2. Package the scene into an AssetBundle named `map_<name>` using ASTC texture compression.
3. Place the bundle into `data/assets/bundles/Android/map_<name>` and register it with `scripts/import-assets.mjs`.

### Animations & Facial Curves
1. Body motions (Mixamo FBX): Import into Blender or Unity, retarget to the Frever skeleton, and save as an animation AssetBundle.
2. Facial curves: Save curve keyframes using ARKit 52 blendshape names into `assets/animation.txt` or ingest via `scripts/import-assets.mjs`.

---

## 4. Ingesting Content into the Asset Catalog

Run the import tool from Termux on Android or from Linux/PC:

```bash
# Ingest single AssetBundle or FBX file
node scripts/import-assets.mjs path/to/my_custom_item.bundle

# Ingest an entire directory of bundles
node scripts/import-assets.mjs /sdcard/Download/frever_assets/
```

This updates `data/assets/catalog.json` and creates a manifest in `data/assets/manifest/`.

---

## 5. Delivery Routes (what the client can download)

The Node.js server serves the asset store directly from `data/` (the directory
that also holds `frever.db`, so `FREVERS_DB_PATH` moves both together):

| Request | File on disk | Content-Type |
| --- | --- | --- |
| `GET /assets/bundles/Android/<name>` | `data/assets/bundles/Android/<name>` | `application/octet-stream` |
| `GET /assets/catalog.json` | `data/assets/catalog.json` | `application/json` |
| `GET /assets/maps.txt`, `/assets/animations.txt` | `data/assets/*.txt` | `text/plain` |
| `GET /media/<name>` | `data/videos/<name>` | `video/mp4`, `video/webm`, ... |

Responses include `ETag` (size + mtime), `Last-Modified`, `Accept-Ranges: bytes`
and `Cache-Control: public, max-age=300`. `Range` requests return `206` with
`Content-Range`; `If-None-Match` revalidation returns `304`; missing files return
a JSON `404`. Requests that resolve outside `data/assets` or `data/videos`
(traversal) are rejected with the same JSON `404`.

`GET /assets/maps` and `GET /assets/animations` are API routes, not files: they
return `{"maps":[...]}` / `{"animations":[...]}` read from `maps.txt` /
`animations.txt`.

> Not yet implemented: the `AssetBundleIndex` metadata document described in
> [`CLIENT_CONTRACT.md`](CLIENT_CONTRACT.md) §1.2. `data/assets/catalog.json` is
> produced locally, but neither its download path nor the client's expected
> field names have been confirmed from the binary or a device trace. See
> [`ASSET_DELIVERY_AUDIT.md`](ASSET_DELIVERY_AUDIT.md).

