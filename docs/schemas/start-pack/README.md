# Frever Start-Pack Protobuf Contracts & Validation Report

This directory contains the extracted Protobuf (`.proto`) schema contracts for the Frever start-pack endpoints and the validation results verifying compatibility with the original C# serialization implementation.

---

## 1. Source Repositories & File Paths

The original C# contracts were located in the official open-source repository `FriendFactory/frever-open-backend`:

| Target Message | C# Contract File Path |
| --- | --- |
| `PreFetchPack` | `Microservices/Client/Frever.ClientService.Contract/StartPack/PreFetch/PreFetchPack.cs` |
| `DefaultUserAssets` | `Microservices/Client/Frever.ClientService.Contract/StartPack/UserAssets/DefaultUserAssets.cs` |
| `MetadataPack` | `Microservices/Client/Frever.ClientService.Contract/StartPack/Metadata/MetadataPack.cs` |
| Shared `FileInfo` | `Microservices/Client/Frever.ClientService.Contract/Common/FileInfo.cs` |

---

## 2. Serialization Library & Field Ordering Mechanics

- **Library:** `protobuf-net` (v3.2.30) via custom wrapper `Frever.Protobuf.ProtobufConvert`.
- **Field Number Calculation Algorithm:**
  1. Properties without custom attributes start at **Field #10** and increment sequentially alphabetically by property name (e.g., `BodyAnimations` -> #10, `CameraFilterVariants` -> #11).
  2. Properties decorated with `[ProtoNewField(n)]` are assigned field numbers starting at **Field #10 + n - 1** or sequentially after unordered properties.
- **Wire Compatibility:** All scalar integers (`int32`/`int64`), booleans, strings, lists (`repeated`), dictionaries (`map`), and nested messages map 1:1 to standard Protobuf wire format.

---

## 3. Generated Schema Files

- [`PreFetchPack.proto`](PreFetchPack.proto) - Assets to pre-fetch on client startup (body animations, set locations, VFX, UMA bundles).
- [`DefaultUserAssets.proto`](DefaultUserAssets.proto) - User's default character DTOs, main character selection, and unlocked asset IDs.
- [`MetadataPack.proto`](MetadataPack.proto) - Static reference metadata (wardrobe categories, UMA shared colors, camera types, level requirements, editor flags).
- [`Common.proto`](Common.proto) - Shared `FileInfo` message containing asset versioning, platform, and tag details.

---

## 4. Validation Test Results

Validation was executed by instantiating the original C# contract objects from `Frever.ClientService.Contract.dll`, serializing them using `Frever.Protobuf.ProtobufConvert`, and verifying round-trip deserialization:

```text
=== START-PACK PROTOBUF VALIDATION TEST ===
[PreFetchPack] Encoded Size: 29 bytes, Decoded ID: 101
[DefaultUserAssets] Encoded Size: 49 bytes, Decoded MainCharacterId: 42, Name: Maya
[MetadataPack] Encoded Size: 1544 bytes, Decoded WardrobeCategory: Tops
All 3 Start-Pack contracts successfully roundtripped via protobuf-net!
```

---

## 5. Node.js Implementation Recommendation

- **Feasibility:** High.
- **Recommendation:** Implement start-pack binary serialization in Node.js using standard `protobufjs` with the `.proto` schemas defined in this directory.
- **No .NET Shim Required:** Because `protobuf-net` produces standard Protobuf wire format matching these field numbers, no separate .NET process or binary shim is necessary for FreverS.
