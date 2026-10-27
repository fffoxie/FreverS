# FreverS

A private, local-only server for **Frever 4.0.5** (`com.FriendFactory.Frever`).
It is built from scratch for two people (`fffoxie` and one friend), runs as a
single Node.js process with SQLite, and has no telemetry, no e-mail/SMS delivery
and no external services.

The client was reverse-engineered first: see [`docs/analysis.md`](docs/analysis.md)
and the endpoint reference in [`docs/protocol.md`](docs/protocol.md). Only
endpoints whose path **and** caller were confirmed in the APK are implemented.
Everything else returns `404` and is logged, so the next missing call is visible.

> This is not a public service. Do not expose it to the internet.

## What is implemented

| Area | Routes |
| --- | --- |
| Startup | `GET /api/Client/SupportedVersions` |
| Login | `POST /connect/token` (password + refresh_token grants, with aliases) |
| Hosts | `GET/POST /api/client/urls` |
| Account | `POST /api/verify-email`, `POST /api/verify-phone-number`, `POST/PUT /api/credential/username` |
| Age gate | `GET/POST /auth/age-confirmation/quiz`, `GET /auth/age-confirmation/quiz/status` |
| Profile / avatar | `GET /me`, `GET /group/{id}`, `GET /group/frever-official` |
| Social | `GET /group/follow-recommendations`, `GET /group/follow-back-recommendations`, `GET /group/star-creators-in-your-country` |
| Rewards / wallet | `GET /gamification/reward/past`, `GET /me/balance` |
| Local | `GET /health` |

Social lists are empty arrays (there is no real social graph), and the official
profile is a local placeholder group. All response shapes are documented in
`docs/protocol.md`; every implemented route has an automated test.

**Coverage: 17 of 41 confirmed paths implemented (41.5 %)**; the other 24 are
confirmed to exist but their request/response shapes were not recovered, so they
stay UNKNOWN and return 404. This is not a clone of the original server — it
answers only the calls the client was proven to make. The server needs no GPU:
it is JSON over HTTP plus SQLite, with no rendering or transcoding.

## Requirements

- Node.js **22.13 or newer** (24.x recommended). The server uses the built-in `node:sqlite` module.
- Termux from **F-Droid** on the phone, or any Linux/macOS machine for local
  development.
- No npm dependencies, no compile step.

## Install on Termux (phone)

In this order:

1. Install **Termux from F-Droid**, not from the Play Store. The Play Store
   build is abandoned and its packages are too old:
   <https://f-droid.org/packages/com.termux/>
2. `pkg install git`, then clone the repository:

   ```sh
   pkg install git
   git clone https://github.com/fffoxie/FreverS.git
   cd FreverS
   ```

3. Run the one-shot setup. It installs Node.js, git, Java and the APK tools,
   creates and seeds the database, and runs the tests. It is safe to run twice:

   ```sh
   bash scripts/setup-termux.sh
   ```

4. Start the server (this also serves the dashboard):

   ```sh
   bash scripts/start.sh
   ```

5. Open the dashboard in the phone browser:

   ```
   http://127.0.0.1:8080/dashboard
   ```

6. If another device needs to connect (or the game runs elsewhere), find the
   phone's LAN IP:

   ```sh
   ip addr     # look for the wlan0 address, e.g. 192.168.1.42
   ```

   then use `http://<phone-LAN-IP>:8080`.

The server listens on `0.0.0.0:8080` by default (`FREVERS_PORT`, `FREVERS_HOST`).
Termux may be killed in the background; `scripts/start.sh` takes a
`termux-wake-lock` when that command exists, and disabling battery optimisation
for Termux helps. Only two people use this server — do not expose the port to the
internet.

## Dashboard

The dashboard is served by the same process at `/dashboard` (no build step, no
remote libraries, mobile-first):

- setup checklist — dependencies, database, server, tests — each with one
  copy-able command;
- server status and the last 50 log lines;
- the account list (usernames only, never passwords);
- coverage of the confirmed endpoints, read from `docs/protocol.md`;
- **Create PAPK**, a button that builds the patched client for this phone.

## Create PAPK

"Create PAPK" turns the original APK into one that talks to this server: it
rewrites the five `*.frever-api.com` literals inside
`global-metadata.dat` and enables cleartext traffic in the manifest, rebuilds and
signs the result with a keystore generated on first use (`~/.frevers/`, outside
the repository). The output goes to `output/Frever_4.0.5_FreverS.apk`,
git-ignored, and the dashboard shows its MD5 plus a download link.

