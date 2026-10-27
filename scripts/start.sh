#!/data/data/com.termux/files/usr/bin/bash
# Start FreverS. The dashboard is served by the same process at /dashboard.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "[start] node not found. Run: bash scripts/setup-termux.sh" >&2
  exit 1
fi

PORT="${FREVERS_PORT:-${PORT:-8080}}"
HOST="${FREVERS_HOST:-0.0.0.0}"

# Keep the CPU awake while the server runs (Termux only, best effort).
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
  trap 'termux-wake-unlock || true' EXIT
fi

echo "[start] FreverS on http://$HOST:$PORT"
echo "[start] dashboard: http://127.0.0.1:$PORT/dashboard"
if command -v ip >/dev/null 2>&1; then
  ip -4 addr show 2>/dev/null | awk '/inet / && $2 !~ /^127\./ { sub(/\/[0-9]+/, "", $2); print "[start] LAN: http://" $2 ":'"$PORT"'/" }' || true
fi

exec node src/server.js
