# Final report

## Endpoints found

Phase 1 confirmed **321 methods** with path-like literals. The ones relevant to
startup, login and avatar were traced to their exact caller and documented in
`docs/protocol.md`. The original candidate list was checked item by item; four
claims were wrong (see `docs/protocol.md` §6):

- `/api/credential/username` is `UpdateUsername`, not login; login is
  `connect/token` (OAuth password/refresh-token grant).
- `/auth/age-confirm` does not exist; it is
  `/auth/age-confirmation/quiz` + `/quiz/status`.
- `group/public/group/star-creators-in-your-country` does not exist; it is
  `group/star-creators-in-your-country`.
- `com.friendfactory.bridge` is not a Java package; `SupportedVersions` is a C#
  class in `Bridge.EnvironmentCompatibility`.

## Endpoints implemented (18 routes)

`GET /api/Client/SupportedVersions`, `POST /connect/token` (password and
refresh-token grants, with auth-prefix aliases), `GET|POST /api/client/urls`,
`POST /api/verify-email`, `POST /api/verify-phone-number`,
`POST|PUT /api/credential/username`, `GET|POST /auth/age-confirmation/quiz`,
`GET /auth/age-confirmation/quiz/status`, `GET /group/follow-recommendations`,
`GET /group/follow-back-recommendations`, `GET /group/frever-official`,
`GET /group/star-creators-in-your-country`, `GET /gamification/reward/past`,
`GET /me`, `GET /me/balance`, `GET /group/{id}`, `GET /health`.

Every route has the method, path, auth requirement, request shape, response

## Local platform features (verified)

| Feature | Status | Evidence |
| --- | --- | --- |
| Web dashboard served from Termux | Done | `/` and `/admin` static UI; admin API tests |
| GitHub Pages dashboard | Served from `docs/` via Pages | Same static files; browser mixed-content limit documented |
| User management: soft/hard currency, premium days, admin, nickname, avatar | Done | PATCH `/admin/api/users/:id`; `/me` reflects balance/premium |
| Asset uploads: avatars, music, accessories | Done | raw upload, SQLite row, public `/assets/{id}` |
| Patched APK generator | Done | real 217 MB APK built, zipaligned, signed, verified |
| Host rewrite | Done | all five `*.frever-api.com` literals replaced in metadata |
| Cleartext for local HTTP | Done | manifest min/target 28/34 -> 27/27 |
| Any-account login | Done | unknown username auto-creates a user; wrong password rejected |
| Reset / update scripts | Done | `npm run reset`, `npm run reset -- --hard`, `npm run update` |
| Tests | 36 pass | endpoints, admin API, any-account, patchers |

## Requested but not delivered

The full original catalog (animations, accessories, makeup, base characters,
maps), VRChat/Blender addons, Mixamo animation import, custom maps, gallery
export and the full studio are **not implemented**. They are not server features
that exist in the APK, and the AssetManager/catalog and video-export protocols
were not recovered. Generating guessed catalog data would violate the
no-inventions requirement and would not make the client load it. The concrete
blockers and what evidence would unblock them are listed in `README.md`
("Limits: what this build does not do").


shape, caller and screen documented in `docs/protocol.md`.

## UNKNOWN (deliberately returning 404)

`/Account/Register` response, `/Account/LoginWithGoogle`,
`/Account/LoginWithApple`, all `account/*` parent/e-mail/consent endpoints,
`/api/credential` status endpoints, `assets/*`, `start-pack/*`, `create-page/*`,
`gamification/*` claim DTOs, `video/*`, `me/*` extras. Their paths are known, but
the request/response shapes were not recovered well enough to implement without
guessing. Unknown calls are logged as `[unknown-route] method=… path=… bodySize=…`
and return 404.

The exact auth base URL (`auth/<version>`), the `ParseToken` JSON keys, and three
anonymous request bodies are also UNKNOWN; the server accepts aliases/plausible
field names and emits both PascalCase and snake_case JWT claims.

## What was tested and how

- `npm test`: **35 Node tests**. Each implemented endpoint is called over real
  HTTP against a throw-away SQLite database; responses are asserted field by
  field and by type. Covers bad login, refresh-token grant, both credential
  methods, auth-prefix aliasing, 404 + `[unknown-route]` logging, the admin API,
  asset upload/download, any-account creation, currency/premium propagation and
  both APK patchers.
- `npm run smoke`: live server. Verified health, login as `fffoxie`, `GET /me`
  (`Id=1 GroupId=1 Nickname=fffoxie`) and `GET /group/1` (avatar/group data).
  Result: `SMOKE OK`.
- Full APK build against `Frever_4.0.5_APKPure.apk`: built, zipaligned,
  v1+v2 signed, downloaded over the admin API. Verified with `zipalign -c 4`,
  `apksigner verify`, androguard (`com.FriendFactory.Frever` 4.0.5, min/target
  27) and a metadata scan (zero Frever hosts, five local URLs).
- `bash -n scripts/setup-termux.sh` and syntax checks for every new module.
- APK: MD5/size and both binary hashes checked; Il2CppDumper dump generated;
  jadx run; manifest parsed with androguard.

## What could not be tested

- No Android device or emulator: the patched APK was never installed or launched.
  The startup sequence, exact auth base URL, JWT claim keys, partial-profile
  tolerance, SDK startup gates, and whether targetSdk 27 installs/behaves on a
  given Android build remain unconfirmed on hardware.
- Protobuf responses were not implemented or tested; the client defaults some
  service calls to protobuf.
- The full catalog/AssetManager, video export and studio flows were not tested
  because they are not implemented.

## Certificate / pinning blocker

- No certificate pinning was found in the app's Java code, and no SPKI pins in
  the C# metadata. BestHTTP's optional TLSSecurity addon is present but not
  configured with pins.
- The stock manifest has no `networkSecurityConfig`/`usesCleartextTraffic` and
  targets 34, so HTTP is blocked and user CAs are not trusted.
- The generated APK solves this without touching TLS: it rewrites the API hosts
  and lowers min/target to 27 so cleartext is permitted. The server never
  disables certificate validation and does not need a CA.
- If a device rejects targetSdk 27, the fallback is an apktool rebuild with a
  `network_security_config` (not implemented here).
