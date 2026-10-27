#!/data/data/com.termux/files/usr/bin/bash
# One-shot Termux setup for FreverS. Safe to run more than once.
set -uo pipefail

echo "[setup] starting FreverS setup..."

# Environment check (optional warning)
if [ -n "${PREFIX:-}" ] && [ -d "$PREFIX" ]; then
  echo "[setup] Termux detected at $PREFIX"
else
  echo "[setup] WARNING: Termux prefix not detected. Continuing anyway on Linux/other OS."
fi

if command -v getprop >/dev/null 2>&1; then
  TERMUX_INSTALLER="$(getprop com.termux.installer 2>/dev/null || true)"
  if [ -n "$TERMUX_INSTALLER" ] && [ "$TERMUX_INSTALLER" != "org.fdroid.fdroid" ]; then
    echo "[setup] WARNING: Termux was installed by '$TERMUX_INSTALLER'."
    echo "[setup] Play Store Termux is deprecated. Use F-Droid: https://f-droid.org/packages/com.termux/"
  fi
fi

# Package installation
if command -v pkg >/dev/null 2>&1; then
  echo "[setup] updating package lists..."
  pkg update -y || echo "[setup] WARNING: pkg update exited with error. Trying to continue..."
  echo "[setup] installing required base packages (nodejs, git)..."
  pkg install -y git nodejs || {
    echo "[setup] ERROR: Failed to install git or nodejs via pkg." >&2
    echo "[setup] FIX: Run 'pkg update -y && pkg install -y git nodejs'" >&2
    exit 1
  }
  echo "[setup] attempting optional packages (openjdk-21, apktool, apksigner)..."
  pkg install -y openjdk-21 apktool apksigner || {
    echo "[setup] WARNING: Optional APK tool installation failed. APK patching will be unavailable until tools are installed."
  }
fi

# Required Step 1: Git check
if ! command -v git >/dev/null 2>&1; then
  echo "[setup] ERROR: git command not found." >&2
  echo "[setup] FIX: Run 'pkg install -y git' (or 'apt-get install -y git')" >&2
  exit 1
fi

# Required Step 2: Node.js presence & version check
if ! command -v node >/dev/null 2>&1; then
  echo "[setup] ERROR: node command not found." >&2
  echo "[setup] FIX: Run 'pkg install -y nodejs' (or install Node >= 22.13.0)" >&2
  exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"

if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  echo "[setup] ERROR: Node.js $NODE_VERSION is installed, but Node >= 22.13.0 is required for node:sqlite." >&2
  echo "[setup] FIX: Run 'pkg upgrade -y nodejs' or install Node.js >= 22.13.0." >&2
  exit 1
fi
echo "[setup] Node.js version: v$NODE_VERSION (>= 22.13.0 check passed)"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Directories creation & permissions
mkdir -p data output logs
chmod 700 data 2>/dev/null || true

# Required Step 3: npm install
echo "[setup] verifying npm dependencies..."
npm install --no-audit --no-fund || {
  echo "[setup] ERROR: npm install failed." >&2
  echo "[setup] FIX: Run 'npm install' or 'pkg install -y build-essential python make'" >&2
  exit 1
}

# Required Step 4: Database creation & seeding
echo "[setup] creating and seeding database..."
node src/seed.js || {
  echo "[setup] ERROR: Database seeding failed." >&2
  echo "[setup] FIX: Run 'node src/seed.js' after verifying node and permissions on data/" >&2
  exit 1
}

# Run tests recording
echo "[setup] running test suite..."
npm run --silent test:record || {
  echo "[setup] WARNING: Test run failed during setup."
}

if [ ! -f analysis/Frever_4.0.5_APKPure.apk ]; then
  echo "[setup] NOTE: analysis/Frever_4.0.5_APKPure.apk is missing."
  echo "[setup]       Create PAPK will be unavailable until you place the original APK there."
fi

PORT="${FREVERS_PORT:-${PORT:-8080}}"
echo
echo "[setup] Setup complete successfully!"
echo "[setup] Next commands to run:"
echo "  bash scripts/start.sh"
echo
echo "[setup] Dashboard URL:"
echo "  http://127.0.0.1:${PORT}/dashboard"
