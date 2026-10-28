#!/usr/bin/env bash
# Reset the local FreverS data (accounts, currency, uploads, builds).
# Keeps the original APK and the signing keystore unless --hard is passed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HARD=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --hard) HARD=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    *) echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

if [ "$ASSUME_YES" -ne 1 ]; then
  echo "This deletes: database, accounts, uploaded assets and build history."
  [ "$HARD" -eq 1 ] && echo "HARD reset also deletes the original APK and signing keys."
  printf 'Type RESET to continue: '
  read -r answer
  [ "$answer" = "RESET" ] || { echo "Cancelled."; exit 0; }
fi

rm -rf data/assets data/builds
rm -f data/frever.db data/frever.db-wal data/frever.db-shm
rm -f data/generated-credentials.txt data/token-secret
if [ "$HARD" -eq 1 ]; then
  rm -rf data/apk data/keys
  rm -f data/admin-token.txt
fi

echo "Reset complete. Start the server with: npm start"
echo "The first account will be seeded again (default fffoxie, random password written to data/generated-credentials.txt)."
