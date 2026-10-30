# Asset Delivery Readiness Audit

Scope: the Node.js server in `src/` and its tests in `test/`. No APK, bundle or
device capture was used for this audit; client requirements are taken only from
the documentation committed in this repository.

## 1. Baseline (before changes)

`npm test` did not run: importing `src/endpoints.js` threw
`ReferenceError: registerTemporaryAccount is not defined`, so both
`test/dashboard.test.js` and `test/endpoints.test.js` failed before any request
was made. Two further defects were found while tracing the asset path:

| Defect | Location | Effect |
| --- | --- | --- |
| `matchEndpoint(method, path)` / `path.startsWith(...)` used the `node:path` module instead of the request path | `src/server.js` | every request fell through to the dashboard / 404 branch; no API endpoint or asset could ever be served |
| `registerTemporaryAccount` / `parentalConsent` handlers were dropped from `src/handlers-auth.js` while still referenced by `src/endpoints.js` | `src/handlers-auth.js`, `src/endpoints.js` | module load failed; whole server unusable |
| `logUnknown()` referenced an undefined `reqPath` and called `path.join()` on the request-path string | `src/http.js` | unknown routes returned 500, traffic capture threw |
| `/assets/maps` test depended on untracked `data/assets/maps.txt` | `test/endpoints.test.js` | test failed whenever `data/` was absent (it is git-ignored) |

## 2. Asset-related routes and actual behaviour (after fixes)

| Route | Handler | Behaviour |
| --- | --- | --- |
| `GET /assets/maps` | `assetMaps` in `src/handlers-data.js` | optional Bearer auth; reads `<data>/assets/maps.txt`, ignores blank lines and `#` comments, returns `{"maps":[...]}`; `200` even when the file is missing (empty array) |
| `GET /assets/animations` | `assetAnimations` | same as above with `animations.txt` → `{"animations":[...]}` |
| `GET/HEAD /assets/*` | `serveAsset` in `src/assets.js` (new) | streams `data/assets/<path>`; falls back to `application/octet-stream` for unknown extensions; `ETag` = SHA-1 of size+mtime; `Last-Modified`; `Accept-Ranges: bytes`; `Cache-Control: public, max-age=300`; `Range` → `206` + `Content-Range`; unsupported range → `416` + `bytes */<size>`; `If-None-Match` → `304`; missing/traversal → JSON `404` |
| `GET/HEAD /media/*` | `serveAsset` | same, rooted at `data/videos` (mp4/webm content types) |

Route order is: exact API endpoint → static `/assets` `/media` → dashboard →
JSON 404. `/assets/maps` and `/assets/animations` are matched as API endpoints
first, so they are not shadowed by the static file handler.

Storage layout (already produced by the import scripts):

- `data/assets/catalog.json` — catalog written by `import-assets.mjs` /
  `reconstruct-catalog.mjs`
- `data/assets/manifest/<name>.json` — per-file manifest with SHA-256 hash
- `data/assets/bundles/Android/<name>` — bundle bytes
- `data/assets/maps.txt`, `animations.txt` — inventory lists
- `data/videos/` — local video exports

The asset roots are derived from the directory of `dbPath`, so
`FREVERS_DB_PATH=/x/y/frever.db` serves `/x/y/assets` and `/x/y/videos`. Before
this change the static handler and `readAssetListFile` hard-coded the repository
`data/` directory, which made isolated tests impossible.

## 3. Tests and results

New `test/assets.test.js` (11 cases) covers the file-delivery contract, not just
status codes: exact bytes of a UnityFS-looking bundle, a 200 KB streamed bundle,
`Content-Type`, `Content-Length`, `ETag` shape, `Cache-Control`, `Accept-Ranges`,
`Range`/suffix `Range` slices, `416`, `304`, `HEAD`, `catalog.json` as
`application/json`, missing file `404`, encoded traversal rejection, and
`/media` content type.

`test/endpoints.test.js` now writes its own `maps.txt` / `animations.txt` into
the per-test data directory and asserts the exact parsed arrays.

Result after the changes:

```
> node --test test/*.test.js
ℹ tests 52
ℹ suites 5
ℹ pass 52
ℹ fail 0
```

Manual check against a running server (`FREVERS_DB_PATH=/tmp/...`, port 18080)
confirmed: login `200`, `/assets/maps` → `{"maps":["map_demo"]}` with
`no-store`, bundle `200` with 27 bytes matching the file, `ETag`,
`Last-Modified`, `accept-ranges: bytes`, `cache-control: public, max-age=300`,
`catalog.json` → `application/json`, unknown asset → JSON `404`.

## 4. Confirmed missing vs unverified requirements

Confirmed by this repository's source/docs:

- Bundle **files** are deliverable at `/assets/...` and survive Range/ETag
  handling. (Verified by test + manual run.)
- There is **no `AssetBundleIndex` document** anywhere in the server. The client
  contract names `AssetBundleIndex`, `AssetBundleIndexItem`,
  `AssetBundleIndexList` and says cache validation uses SHA-256/MD5 hashes and
  CRC values (`docs/CLIENT_CONTRACT.md` §1.2). Nothing in `src/` emits a bundle
  index; `data/assets/catalog.json` is only a local import log
  (`id`, `name`, `type`, `hash`, `size`, `unlocked`, `price`) and its route and
  field names are not confirmed against the client.
- There is **no bundle/file version resolution** (no version segment, no
  per-platform or per-build selection). `bundles/Android/` is the only platform
  directory.
- There is **no cache-related server state** beyond HTTP validators; the
  documented hash/CRC validation is client-side and no index supplies it.

Unverified / cannot be settled from the server repository alone:

- The exact request path, HTTP method, auth requirement and DTO shape of the
  asset index (`docs/protocol.md` §5 lists `assets/*` and `start-pack/*` as
  **UNKNOWN**).
- Whether the client requires encrypted bundles or a decompression step
  (`AssetBundleLoadEncryptedOperation`, `BundleDecompressor` — see
  `docs/CLIENT_CONTRACT.md` §1.3). The server serves bytes verbatim.
- Whether the client requests inventory via `/assets/maps` at all; that route
  was added from the client contract's endpoint list, not from a device trace.

## 5. Highest-value next step

Capture the client's real asset-index request, then serve it from the existing
catalog. Concretely: run the patched app against FreverS with
`FREVERS_CAPTURE=1` (unknown routes are written to `data/capture/`), open the
character editor, and record the path the client uses for its
`AssetBundleIndex`/`AssetBundleIndexList` (likely under `assets/` or
`start-pack/`). Then add a single route that serialises
`data/assets/catalog.json` + `manifest/*.json` into the observed field names
(bundle name, SHA-256, size, CRC if requested). That is the smallest change that
turns "files are downloadable" into "the client can discover and validate the
files it needs", which is the actual blocker for avatar loading.

