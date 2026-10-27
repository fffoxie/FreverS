#!/usr/bin/env bash
set -euo pipefail

echo "=== FreverS Secrets & Sensitive File Check ==="

SENSITIVE_PATTERNS=(
  "*.apk"
  "*.xapk"
  "*.keystore"
  "*.jks"
  "credentials.txt"
  "generated-credentials.txt"
  "token-secret"
)

FOUND=0
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
  MATCHES=$(git ls-files "$pattern" 2>/dev/null || true)
  if [ -n "$MATCHES" ]; then
    echo "[FAIL] Found sensitive committed file(s) matching '$pattern':"
    echo "$MATCHES"
    FOUND=1
  fi
done

if [ -f "data/frever.db" ] && git ls-files --error-unmatch data/frever.db 2>/dev/null; then
  echo "[FAIL] data/frever.db is tracked by git!"
  FOUND=1
fi

if [ "$FOUND" -eq 0 ]; then
  echo "[OK] No secret files or credentials found in git tracking!"
  exit 0
else
  echo "[ERROR] Check failed. Remove sensitive files from git tracking."
  exit 1
fi
