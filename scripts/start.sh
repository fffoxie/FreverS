#!/data/data/com.termux/files/usr/bin/bash
# Start FreverS. The dashboard is served by the same process at /dashboard.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

mkdir -p logs

if ! command -v node >/dev/null 2>&1; then
  echo "[start] ERROR: node not found." >&2
  echo "[start] FIX: Run 'bash scripts/setup-termux.sh' or 'pkg install -y nodejs'" >&2
  exit 1
fi

PORT="${FREVERS_PORT:-${PORT:-8080}}"
HOST="${FREVERS_HOST:-0.0.0.0}"

# Check if port is already in use
if command -v lsof >/dev/null 2>&1; then
  if lsof -i :"$PORT" >/dev/null 2>&1; then
    echo "[start] ERROR: Port $PORT is already in use." >&2
    echo "[start] FIX: Stop the process using port $PORT, or run with 'FREVERS_PORT=8081 bash scripts/start.sh'." >&2
    exit 1
  fi
elif command -v nc >/dev/null 2>&1; then
  if nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1; then
    echo "[start] ERROR: Port $PORT is already in use." >&2
    echo "[start] FIX: Stop the process using port $PORT, or run with 'FREVERS_PORT=8081 bash scripts/start.sh'." >&2
    exit 1
  fi
fi

# Keep the CPU awake while the server runs (Termux only, best effort).
if command -v termux-wake-lock >/dev/null 2>&1; then
  termux-wake-lock || true
  trap 'termux-wake-unlock || true' EXIT
fi

echo "[start] Starting FreverS server..."
echo "[start] Local URL: http://127.0.0.1:$PORT/"
echo "[start] Dashboard: http://127.0.0.1:$PORT/dashboard"

if command -v ip >/dev/null 2>&1; then
  ip -4 addr show 2>/dev/null | awk '/inet / && $2 !~ /^127\./ { sub(/\/[0-9]+/, "", $2); print "[start] Phone LAN IP: http://" $2 ":'"$PORT"'/" }' || true
elif command -v ifconfig >/dev/null 2>&1; then
  ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ { sub(/addr:/, "", $2); print "[start] Phone LAN IP: http://" $2 ":'"$PORT"'/" }' || true
fi

echo "[start] Server logs are written to logs/server.log"

# Run server teeing output to logs/server.log
exec node src/server.js 2>&1 | tee -a logs/server.log