Requirements: the original APK at `analysis/Frever_4.0.5_APKPure.apk`
(MD5 `c53f40eb25c8738538981ac923871917`, git-ignored) and `apktool` +
`apksigner` + Java — installed by `scripts/setup-termux.sh` on the phone,
`analysis/tools/` jars on a PC.

The target URL must be **≤ 36 characters** because the host strings are packed
with no slack; a longer one stops the build at step `check-target-url`. Every
step is logged; on failure the failing step is shown and no APK is produced.
Measurements, the verified PC run and the Termux fallback are in
[`docs/papk.md`](docs/papk.md).

## First start and accounts

On first start the database is created at `data/frever.db` and two accounts are
seeded:

| Account | Username env | Password env |
| --- | --- | --- |
| User 1 | `FREVERS_USER1` (default `fffoxie`) | `FREVERS_USER1_PASSWORD` |
| User 2 | `FREVERS_USER2` (default `friend`) | `FREVERS_USER2_PASSWORD` |

Passwords are hashed with scrypt. If a password variable is not set, a random
password is generated **once** and written to
`data/generated-credentials.txt` (mode 0600, git-ignored). Set the variables for
a predictable setup:

```sh
FREVERS_USER1_PASSWORD='choose-a-password' \
FREVERS_USER2_PASSWORD='another-password' \
npm start
```

The database and generated credentials are never committed. To start over, stop
the server and delete `data/` (this deletes the accounts).

## Configuration

All settings are environment variables; there are no secrets in the repository.

| Variable | Default | Meaning |
| --- | --- | --- |
| `FREVERS_PORT` or `PORT` | `8080` | listen port |
| `FREVERS_HOST` | `0.0.0.0` | listen address |
| `FREVERS_DB_PATH` | `data/frever.db` | SQLite file |
| `FREVERS_PUBLIC_BASE_URL` | `http://127.0.0.1:<port>` | URL sent in `TokenResponse` / `ServicesUrls` |
| `FREVERS_TOKEN_SECRET` | generated in `data/token-secret` | JWT signing key |
| `FREVERS_USER1` / `FREVERS_USER2` | `fffoxie` / `friend` | usernames |
| `FREVERS_USER1_PASSWORD` / `FREVERS_USER2_PASSWORD` | generated | seed passwords |
| `FREVERS_ACCESS_TOKEN_TTL` | `3600` | access token lifetime (s) |
| `FREVERS_REFRESH_TOKEN_TTL` | `2592000` | refresh token lifetime (s) |
| `FREVERS_MIN_BUILD` / `FREVERS_MAX_BUILD` | `0` / `999999` | accepted app builds |
| `FREVERS_BRIDGE_MIN` / `FREVERS_BRIDGE_MAX` | `0.0.0` / `99.99.99` | accepted bridge versions |
| `FREVERS_LOG_REQUESTS` | `1` | set `0` to silence per-request lines |
| `FREVERS_LOG_FILE` | `data/logs/server.log` | request log file (method, path, status, size, ms) |
| `FREVERS_LOG_BODY_PREVIEW` | `512` | bytes of an unknown request body to log |

If the game runs on the same phone and something still connects through the LAN
address, set `FREVERS_PUBLIC_BASE_URL=http://<LAN-IP>:8080` so the URLs the client
receives point back to the reachable address.

## Pointing the game at the server

The APK is hard-wired to HTTPS hosts and, because it targets Android 14, it
blocks cleartext HTTP. The stock APK therefore **cannot** be redirected by DNS
alone; see `docs/analysis.md` §8 for the full reasoning. A working setup uses a
patched client that:

1. replaces the five `*.frever-api.com` host strings with the local base URL,
   and
2. enables cleartext traffic for the app (`usesCleartextTraffic="true"` or a
   `network_security_config` that permits the local host).

The server does not install a CA, does not disable certificate validation, and
does not speak TLS. If you prefer to keep the original HTTPS URLs, terminate TLS
with a trusted certificate for those names and redirect at the network layer;
without an app-level trust exception Android will reject a local CA on targetSdk
34.

## Tests and smoke test

```sh
npm test        # 33 tests: one per implemented endpoint, dashboard, PAPK, errors
npm run test:record  # same suite, records the result for the dashboard
npm run smoke   # requires a running server
```

The smoke script logs in as user 1 and fetches that user's group/avatar data:

```sh
# terminal 1
FREVERS_USER1_PASSWORD='choose-a-password' npm start

# terminal 2
FREVERS_USER1_PASSWORD='choose-a-password' npm run smoke
```

It prints the health status, login result, profile (`Id`, `GroupId`, `Nickname`)
and avatar/group data, then `SMOKE OK`.


## How to add an endpoint

