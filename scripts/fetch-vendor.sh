#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${ROOT_DIR}"

mkdir -p vendor
cd vendor

LOCKFILE="../vendor.lock.json"
if [ -f "${LOCKFILE}" ]; then
  echo "[fetch-vendor] Reading pinned SHAs/branches from ${LOCKFILE}"
else
  echo "[fetch-vendor] Lockfile ${LOCKFILE} not found. Proceeding with defaults."
fi

REPOS=(
  "frever-open-global-uma-assets"
  "frever-open-shared-scripts"
  "frever-open-shaderlibrary-urp"
  "frever-open-animation-pack-1"
  "frever-open-animation-pack-2"
  "frever-open-animation-pack-3"
  "frever-open-animation-pack-4"
  "frever-open-character-baking-tool"
  "frever-open-asset-manager-tool"
  "frever-open-setlocation-party-room"
  "frever-open-setlocation-laboratory"
  "frever-open-setlocation-preppy-bedroom"
  "frever-open-setlocation-bohemian-bedroom"
  "frever-open-wardrobe-socks"
  "frever-open-wardrobe-skirt"
  "frever-open-wardrobe-shoes-1"
  "frever-open-wardrobe-shoes-2"
  "frever-open-wardrobe-accessory-1"
  "frever-open-wardrobe-accessory-2"
  "frever-open-wardrobe-body-face-pack"
  "frever-open-wardrobe-glasses-pack"
  "frever-open-wardrobe-haircut-pack"
  "frever-open-wardrobe-headwear-pack"
  "frever-open-wardrobe-jacket-pack"
  "frever-open-wardrobe-jewelry-pack"
  "frever-open-wardrobe-outfit-pack"
  "frever-open-wardrobe-pants-pack"
  "frever-open-wardrobe-makeup-pack"
)

for repo in "${REPOS[@]}"; do
  REF="main"
  if [ -f "${LOCKFILE}" ] && command -v jq >/dev/null 2>&1; then
    LOCKED_REF="$(jq -r ".[\"${repo}\"] // empty" "${LOCKFILE}" 2>/dev/null || true)"
    if [ -n "${LOCKED_REF}" ] && [ "${LOCKED_REF}" != "null" ]; then
      REF="${LOCKED_REF}"
    fi
  fi

  echo "----------------------------------------"
  echo "[fetch-vendor] Processing repository: ${repo} (target ref: ${REF})"

  if [ ! -d "${repo}" ]; then
    echo "[fetch-vendor] Cloning https://github.com/FriendFactory/${repo}.git..."
    git clone --depth 1 "https://github.com/FriendFactory/${repo}.git" "${repo}"
  fi

  (
    cd "${repo}"
    git fetch --depth 1 origin "${REF}" || true
    git checkout --detach FETCH_HEAD 2>/dev/null || git checkout "${REF}" 2>/dev/null || true
  )
done

echo "----------------------------------------"
echo "[fetch-vendor] Vendor repositories successfully fetched and synchronized."
