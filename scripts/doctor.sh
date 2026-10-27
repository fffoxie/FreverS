#!/data/data/com.termux/files/usr/bin/bash
# Doctor script for FreverS: verifies installation, environment, and server health.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PORT="${FREVERS_PORT:-${PORT:-8080}}"
FAILED=0

echo "=== FreverS Doctor Diagnostics ==="
echo

# Check 1: Environment (Termux or Linux)
echo -n "[check] Operating System / Environment: "
if [ -n "${PREFIX:-}" ] && [ -d "$PREFIX" ]; then
  echo "OK (Termux detected at $PREFIX)"
else
  echo "OK (Linux / standard POSIX environment)"
fi

# Check 2: Git installed
echo -n "[check] Git installed: "
if command -v git >/dev/null 2>&1; then
  echo "OK ($(git --version))"
else
  echo "FAILED"
  echo "  FIX: Run 'pkg install -y git' (or 'apt-get install -y git')"
  FAILED=1
fi

# Check 3: Node version >= 22.13.0
echo -n "[check] Node.js version >= 22.13.0: "
if command -v node >/dev/null 2>&1; then
  NODE_VERSION="$(node -p 'process.versions.node')"
  NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
  NODE_MINOR="$(node -p 'process.versions.node.split(".")[1]')"
  if [ "$NODE_MAJOR" -gt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -ge 13 ]; }; then
    echo "OK (v$NODE_VERSION)"
  else
    echo "FAILED (v$NODE_VERSION is too old)"
    echo "  FIX: Run 'pkg upgrade -y nodejs' or install Node.js >= 22.13.0"
    FAILED=1
  fi
else
  echo "FAILED (node command not found)"
  echo "  FIX: Run 'pkg install -y nodejs'"
  FAILED=1
fi

# Check 4: npm dependencies
echo -n "[check] npm dependencies / package.json: "
if [ -f package.json ]; then
  echo "OK (package.json present)"
else
  echo "FAILED (package.json missing)"
  echo "  FIX: Run 'git checkout main' or re-clone repository"
  FAILED=1
fi

# Check 5: DB present
echo -n "[check] Database present (data/frever.db): "
if [ -f data/frever.db ]; then
  echo "OK"
else
  echo "FAILED (Database file missing)"
  echo "  FIX: Run 'node src/seed.js' or 'bash scripts/setup-termux.sh'"
  FAILED=1
fi

# Check 6: Port free / server status
echo -n "[check] Port $PORT status: "
PORT_BUSY=0
if command -v lsof >/dev/null 2>&1; then
  lsof -i :"$PORT" >/dev/null 2>&1 && PORT_BUSY=1
elif command -v nc >/dev/null 2>&1; then
  nc -z 127.0.0.1 "$PORT" >/dev/null 2>&1 && PORT_BUSY=1
fi

if [ "$PORT_BUSY" -eq 1 ]; then
  # Check if it's our server responding at dashboard URL
  if command -v curl >/dev/null 2>&1 && curl -s -f "http://127.0.0.1:${PORT}/dashboard" >/dev/null 2>&1; then
    echo "OK (FreverS server is actively listening on port $PORT)"
  else
    echo "FAILED (Port $PORT is occupied by another process)"
    echo "  FIX: Run 'FREVERS_PORT=8081 bash scripts/start.sh' or stop the process on port $PORT"
    FAILED=1
  fi
else
  echo "OK (Port $PORT is free)"
fi

# Check 7: Tests pass
echo -n "[check] Test suite status: "
if node --test test/*.test.js >/dev/null 2>&1; then
  echo "OK (All tests pass)"
else
  echo "FAILED (One or more tests failed)"
  echo "  FIX: Run 'npm test' to inspect failures"
  FAILED=1
fi

# Check 8: Server answers at dashboard URL (if server running)
echo -n "[check] Dashboard URL accessible (http://127.0.0.1:$PORT/dashboard): "
if command -v curl >/dev/null 2>&1; then
  HTTP_STATUS="$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/dashboard" || true)"
  if [ "$HTTP_STATUS" = "200" ]; then
    echo "OK (HTTP 200)"
  else
    if [ "$PORT_BUSY" -eq 1 ]; then
      echo "FAILED (Returned HTTP $HTTP_STATUS)"
      echo "  FIX: Ensure FreverS server is running with 'bash scripts/start.sh'"
      FAILED=1
    else
      echo "SKIPPED (Server is not running yet)"
    fi
  fi
else
  echo "SKIPPED (curl not installed)"
fi

echo
if [ "$FAILED" -eq 0 ]; then
  echo "All doctor checks PASSED!"
  exit 0
else
  echo "Doctor checks FAILED. Please follow the copy-paste fix commands above."
  exit 1
fi