1. **Take the route from `docs/protocol.md`.** Copy the confirmed method, path,
   auth requirement, request shape and response shape. If the shape says
   UNKNOWN, do not guess: capture a client trace or add more reverse-engineering
   first, then update the table.
2. **Add the handler** in `src/handlers-auth.js` (login/account) or
   `src/handlers-data.js` (profiles/social). Return `{ body }`; throw
   `HttpError(status, message)` for errors. Use `authenticate(ctx, true)` when
   the endpoint needs a Bearer token and `ctx.db` for SQLite.
3. **Add the route** to `src/endpoints.js` with a unique `id`, `method`, `paths`
   and `description`. Keep the literal path exactly as documented. Add aliases
   only when the client's base-URL prefix is genuinely uncertain.
4. **Add a test** in `test/endpoints.test.js` that starts the test server (the
   `before` hook already does), calls the route with real credentials, and
   asserts every documented field and its type. If the endpoint mutates data,
   use the second account so later tests are unaffected.
5. Run:

   ```sh
   npm test
   npm start            # in another terminal
   npm run smoke
   ```

6. Restart the game client and watch the server log. A missing call appears as:

   ```text
   [unknown-route] method=GET path=/some/path bodySize=0 contentType=- body=""
   [http] GET /some/path 404 82B 0ms
   ```

   Add exactly that route, with its real shape from the APK, and repeat.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Cannot find module 'node:sqlite'` | Node is older than 22.13. `pkg upgrade` in Termux, or install a current Node. |
| `EADDRINUSE` | Another server uses 8080. `FREVERS_PORT=8081 npm start`, and update the patched client. |
| Game cannot reach `127.0.0.1:8080` | Same-phone patched build only. For another device use the phone's `wlan0` IP. |
| Another device times out | Both devices must be on the same Wi-Fi; guest Wi-Fi often blocks client-to-client traffic. Check `FREVERS_HOST=0.0.0.0` and Android battery settings. |
| Server log stays empty | The patch still points at `*.frever-api.com`; the request never reached the phone. |
| `CLEARTEXT communication not permitted` | Manifest patch missing. See “Pointing the game at the server” and use Create PAPK. |
| Create PAPK fails | Open the dashboard; the failing step is named. `check-tools` means apktool/apksigner/java are missing, `check-target-url` means the address is longer than 36 characters. See `docs/papk.md`. |
| 404 for a route that exists in `docs/protocol.md` §5 | It is deliberately not implemented; the shape is UNKNOWN. Add it only with a confirmed shape. |
| Forgot the generated password | `cat data/generated-credentials.txt`, or delete `data/` and start again with password env vars. |
| Login works but profile screen is empty | The token claims or partial `Profile` shape may not match. Compare the `[http]` responses for `/me` and `/group/{id}` with `docs/protocol.md`, and check the JWT payload with `node -e` if needed. |

## Repository layout

```text
src/config.js        environment + defaults
src/db.js            SQLite schema, scrypt hashing, account seeding
src/auth.js          JWT issue/verify, Basic/Bearer parsing
src/http.js          body parsing (JSON/form/multipart), logging
src/models.js        confirmed client model shapes
src/handlers-*.js    endpoint handlers
src/endpoints.js     route table
src/server.js        HTTP server + 404 logging
src/dashboard.js     dashboard state, coverage parsing, PAPK trigger
src/dashboard-page.js  the dashboard page (HTML/CSS/JS, no build step)
test/                node:test suite (endpoints, dashboard, PAPK)
scripts/smoke.js     login + avatar/group smoke test
scripts/start.sh     start server + dashboard
scripts/setup-termux.sh
scripts/papk.mjs     Create PAPK pipeline (decode, patch, build, sign)
scripts/patch-metadata.mjs  global-metadata.dat host patcher
scripts/run-tests.mjs       runs the tests and records the result
docs/analysis.md     APK, IL2CPP, host, TLS findings
docs/protocol.md     endpoint reference and UNKNOWN list
docs/papk.md         measured string layout and PAPK procedure
docs/status.md       final status report (what was tested, what was not)
```

## Documentation

- [`docs/analysis.md`](docs/analysis.md) — APK verification, unpacked contents,
  IL2CPP/dump details, Java findings, SDKs, hosts, version check, TLS/pinning.
- [`docs/protocol.md`](docs/protocol.md) — every implemented endpoint with
  method, path, headers, body, response, caller and flow, plus the confirmed
  but unimplemented paths and the remaining UNKNOWNs.
- [`docs/papk.md`](docs/papk.md) — measured `global-metadata.dat` layout, the
  host patch, the verified PC build and the Termux fallback.
- [`docs/status.md`](docs/status.md) — the final report: what existed before,
  what changed, coverage, tests, Termux steps, PAPK status and blockers.


