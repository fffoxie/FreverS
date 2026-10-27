# FreverS — status and final report

Last updated: 2026-10-27. Branch: `cline/1mwpfnsk`.

This file is the honest record of what exists, what was verified, and what was
not. FreverS is a **local-only reimplementation of the calls the Frever 4.0.5
client actually makes** — not a clone of the original server, which no longer
exists. No original server code was used or consulted.

## 1. What existed before this session

`git log` at the start (`c2b9675`, `ed1caf4`, `b7714a2`, `846b94d`) already
contained phase 1 and most of phase 2:

| Already present | State |
| --- | --- |
| `docs/analysis.md` | APK inventory, Il2CppDumper/jadx results, SDK list, host verification, TLS/pinning findings |
| `docs/protocol.md` | 18 documented routes, 24 confirmed-but-UNKNOWN paths, evidence trail |
| `docs/final-report.md` | earlier report |
| `src/` server | Node + `node:sqlite`, 18 routes, JWT, scrypt passwords, 404 logging to stdout |
| `test/` | 24 tests, one per route |
| `scripts/smoke.js`, `scripts/setup-termux.sh` | login + profile + avatar smoke; package install |

Missing at that point: `docs/status.md`, request **file** logging, the dashboard,
`scripts/start.sh`, Create PAPK, and a Termux setup that also seeds, tests and
installs the signing tools.

## 2. What changed in this session, and why

| Change | Why |
| --- | --- |
| `scripts/patch-metadata.mjs`, `scripts/papk.mjs`, `docs/papk.md` | Phase 5 did not exist. The string table was measured first (see below) instead of guessing. |
| `src/dashboard.js`, `src/dashboard-page.js` | Phase 4 did not exist. |
| `src/http.js` + `src/config.js`: every request and unknown route is appended to `data/logs/server.log` | Phase 2 item 13 asks for a log **file**; before this it was stdout only. |
| `src/server.js`: dashboard routes handled before the game route table | New phase 4/5 routes; game endpoints untouched. |
| `scripts/start.sh` | Phase 3 item 16 did not exist. |
| `scripts/setup-termux.sh`: installs `openjdk-21 apktool apksigner`, seeds the DB, runs the tests | Phase 3 item 15 asks for one run that leaves the DB seeded and tested. Re-running is safe (`pkg install -y`, `npm install`, `seedAccounts` no-op, tests idempotent). |
| `scripts/run-tests.mjs` (`npm run test:record`) | Dashboard needs a real "tests passing" value instead of a claim. |
| `scripts/smoke.js`: honours `FREVERS_PORT`, refuses a server that is not FreverS | It silently hit port 8080 and failed; found while running it. |
| `test/dashboard.test.js`, `test/papk.test.js` | Tests for the new surfaces, including the "no APK on failure" rule. |
| `docs/status.md` (this file) | Phase 5 deliverable. |

Nothing that already worked was rewritten; the game-facing handlers, models,
auth and protocol docs are unchanged.

## 3. Endpoints: confirmed, implemented, UNKNOWN

Counted from the tables in `docs/protocol.md` (`§4` implemented, `§5` confirmed
but unimplemented). `/health` is a local probe the game never calls and is
excluded.

| | Count |
| --- | --- |
| Confirmed endpoints/paths (rows) | **41** |
| Implemented with a documented shape + test | **17** |
| Confirmed but UNKNOWN shape → 404 + logged | **24** |
| **Coverage of confirmed endpoints** | **41.5 %** (17 / 41) |

The client also has routes that only appear as method names (no recoverable
path); those are not counted anywhere, so the true share of the game's traffic
that works is **unknown and almost certainly lower** than 41.5 %.

Implemented: `GET /api/Client/SupportedVersions`, `POST /connect/token`
(password + refresh_token, plus auth-prefix aliases), `GET|POST
/api/client/urls`, `POST /api/verify-email`, `POST /api/verify-phone-number`,
`POST|PUT /api/credential/username`, `GET|POST /auth/age-confirmation/quiz`,
`GET /auth/age-confirmation/quiz/status`, `GET /group/follow-recommendations`,
`GET /group/follow-back-recommendations`, `GET /group/frever-official`,
`GET /group/star-creators-in-your-country`, `GET /gamification/reward/past`,
`GET /me`, `GET /me/balance`, `GET /group/{id}`, `GET /health`.

UNKNOWN (24 rows): `account/*`, `/Account/Register`,
`/Account/LoginWithGoogle`, `/Account/LoginWithApple`, `invitation-code`,
`assets/*`, `start-pack/*`, `create-page/*`, `gamification/*` claim DTOs,
`video/*`, `me/*` extras. They return 404 and are logged as
`[unknown-route] method=… path=… bodySize=…`, so the next missing call is visible
in the dashboard.

## 4. What was run, and the real output

Environment of this run: Linux x86_64 container, Node 24.22.1, no Android
phone and no Termux. Port 8080 was already occupied here, so the live checks
used 8090.

