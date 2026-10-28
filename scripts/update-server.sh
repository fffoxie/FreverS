#!/usr/bin/env bash
# Update FreverS from GitHub and reinstall dependencies.
# Usage: bash scripts/update-server.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d .git ]; then
  echo "Not a git checkout; cannot update automatically." >&2
  exit 1
fi

echo "[update] fetching origin..."
git fetch --prune origin
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "[update] updating $BRANCH..."
git pull --ff-only origin "$BRANCH"

echo "[update] installing dependencies..."
npm install --no-audit --no-fund

echo
echo "[update] done. Restart the server:"
echo "  stop the old process (Ctrl+C or kill the node process)"
echo "  npm start"
echo
echo "The SQLite database is migrated in place on start. Existing accounts,"
echo "premium/currency values, uploads and builds are kept."
