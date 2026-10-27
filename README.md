# FreverS

A local-only private server for the Android game **Frever 4.0.5** (`com.FriendFactory.Frever`).

FreverS lets you host your own private Frever server directly on your Android phone using Termux (or on Linux / PC).

---

## Phone Requirements & Initial Setup

To host FreverS on your phone, you need:
- **Android Phone** (Android 8.0 or newer).
- **Termux from F-Droid** (DO NOT install from Google Play Store; the Play Store version is deprecated and has outdated Node.js packages).
  - Download: [Termux on F-Droid](https://f-droid.org/packages/com.termux/)
- **Battery Optimization Settings**:
  - In Android Settings -> Apps -> Termux -> Battery, set to **Unrestricted / Don't Optimize**.
  - In Termux, run `termux-wake-lock` so Android doesn't put the server to sleep when the screen turns off.
- **Storage Permission**:
  - Run `termux-setup-storage` in Termux and grant permission.

---

## Quick Install (Copy-Paste Steps for Phone)

Open Termux on your phone and copy-paste each block:

### Step 1: Update packages and install prerequisites
```sh
pkg update -y && pkg install -y git nodejs
```
*Expected output*: Package lists update, git and nodejs install.
*Time*: ~30–60 seconds.

### Step 2: Clone repository
```sh
cd ~
git clone https://github.com/fffoxie/FreverS.git
cd FreverS
```
*Expected output*: Cloning into 'FreverS'... Done.
*Time*: ~5 seconds.

### Step 3: Run Termux setup
```sh
bash scripts/setup-termux.sh
```
*Expected output*: Checks Node version (requires Node >= 22.13.0), seeds the SQLite database (`data/frever.db`), runs initial tests, and prints setup complete.
*Time*: ~10 seconds.

### Step 4: Start the server
```sh
bash scripts/start.sh
```
*Expected output*:
```text
[start] Starting FreverS server...
[start] Local URL: http://127.0.0.1:8080/
[start] Dashboard: http://127.0.0.1:8080/dashboard
[start] Phone LAN IP: http://192.168.1.100:8080/
[frevers] listening on http://0.0.0.0:8080
```

### Step 5: Open the Dashboard
Open your phone browser (Chrome, Firefox, etc.) and go to:
```
http://127.0.0.1:8080/dashboard
```

---

## Get the Original APK (For PAPK Creation)

To patch the client using the dashboard's **Create PAPK** tool, copy your downloaded original Frever 4.0.5 APK into the repo's `analysis/` folder on your phone:

### Step 4: Start the server
```sh
termux-setup-storage
ls ~/storage/downloads | grep -i frever
mkdir -p ~/FreverS/analysis
cp ~/storage/downloads/<your-file>.apk ~/FreverS/analysis/Frever_4.0.5_APKPure.apk
```

Then open the dashboard (`http://127.0.0.1:8080/dashboard`), navigate to the **PAPK Tool** tab, and press **Create PAPK**.
*(Note: The original APK is git-ignored and never committed or uploaded).*

---

## Accounts & Login Details

When setup runs for the first time, two local playtest accounts are created automatically in `data/frever.db`:

- **Account 1**: Username `fffoxie`
- **Account 2**: Username `friend`

Passwords are auto-generated on first run and written to `data/credentials.txt` (or `data/generated-credentials.txt`).
To view your login passwords on the phone, run:
```sh
cat data/credentials.txt
```

*(You can also set custom passwords before starting the server using `FREVERS_USER1_PASSWORD="myPassword" bash scripts/start.sh`).*

---

## Stopping & Restarting the Server

- **To Stop**: In the Termux terminal where the server is running, press `Ctrl + C`.
- **To Restart**:
  ```sh
  cd ~/FreverS
  bash scripts/start.sh
  ```
- **To Verify Diagnostics**:
  ```sh
  bash scripts/doctor.sh
  ```

---

## Troubleshooting

| Problem / Error Message | Cause | Exact Fix Command |
| --- | --- | --- |
| **Mirror / Repository download error** during `pkg update` | Termux mirror server unreachable | Run `termux-change-repo` and select a working mirror (e.g., Grimler or Al権). |
| **Git clone failure** or network timeout | Slow network connection | Run `git clone --depth 1 https://github.com/fffoxie/FreverS.git` or download source ZIP. |
| **npm native build error** (node-gyp / make) | Missing compilation headers | Run `pkg install -y build-essential python make` |
| **Port busy (`EADDRINUSE`)** or `Port 8080 is already in use` | Port 8080 is occupied by another app or background process | Run with a custom port: `FREVERS_PORT=8081 bash scripts/start.sh` |
| **Storage permission denied** | Termux lacks storage access | Run `termux-setup-storage` and tap Allow on the pop-up |
| **Server stops when phone locks / sleeps** | Android battery optimization killed process | Run `termux-wake-lock` in Termux AND turn off Battery Optimization for Termux in Android Settings. |
| **Node too old (`Node 22.13.0 required`)** | Termux installed from Play Store or outdated package | Run `pkg upgrade -y nodejs`. If that fails, uninstall Termux and reinstall Termux from F-Droid. |

---

## Running on Linux / PC

Running FreverS on desktop Linux or macOS uses identical commands:

```sh
git clone https://github.com/fffoxie/FreverS.git
cd FreverS
bash scripts/setup-termux.sh
bash scripts/start.sh
```

Ensure Node.js >= 22.13.0 is installed on your Linux system. Run `bash scripts/doctor.sh` to check system health.

---

## Environment Variables Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `FREVERS_PORT` or `PORT` | `8080` | Server HTTP port |
| `FREVERS_HOST` | `0.0.0.0` | Bind address (`0.0.0.0` allows LAN access) |
| `FREVERS_DB_PATH` | `data/frever.db` | SQLite database file location |
| `FREVERS_USER1` / `FREVERS_USER2` | `fffoxie` / `friend` | Default seeded account usernames |
| `FREVERS_ORIGINAL_APK` | `analysis/Frever_4.0.5_APKPure.apk` | Custom path override for original APK |

---

## Playtesting Note
*The owner/developer is playtesting directly on Android hardware. Android-specific OS behaviors (such as battery management, wake locks, and termux storage) must be tested on a physical Android device.*
