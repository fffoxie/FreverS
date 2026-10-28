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

## Dashboard and pointed-APK builder

Open `http://127.0.0.1:8080/admin` (or the phone's LAN address) after `npm start`.
Sign in as `fffoxie` with the seeded password, or paste `data/admin-token.txt`.

The dashboard manages users (soft/hard currency, premium days, admin flag,
nickname, avatar), uploads avatars/music/accessories, and builds a **patched APK
that points at your server**:

- It takes the original Frever 4.0.5 APK you upload.
- It replaces the five API hosts inside `global-metadata.dat` (the real string
  literal table, lengths updated in place).
- It lowers `minSdkVersion`/`targetSdkVersion` to 27 in the binary manifest so
  Android permits cleartext HTTP to the local server.
- It removes the old signature, zipaligns, and signs with a local key generated
  on the phone.
- It serves `FreverS-patched.apk` for download.

Verified end-to-end against the real 217 MB APK: the output installs as
`com.FriendFactory.Frever` 4.0.5 (409), is zipaligned, passes `apksigner verify`,
and contains no `*.frever-api.com` host strings.

The patched APK has a different signing key, so **uninstall the original Frever
first**; Android will refuse an in-place update.

The dashboard is published on the `gh-pages` branch (and mirrored in `docs/`).
Enable it once in **Settings → Pages → Deploy from a branch → `gh-pages` / `/`**;
the link is `https://fffoxie.github.io/FreverS/`. (This sandbox cannot flip the
Pages setting itself.) A browser opened on the phone can reach
`http://127.0.0.1:8080`, but an HTTPS page calling a LAN IP over HTTP is blocked
as mixed content. For managing another device, open the dashboard served by the
phone (`http://<phone-ip>:8080/admin`) instead.

## Any account

By default an unknown username creates a local account on its first password
login (username and password at least 3 characters). The first account
(`fffoxie`) is the administrator; new accounts are ordinary users. Disable this
with `FREVERS_ALLOW_ANY_ACCOUNT=0`.

## Reset and update

```sh
npm run reset          # deletes accounts, currency, uploads, build history
npm run reset -- --hard  # also deletes the source APK and signing key
npm run update         # git pull --ff-only + npm install, then restart
```

The database is migrated in place on start, so updating keeps accounts, currency,
uploads and builds.

## Requirements

- Node.js **22.13 or newer** (24.x recommended). The server uses the built-in `node:sqlite` module.
- Java (`openjdk-17`), `apksigner`, `zipalign`, `zip`/`unzip` for the APK builder.
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
   pkg install nodejs git openjdk-17 zip unzip
   pkg install apksigner zipalign   # for the APK builder
   node --version      # must be >= 22.13 (24.x recommended)
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
| `FREVERS_ALLOW_ANY_ACCOUNT` | `1` | unknown username creates an account on first login; `0` disables |
| `FREVERS_ADMIN_TOKEN` | generated in `data/admin-token.txt` | dashboard token alternative to admin login |
| `FREVERS_APK_PATH` | `data/apk/source.apk` | original APK used by the builder |
| `FREVERS_KEYSTORE_PASS` | generated in `data/keys/keystore.pass` | APK signing key password |

If the game runs on the same phone and something still connects through the LAN
address, set `FREVERS_PUBLIC_BASE_URL=http://<LAN-IP>:8080` so the URLs the client
receives point back to the reachable address.

## Pointing the game at the server

The stock APK is hard-wired to HTTPS hosts and, because it targets Android 14,
blocks cleartext HTTP. DNS alone cannot fix that. Use the dashboard's **APK
builder** (see above) instead:

1. Upload the original `Frever_4.0.5_APKPure.apk` once.
2. Enter the address the phone will use (`http://127.0.0.1:8080` on the same
   phone, or `http://<LAN-IP>:8080` on another device). The address must be at
   most 27 characters because it replaces Frever's shortest host literal.
3. Build and download `FreverS-patched.apk`, uninstall the original Frever, then
   install the patched APK.

The builder does not need a CA and does not disable TLS verification: it lowers
the manifest target to 27 so the platform's default cleartext policy allows your
plain-HTTP local server, and rewrites the real host literals in the IL2CPP
metadata. If you later want HTTPS, terminate TLS with a certificate Android
trusts and use an `https://` base URL instead.

Do not install the patched APK on top of the original: the local signing key is
different, so Android requires an uninstall first (which deletes the original
app's local data).

## Tests and smoke test

```sh
npm test        # 36 tests: endpoints, admin API, login, APK patchers
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

## Limits: what this build does **not** do

These were requested but cannot be delivered honestly from the APK and this
server. They are **not implemented**, and no placeholder catalog is generated,
because that would invent data the client cannot use.

| Requested | Status | Why / what is missing |
| --- | --- | --- |
| Entire original catalog: all animations, accessories, makeup, base characters, maps | **Not implemented** | The APK contains Unity serialized data/asset files, not a catalog the server can enumerate. The live game receives catalog metadata and bundle URLs from `AssetManager`/`ClientServer` endpoints whose protobuf shapes were not recovered. Serving guessed JSON would not make the client load it. |
| VRChat addon | **Not applicable** | No VRChat integration exists in the APK. Frever is an Android Unity app; there is no addon to "enable". |
| Blender addon | **Not applicable** | No Blender addon is bundled or referenced. A converter would be a separate project, not a FreverS server endpoint. |
| Mixamo custom animations | **Not implemented** | The client loads Unity AssetBundles with Frever's rig/animation setup. An FBX from Mixamo cannot be injected into the installed APK by the server. This needs a Unity asset pipeline plus client import code. |
| Custom maps | **Not implemented** | Same asset-bundle and level-protocol problem as animations. |
| Export finished videos to the gallery | **Not implemented** | Video stitching/encoding happens in the client's native plugins. The confirmed server flow has no finished-video upload. Exporting to Android MediaStore requires a client-side patch, not a server route. |
| Same studio as Frever | **Not implemented** | The studio is client UI over catalog/video endpoints. With the catalog and video protocols unknown, the server cannot reproduce it. |

What would unblock these:

1. A device trace or a captured session of the original client while it loads
   the store/catalog (method, path, protobuf/JSON body and response).
2. The AssetManager bundle manifest mapping bundle names/URLs to the local
   `assets/bin/Data` files.
3. For video export, a client patch using Android `MediaStore` or a share intent,
   plus knowledge of where the encoded file is written.
4. For Mixamo/custom maps, a Unity project that builds compatible bundles and a
   client hook that accepts them.

Until item 1/2 exist, the dashboard can store and serve your own uploaded
avatars/music/accessories, but the game will not display them in its store.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Cannot find module 'node:sqlite'` | Node is older than 22.13. `pkg upgrade` in Termux, or install a current Node. |
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
src/db.js            SQLite schema/migrations, scrypt, accounts, currency
src/auth.js          JWT issue/verify, Basic/Bearer parsing
src/http.js          body parsing (JSON/form/multipart), logging
src/models.js        confirmed client model shapes
src/handlers-*.js    client endpoint handlers
src/endpoints.js     client route table
src/admin*.js        dashboard API (auth, users, assets, builds)
src/apk/             IL2CPP metadata + AXML patchers, signing pipeline
src/static.js        serves docs/ dashboard at / and /admin
src/server.js        HTTP server, admin/static dispatch, 404 logging
docs/                protocol/analysis + dashboard (Pages: main /docs)
test/                35 node:test tests
scripts/smoke.js     login + avatar/group smoke test
scripts/setup-termux.sh
scripts/reset-server.sh
scripts/update-server.sh
docs/analysis.md     APK, IL2CPP, host, TLS, APK-patch findings
docs/protocol.md     endpoint reference and UNKNOWN list
docs/final-report.md
```

## Documentation

- [`docs/analysis.md`](docs/analysis.md) — APK verification, unpacked contents,
  IL2CPP/dump details, Java findings, SDKs, hosts, version check, TLS/pinning.
- [`docs/protocol.md`](docs/protocol.md) — every implemented endpoint with
  method, path, headers, body, response, caller and flow, plus the confirmed
  but unimplemented paths and the remaining UNKNOWNs.
- [`docs/final-report.md`](docs/final-report.md) — endpoints found/implemented/
  UNKNOWN, what was tested, what could not be tested, and the certificate
  blocker.