| Check | Command | Result |
| --- | --- | --- |
| Unit/HTTP tests | `npm test` | **33 pass, 0 fail** (24 existing + 5 dashboard + 4 PAPK) |
| Tests recorded for dashboard | `npm run test:record` | `{ok: true, exitCode: 0}`, 33 pass |
| Live server | `FREVERS_PORT=8090 bash scripts/start.sh` | listening on `0.0.0.0:8090` |
| Smoke (phase 2 item 14) | `FREVERS_PORT=8090 npm run smoke` | `health: 200 (frevers)`, `login: fffoxie ok (access token 1057 chars)`, `profile: Id=1 GroupId=1 Nickname=fffoxie`, `avatar data: group=1 nickname=fffoxie followers=0`, `SMOKE OK` |
| Dashboard page | `curl /dashboard` | `200 text/html; charset=utf-8` |
| Dashboard state | `curl /dashboard/api/state` | accounts `fffoxie, friend`; coverage `17/41 = 41.5 %`; checklist deps/db/server OK, tests OK after the recorded run |
| Create PAPK via dashboard | `POST /dashboard/api/papk` with `{"url":"http://192.168.1.42:8080/"}` | `202`, all 10 steps `ok` |
| Download + MD5 | `curl /dashboard/download/Frever_4.0.5_FreverS.apk` | `200`, 217,326,680 bytes, MD5 `50bf3c97a4e9448eff77b5095447b7b1`, identical to the file the server wrote |
| Signed output | uber-apk-signer `--onlyVerify` | `zipalign verified`, `signature verified [v3]` |
| Patched hosts | metadata inside the APK | 5 × `http://192.168.1.42:8080/`, 0 × `content-prod.frever-api.com/` (only the `web.frever-api.com` share host remains, as intended) |
| Cleartext flag | re-decoded manifest | `android:usesCleartextTraffic="true"` |
| Shell syntax | `bash -n scripts/*.sh` | OK (scripts were not executed under Termux) |

### Termux steps: run or not

| Step | Run here? | Status |
| --- | --- | --- |
| Install Termux from F-Droid | no | not testable in this environment |
| `pkg update`, `pkg install nodejs git openjdk-21 apktool apksigner` | no | package names checked against the Termux package sources, not executed |
| `npm install` | yes (Linux) | OK, no dependencies |
| Create DB + seed accounts | yes | OK, `data/frever.db`, passwords in `data/generated-credentials.txt` (both git-ignored) |
| `npm run test:record` / `npm test` | yes | 33/33 |
| `bash scripts/start.sh` | yes (Linux) | OK, dashboard reachable |
| Dashboard in a phone browser | no | page is mobile-first with no remote resources, but was never opened on a phone |

## 5. Create PAPK: works or not

- **On a PC (x86_64, JDK 17, apktool 2.9.3, uber-apk-signer 1.3.0): works.**
  All ten steps pass, the output is zipaligned and v3-signed, the hosts and the
  manifest are patched, and the MD5 shown on the dashboard matches the download.
- **On Termux: UNVERIFIED.** No Android/Termux environment was available, so no
  run proves the on-device build. What is known statically: Termux ships
  `apktool` 3.0.3 (patched to use Termux's native `aapt2`) and `apksigner`
  (depends on `openjdk-21`); `scripts/papk.mjs` prefers `PATH` tools and only
  falls back to `analysis/tools/` jars, so on the phone it uses those packages.
  If any step fails, the dashboard names it.
- The exact failing step is recorded in `data/papk-status.json` and
  `data/logs/papk.log`; a failed run deletes `output/Frever_4.0.5_FreverS.apk`
  instead of leaving a half-built file.

## 6. What still blocks or could block the client

1. **No device test.** The game was never started against FreverS. The startup
   sequence, the exact auth base URL (`auth/<version>`), the JWT claim names and
   the client's tolerance of partial `Profile` models are all untested.
2. **Hostname length.** The five literals are 39/36/37/36/27 characters and are
   packed with no slack, so the replacement URL must be ≤ 36 characters
   (≤ 27 to patch the develop host too). A longer hostname cannot be patched in
   place; the measured layout is in `docs/papk.md` §1.
3. **Cleartext.** targetSdk 34 blocks plain HTTP, so PAPK sets
   `android:usesCleartextTraffic="true"`. A local CA would not be trusted
   without a `network_security_config` anyway; no pinning was found.
4. **Missing endpoints.** 24 confirmed paths return 404 — notably `assets/*`,
   `start-pack/*`, `create-page/*` and `video/*`. The game may not reach the
   avatar/outfit UI without some of them.
5. **Protobuf.** Some `ServiceBase` calls default to protobuf; FreverS only
   speaks JSON. If a device shows a decode error, that route needs a protobuf
   response path.
6. **SDKs.** Amplitude, OneSignal, Firebase, Sentry, AppsFlyer, Giphy, TikTok,
   Epidemic Sound and 7digital are present but not emulated. Statically nothing
   in the login/startup path calls them; only a device run can confirm.
7. **No GPU is used or needed.** The server is JSON + SQLite; there is no
   rendering, no transcoding and no GPU code path, so it does not promise one.

