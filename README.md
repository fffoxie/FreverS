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

## Requirements

- Node.js **22.5 or newer** (the server uses the built-in `node:sqlite` module).
- Termux from **F-Droid** on the phone, or any Linux/macOS machine for local
  development.
- No npm dependencies, no compile step.

## Install on Termux (phone)

1. Install **Termux from F-Droid**, not from the Play Store. The Play Store build
   is abandoned and its Node package is too old:
   <https://f-droid.org/packages/com.termux/>
2. Open Termux and run:

   ```sh
   pkg update && pkg upgrade
   pkg install nodejs git
   node --version      # must be >= 22.5
   ```

3. Clone and start:

   ```sh
   git clone https://github.com/fffoxie/FreverS.git
   cd FreverS
   npm install         # no dependencies; verifies package.json
   npm start
   ```

   The server listens on `0.0.0.0:8080` by default.

4. Find the phone's LAN address (needed when the game runs on another device):

   ```sh
   ip addr
   # or, if available:
   ifconfig
   ```

   Look for the `wlan0` address, e.g. `192.168.1.42`.

5. Point the client at the server:
   - **Same phone** (patched client installed on the Termux phone):
     `http://127.0.0.1:8080`
   - **Another device** on the same Wi-Fi: `http://<phone-LAN-IP>:8080`
     (e.g. `http://192.168.1.42:8080`).

6. Optional: keep it running while Termux is in the background:

   ```sh
   termux-wake-lock
   npm start
   ```

   Android may still kill Termux; disable battery optimisation for Termux.

`scripts/setup-termux.sh` performs the install steps in one go (it cannot install
Termux itself).

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
npm test        # 21 tests, one per implemented endpoint + error/404 cases
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
| `Cannot find module 'node:sqlite'` | Node is older than 22.5. `pkg upgrade` in Termux, or install a current Node. |
| `EADDRINUSE` | Another server uses 8080. `FREVERS_PORT=8081 npm start`, and update the patched client. |
| Game cannot reach `127.0.0.1:8080` | Same-phone patched build only. For another device use the phone's `wlan0` IP. |
| Another device times out | Both devices must be on the same Wi-Fi; guest Wi-Fi often blocks client-to-client traffic. Check `FREVERS_HOST=0.0.0.0` and Android battery settings. |
| Server log stays empty | The patch still points at `*.frever-api.com`; the request never reached the phone. |
| `CLEARTEXT communication not permitted` | Manifest patch missing. See “Pointing the game at the server”. |
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
test/                node:test suite (one test per endpoint)
scripts/smoke.js     login + avatar/group smoke test
scripts/setup-termux.sh
docs/analysis.md     APK, IL2CPP, host, TLS findings
docs/protocol.md     endpoint reference and UNKNOWN list
```

## Documentation

- [`docs/analysis.md`](docs/analysis.md) — APK verification, unpacked contents,
  IL2CPP/dump details, Java findings, SDKs, hosts, version check, TLS/pinning.
- [`docs/protocol.md`](docs/protocol.md) — every implemented endpoint with
  method, path, headers, body, response, caller and flow, plus the confirmed
  but unimplemented paths and the remaining UNKNOWNs.


