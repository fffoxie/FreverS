#!/data/data/com.termux/files/usr/bin/bash
# One-shot Termux setup for FreverS.
#
# Run from the repository:  bash scripts/setup-termux.sh
# It installs Node.js and git, validates the Node version, runs npm install and
# prints the addresses to use in the patched client. It never starts the server
# in the background and never stores credentials in the repository.
set -euo pipefail

if [ -n "${PREFIX:-}" ] && [ -d "$PREFIX" ]; then
  echo "[setup] Termux detected at $PREFIX"
else
  echo "[setup] warning: this does not look like Termux. Continuing anyway."
fi

# The Play Store build of Termux is abandoned and its packages are too old.
if [ -n "${TERMUX_VERSION:-}" ]; then
  echo "[setup] TERMUX_VERSION=$TERMUX_VERSION"
fi
if command -v getprop >/dev/null 2>&1; then
  TERMUX_INSTALLER="$(getprop com.termux.installer 2>/dev/null || true)"
  if [ -n "$TERMUX_INSTALLER" ] && [ "$TERMUX_INSTALLER" != "org.fdroid.fdroid" ]; then
    echo
    echo "[setup] WARNING: Termux was installed by '$TERMUX_INSTALLER'."
    echo "[setup] Install Termux from F-Droid instead: https://f-droid.org/packages/com.termux/"
    echo
  fi
fi

if command -v pkg >/dev/null 2>&1; then
  echo "[setup] updating package lists..."
  pkg update -y
  echo "[setup] installing nodejs and git..."
  pkg install -y nodejs git
else
  echo "[setup] 'pkg' not found; skipping apt install. Ensure node >= 22.5 and git are available."
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[setup] ERROR: node is not installed" >&2
  exit 1
fi

NODE_VERSION="$(node -p 'process.versions.node')"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 5 ]; }; then
  echo "[setup] ERROR: Node $NODE_VERSION is too old; node:sqlite needs >= 22.5" >&2
  echo "[setup] Run 'pkg upgrade' or install a current Node.js." >&2
  exit 1
fi
echo "[setup] node $NODE_VERSION"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[setup] installing npm dependencies (none required)..."
npm install --no-audit --no-fund

mkdir -p data
chmod 700 data 2>/dev/null || true

echo
echo "[setup] done. Next:"
echo "  1) set passwords (or let the server generate them once):"
echo "       export FREVERS_USER1_PASSWORD='...'"
echo "       export FREVERS_USER2_PASSWORD='...'"
echo "  2) start the server:"
echo "       npm start"
echo "  3) find this phone's LAN address:"
echo "       ip addr    # look for wlan0, e.g. 192.168.1.42"
echo "  4) point the patched client at:"
echo "       same phone:      http://127.0.0.1:8080"
echo "       another device:  http://<wlan0-ip>:8080"
echo
ip -4 addr show 2>/dev/null | awk '/inet / && $2 != "127.0.0.1/8" {print "  candidate address: http://" $2}' | sed 's#/[0-9]*# #' || true
