# FreverS Asset Creation Guide (Blender & VRChat to Frever RDT)

This guide explains how to create, convert, and import custom characters, outfits, accessories, and animations into **FreverS (Frever RDT)**.

---

## 1. Overview & Requirements

Frever 4.0.5 uses Unity **2022.3.28f1** and the **UMA (Unity Multipurpose Avatar)** framework. Characters and wardrobe items are loaded at runtime as Unity **AssetBundles** targeting **Android** (`armeabi-v7a`).

### Tools Needed
- **Blender (LTS 3.6 or 4.x)** (PC)
- **Unity 2022.3.28f1** (PC)
- **FreverS `freverkit`** (CLI on PC or Android Termux: `node scripts/freverkit.mjs`)

---

## 2. Avatar Compatibility & Conversion (VRChat -> Frever UMA)

VRChat avatars are standard Humanoid rigs with VRC components. They are **not drop-in compatible** with Frever's UMA slot and DNA system. They must be retargeted and converted.

### Step 1: Retargeting to the Frever Skeleton
1. Import your VRChat avatar `.fbx` or `.glb` into Blender.
2. Ensure the rig scale is `1.0` and axes are set to `+Y Up`, `-Z Forward`.
3. Retarget bone weights to the Frever skeleton bone naming conventions (`Hips`, `Spine`, `Chest`, `Neck`, `Head`, `UpperArm_L`, etc.).
4. Reduce polygon count to mobile budget:
   - **Accessories / Hats:** < 5,000 triangles, 1x 1024x1024 texture.
   - **Full Outfits:** < 15,000 triangles, 1x 2048x2048 texture.

### Step 2: ARKit 52 Blendshapes for Facial Animation
Frever requires facial blendshapes using the **ARKit 52** naming convention (`eyeBlink_L`, `eyeBlink_R`, `jawOpen`, `mouthSmile_L`, `mouthSmile_R`, `browInnerUp`, etc.).

Map VRChat visemes (`vrc.v_aa`, `vrc.v_ih`, etc.) to ARKit blendshapes in Blender or Unity:
- `vrc.v_aa` -> `jawOpen`
- `vrc.v_ch` -> `jawOpen` + `mouthFunnel`
- `vrc.v_smile` -> `mouthSmile_L` + `mouthSmile_R`

---

## 3. Packaging & Ingesting via `freverkit` (CLI)

You can package and register custom assets without opening Unity by using the clone-and-swap path in `freverkit`:

```bash
# Ingest an .fbx or .glb asset into the local FreverS asset store
node scripts/import-assets.mjs <path-to-bundle-or-fbx>
```

The asset will be placed in `data/assets/bundles/Android/` and registered in `data/assets/catalog.json`.

---

## 4. Studio V2 & Client Patching Notice

Extended Studio features (custom place loaders, ragdoll colliders, and full bone gizmos) are documented under `docs/CLIENT_PATCHING.md`. Content-only places and props can be placed into `data/assets/` directly.
