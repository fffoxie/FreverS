# FreverS (Frever RDT - Revival Developer Tool)

**FreverS (Frever RDT)** is a 100% free, local-only private server and patch toolkit for the Android app **Frever 4.0.5** (`com.FriendFactory.Frever`, versionCode 409).

> **Credits & License:**
> FreverS (Frever RDT), by fffoxie, with Jules.
> This is a fan-made, non-commercial project and is NOT affiliated with or endorsed by Frever or Friend Factory. See `NOTICE` for details.

---

## 1. Quick Termux Installation Guide (Run Once on Android)

Follow these exact steps in Termux on your phone. You only need to perform the setup **once**. Once complete, the server runs permanently on your device.

```bash
# Step 1: Update Termux packages
pkg update -y && pkg install -y git nodejs openjdk-17 python zip unzip curl

# Step 2: Grant storage permissions (tap Allow on your phone screen)
termux-setup-storage

# Step 3: Clone FreverS repository
cd ~
git clone https://github.com/fffoxie/FreverS.git
cd FreverS

# Step 4: Run automated Termux setup
bash scripts/setup-termux.sh

# Step 5: Start the local server
bash scripts/start.sh
```

After starting, open the web dashboard in your phone browser:
**[http://127.0.0.1:8080/dashboard](http://127.0.0.1:8080/dashboard)**

---

## 2. Obtain & Patch the Original Frever APK

To generate the patched app (PAPK) that points to your local private server:

1. Obtain a clean copy of **Frever 4.0.5 APK or XAPK**.
2. Place the file on your phone in `~/FreverS/analysis/Frever_4.0.5_APKPure.apk` or in your device's `Download/` folder (`/storage/emulated/0/Download/` or `/sdcard/Download/`):
   ```bash
   # Standard Termux storage symlink:
   cp ~/storage/downloads/Frever_4.0.5_APKPure.apk ~/FreverS/analysis/Frever_4.0.5_APKPure.apk

   # Or direct Android internal storage path (/storage/emulated/0/Download/):
   cp /storage/emulated/0/Download/Frever_4.0.5_APKPure.apk ~/FreverS/analysis/Frever_4.0.5_APKPure.apk
   ```
3. Open the web control panel at `http://127.0.0.1:8080/dashboard`, navigate to **PAPK Tool**, and tap **Create PAPK**.

---

## 3. Star Creators, Custom Assets & Advanced Customization

- **Star Creators:** Included by default! Calling `/group/star-creators-in-your-country` returns available Star Creator profiles.
- **Custom VRChat Avatars, Clothing & Maps:** Full retargeting, Blender FBX import, ARKit 52 facial blendshape sliders, and custom map scene guidelines are documented in detail in [`docs/ASSET_CREATION.md`](docs/ASSET_CREATION.md).
- **Importing Bundles:** Ingest custom AssetBundle files locally using:
  ```bash
  node scripts/import-assets.mjs <path-to-bundle-or-folder>
  ```

---

## 4. Comprehensive Troubleshooting Matrix

| Error / Issue | Description & Exact Remediation Command |
| --- | --- |
| Termux Mirror Errors | Run `termux-change-repo` and select a working main repository mirror. |
| Server Dies When Screen Locks | Run `termux-wake-lock` and disable battery optimization for Termux in Android Settings. |
| Missing Original APK Error | Copy your Frever APK into `analysis/Frever_4.0.5_APKPure.apk` or specify path in the PAPK control panel. |
| Port 8080 Already Busy | Run `export FREVERS_PORT=8081 && bash scripts/start.sh` |
| System Health Diagnostics | Run `bash scripts/doctor.sh` to test Git, Node version, SQLite DB, port, and unit tests. |
| Security & Secrets Check | Run `bash scripts/check-no-secrets.sh` to verify no sensitive keys or APKs are tracked in git. |

---

## 5. Running on Linux / Desktop PC

```bash
git clone https://github.com/fffoxie/FreverS.git
cd FreverS
bash scripts/setup-termux.sh
bash scripts/start.sh
```
Open **`http://127.0.0.1:8080/dashboard`** in your browser.
