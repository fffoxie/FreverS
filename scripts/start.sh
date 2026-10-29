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

# Helper function to kill processes using the port or running src/server.js
kill_existing_server() {
  echo "[start] Clearing any existing server process on port $PORT..."
  if command -v lsof >/dev/null 2>&1; then
    PIDS="$(lsof -t -i :"$PORT" 2>/dev/null || true)"
    if [ -n "$PIDS" ]; then
      echo "[start] Killing process(es) on port $PORT: $PIDS"
      kill -9 $PIDS 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k -9 "$PORT/tcp" 2>/dev/null || true
  fi

  # Secondary check for Node server process
  if command -v pgrep >/dev/null 2>&1; then
    NODE_PIDS="$(pgrep -f "node.*src/server.js" 2>/dev/null || true)"
    if [ -n "$NODE_PIDS" ]; then
      echo "[start] Killing existing server PID(s): $NODE_PIDS"
      kill -9 $NODE_PIDS 2>/dev/null || true
    fi
  fi
  sleep 1
}

kill_existing_server

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
