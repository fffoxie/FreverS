#!/data/data/com.termux/files/usr/bin/bash
# Update script for FreverS: pulls latest changes from GitHub, refreshes setup, and restarts server.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[update] Pulling latest changes from GitHub main branch..."
git pull origin main || git pull origin main --rebase || true

echo "[update] Running Termux setup to refresh dependencies..."
bash scripts/setup-termux.sh

echo "[update] Update complete! Restarting FreverS server..."
bash scripts/start.sh
