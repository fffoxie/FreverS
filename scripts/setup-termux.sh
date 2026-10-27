#!/data/data/com.termux/files/usr/bin/bash
# One-shot Termux setup for FreverS. Safe to run more than once.
#
# Run from the repository:  bash scripts/setup-termux.sh
# Installs Node.js, git and the APK signing tools, creates and seeds the
# database, runs the test suite and prints the addresses to use in the PAPK.
# Credentials are generated into data/credentials.txt (git-ignored) on the
# first run and never committed.
set -euo pipefail

if [ -n "${PREFIX:-}" ] && [ -d "$PREFIX" ]; then
  echo "[setup] Termux detected at $PREFIX"
else
  echo "[setup] warning: this does not look like Termux. Continuing anyway."
fi

# The Play Store build of Termux is abandoned and its packages are too old.
if command -v getprop >/dev/null 2>&1; then
  TERMUX_INSTALLER="$(getprop com.termux.installer 2>/dev/null || true)"
  if [ -n "$TERMUX_INSTALLER" ] && [ "$TERMUX_INSTALLER" != "org.fdroid.fdroid" ]; then
    echo "[setup] WARNING: Termux was installed by '$TERMUX_INSTALLER'."
    echo "[setup] Install Termux from F-Droid instead: https://f-droid.org/packages/com.termux/"
  fi
fi

if command -v pkg >/dev/null 2>&1; then
  echo "[setup] updating package lists..."
  pkg update -y
  echo "[setup] installing nodejs git openjdk-17 apktool apksigner..."
  pkg install -y nodejs git openjdk-17 apktool apksigner
else
  echo "[setup] 'pkg' not found; skipping apt install. Ensure node >= 22.13, git and java are available."
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] ERROR: node is not installed" >&2
  exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 22 ] || \
   { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  echo "[setup] ERROR: Node $NODE_VERSION is too old; node:sqlite is unflagged from 22.13" >&2
  echo "[setup] Run 'pkg upgrade' or install Node 24.x." >&2
  exit 1
fi
echo "[setup] node $NODE_VERSION"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[setup] installing npm dependencies (none required)..."
npm install --no-audit --no-fund

mkdir -p data output
chmod 700 data 2>/dev/null || true

echo "[setup] creating and seeding the database..."
node src/seed.js

echo "[setup] running the test suite..."
npm run --silent test:record

if [ ! -f analysis/Frever_4.0.5_APKPure.apk ]; then
  echo "[setup] note: analysis/Frever_4.0.5_APKPure.apk is missing, so Create PAPK\
 will fail until you copy the original APK there (it is git-ignored)."
fi

echo
echo "[setup] done. Next:"
echo "  1) start the server:            bash scripts/start.sh"
echo "  2) open the dashboard:          http://127.0.0.1:8080/dashboard"
echo "  3) Create PAPK on the dashboard (needs analysis/Frever_4.0.5_APKPure.apk)"
echo "  4) find this phone's LAN address:  ip addr    # look for wlan0"
echo
echo "[setup] accounts: usernames are in the dashboard; passwords are in data/credentials.txt"
