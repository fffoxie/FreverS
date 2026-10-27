# Il2CppDumper Extraction Guide for FreverS

This guide documents how to dump DTOs and route models from Frever 4.0.5 (`com.FriendFactory.Frever`) using Il2CppDumper on PC.

## Prerequisites

1. **PC Operating System**: Windows, Linux, or macOS.
2. **Il2CppDumper**: Download the latest release from [Il2CppDumper on GitHub](https://github.com/Perfare/Il2CppDumper).
3. **Frever 4.0.5 XAPK or Split APKs**:
   - `libil2cpp.so` extracted from `config.armeabi_v7a.apk` (or base APK if non-split).
   - `global-metadata.dat` extracted from `assets/bin/Data/Managed/Metadata/global-metadata.dat`.

## Step-by-Step Instructions

1. **Extract Binaries**:
   Extract `libil2cpp.so` and `global-metadata.dat` from your Frever 4.0.5 APK/XAPK into a working directory.

2. **Run Il2CppDumper**:
   Run Il2CppDumper via executable or CLI:
   ```cmd
   Il2CppDumper.exe libil2cpp.so global-metadata.dat <output_folder>
   ```

3. **Output Files**:
   - `dump.cs`: Contains C# class definitions, struct fields, and DTO definitions.
   - `script.json`: Contains method offsets and metadata mappings.
   - `stringliteral.json`: Contains compiled-in string literals including route paths and service names.

4. **Generating JSON Schemas**:
   Use `scripts/generate-schemas.mjs` to convert C# class definitions from `dump.cs` (or standard DTO specifications) into JSON schema skeletons in `docs/schemas/`:
   ```sh
   node scripts/generate-schemas.mjs
   ```

5. **Updating Endpoint Inventory**:
   Run `scripts/generate-endpoints-doc.mjs` to keep `docs/ENDPOINTS.md` synchronized with server handlers:
   ```sh
   node scripts/generate-endpoints-doc.mjs
   ```
