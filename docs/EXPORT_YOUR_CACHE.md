# Community Cache Export Guide (Frever RDT Asset Recovery)

If you have ever installed and run **Frever** on an Android phone, tablet, or emulator, your device may still contain downloaded AssetBundles. This guide explains how to safely export and contribute your cache to help preserve Frever content.

---

## 1. What to Export (and What NOT to Export)

- **EXPORT:** The app's cache directory containing downloaded `.bundle` / `UnityFS` files.
  - Typical path: `/sdcard/Android/data/com.FriendFactory.Frever/files/`
- **DO NOT EXPORT:** Account credentials, session tokens, passwords, or personal emails.
  - Run `node scripts/sanitize-cache.mjs <your-exported-folder>` before sharing to automatically remove personal data.

---

## 2. Export Methods

### Method A: USB Cable to PC (Easiest)
1. Connect your Android phone to a PC via USB.
2. Select **File Transfer / MTP** on your phone notification panel.
3. Open File Explorer on PC and navigate to:
   `Internal Storage > Android > data > com.FriendFactory.Frever > files`
4. Copy the `files` folder to your PC and zip it.

### Method B: ADB over USB / Wireless
```bash
# Connect ADB and pull the cache folder directly
adb pull /sdcard/Android/data/com.FriendFactory.Frever/files ./frever_cache/
```

### Method C: Directly in Termux on Android
```bash
# Grant Termux storage access
termux-setup-storage

# Copy downloaded cache files to Termux
cp -r /sdcard/Android/data/com.FriendFactory.Frever/files ~/frever_cache
```

---

## 3. Importing into FreverS

Once exported, ingest the cache into your local FreverS server:

```bash
# Run the cache importer
node scripts/import-cache.mjs ~/frever_cache

# Reconstruct the asset catalog
node scripts/reconstruct-catalog.mjs
```
