#!/data/data/com.termux/files/usr/bin/bash
# Update script for FreverS: pulls latest changes from GitHub and re-runs setup.
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[update] Pulling latest changes from GitHub main branch..."
git pull origin main

echo "[update] Running Termux setup to refresh dependencies..."
bash scripts/setup-termux.sh

echo "[update] Update complete! Run 'bash scripts/start.sh' to start the updated server."
