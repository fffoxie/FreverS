# FreverS (Frever RDT - Revival Developer Tool)

**FreverS (Frever RDT)** is a 100% free, local-only private server and patch toolkit for the Android app **Frever 4.0.5** (`com.FriendFactory.Frever`, versionCode 409).

> **Credits & License:**
> FreverS (Frever RDT), by fffoxie, with Jules.
> This is a fan-made, non-commercial project and is NOT affiliated with or endorsed by Frever or Friend Factory. See `NOTICE` for details.

---

## 1. Quick Termux Installation Guide (Run Once on Android)

Follow these exact steps in Termux on your phone. You only need to run the setup **once**.

```bash
# 1. Update Termux packages
pkg update -y && pkg install -y git nodejs openjdk-17 python zip unzip curl

# 2. Grant storage access (tap Allow when prompted)
termux-setup-storage

# 3. Clone FreverS
cd ~
git clone https://github.com/fffoxie/FreverS.git
cd FreverS

# 4. Run automated setup (seeds database, checks dependencies, builds directories)
bash scripts/setup-termux.sh

# 5. Start the server
bash scripts/start.sh
```

Once started, open the web dashboard in your phone browser:
**[http://127.0.0.1:8080/dashboard](http://127.0.0.1:8080/dashboard)**

---

## 2. Get the Original APK (Required for PAPK Creation)

To patch the app, obtain a clean copy of **Frever 4.0.5 APK or XAPK** (e.g. from APKPure or Google Drive).

Place the file on your phone in `~/FreverS/analysis/Frever_4.0.5_APKPure.apk` or in your phone's `Download/` folder:

```bash
cp ~/storage/downloads/Frever_4.0.5_APKPure.apk ~/FreverS/analysis/Frever_4.0.5_APKPure.apk
```

Then open the dashboard at `http://127.0.0.1:8080/dashboard`, go to the **PAPK Tool** tab, and tap **Create PAPK**.

---

## 3. Creating Custom Assets (VRChat / Blender to Frever)

Frever uses Unity **2022.3.28f1** UMA avatars. Custom characters, outfits, and props can be created and imported:

1. **Blender / VRChat Conversion:** See [`docs/ASSET_CREATION.md`](docs/ASSET_CREATION.md) for skeleton retargeting and ARKit 52 blendshape guidelines.
2. **Importing Bundles:** Ingest custom `.fbx` or AssetBundle files locally using:
   ```bash
   node scripts/import-assets.mjs <path-to-bundle-or-folder>
   ```

---

## 4. Troubleshooting Matrix

| Error / Issue | Exact Fix Command |
| --- | --- |
| Mirror errors in Termux | `termux-change-repo` (select a main mirror) |
| Server stops when screen turns off | `termux-wake-lock` and disable battery optimization for Termux |
| Missing original APK error | Copy APK into `analysis/Frever_4.0.5_APKPure.apk` or specify path in dashboard |
| Port 8080 busy | `export FREVERS_PORT=8081 && bash scripts/start.sh` |
| Diagnostics & Health Check | `bash scripts/doctor.sh` |
| Check for tracked secret files | `bash scripts/check-no-secrets.sh` |

---

## 5. Running on Linux / PC

On Linux, macOS, or Windows WSL:
```bash
git clone https://github.com/fffoxie/FreverS.git
cd FreverS
bash scripts/setup-termux.sh
bash scripts/start.sh
```
Open **`http://127.0.0.1:8080/dashboard`** in your desktop browser.
