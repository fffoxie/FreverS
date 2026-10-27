# Client Patching & Studio V2 Technical Research

This document outlines client-side modification strategies for **Frever 4.0.5** (IL2CPP / Unity 2022.3.28f1).

---

## 1. Overview of the IL2CPP Client

- **Package:** `com.FriendFactory.Frever`
- **Native Binary:** `libil2cpp.so` (armeabi-v7a)
- **Metadata:** `assets/bin/Data/Managed/Metadata/global-metadata.dat`

Because the app is compiled with IL2CPP, standard C# assembly patching (e.g. dnSpy/Assembly-CSharp.dll edits) is not applicable. Code modifications require binary patching, Il2CppDumper analysis, or mod loading.

---

## 2. Evaluation of Patching Approaches

### Approach A: Metadata String Literal Editor (Implemented in FreverS PAPK Tool)
- **Method:** Rewriting string literal index tables in `global-metadata.dat`.
- **Target:** API hostnames (`content-prod.frever-api.com` -> local server address).
- **Pros:** Native, fast, runs directly during PAPK creation without native recompilation.
- **Cons:** Constrained by string literal length limits (must be <= original length).

### Approach B: Frida Gadget / Injection
- **Method:** Injecting `libfrida-gadget.so` into the APK native libraries and invoking hooks at runtime.
- **Pros:** Flexible, allows intercepting any C# method via Native RPC or Interceptor.
- **Cons:** Requires native lib injection and JS script bundle management.

### Approach C: BepInEx for Android (IL2CPP)
- **Method:** Mod loader framework loading custom C# plugins into Unity's IL2CPP runtime.
- **Pros:** Full access to Unity `GameObject`, `ConfigurableJoint` (ragdoll), and custom AssetBundle loaders.
- **Cons:** High setup complexity for Android 32-bit ARM.

---

## 3. Studio V2 Implementation Path

1. **Stage S1 (Server & Content Only - Active):** Custom places, props, and animations served directly via `data/assets/` AssetBundle store.
2. **Stage S2 (Client Patching Research - Documented):** Il2CppDumper analysis of `UMACharacterEditor` and `OutfitApplyCommand`.
3. **Stage S3 (Prototype Mod Loader):** Frida Gadget injection hook to bypass client-side bundle hash verification.
