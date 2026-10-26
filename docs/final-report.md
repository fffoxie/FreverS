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

- `npm test`: 24 Node tests. Each implemented endpoint is called over real HTTP
  against a throw-away SQLite database; responses are asserted field by field and
  by type. Also covers bad login, refresh-token grant, both credential-method
  variants, auth-prefix aliasing, and the 404 + `[unknown-route]` log.
- `npm run smoke`: live server on port 8099. Verified health, login as `fffoxie`,
  `GET /me` (`Id=1 GroupId=1 Nickname=fffoxie`) and `GET /group/1` (avatar/group
  data for the logged-in user). Result: `SMOKE OK`.
- `bash -n scripts/setup-termux.sh` (the script itself was not executed because
  it would install packages in this container).
- APK: MD5/size and both binary hashes checked; Il2CppDumper dump generated;
  jadx run; manifest parsed with androguard.

## What could not be tested

- No Android device or emulator: the actual game was never started against the
  server. This means no confirmation of the startup sequence, of the exact auth
  URL, of JWT claim names, of the client's tolerance for partial profile models,
  or of which third-party SDKs gate startup.
- No patched APK was produced. Host redirection and cleartext enablement are
  documented but unverified on a device.
- Protobuf responses were not implemented or tested; the client defaults some
  service calls to protobuf.

## Certificate / pinning blocker

- No certificate pinning was found in the app's Java code, and no SPKI pins in
  the C# metadata. BestHTTP's optional TLSSecurity addon is present but not
  configured with pins.
- The manifest has no `networkSecurityConfig` and no `usesCleartextTraffic`, and
  targetSdk is 34. Therefore cleartext HTTP is blocked and **user-installed CAs
  are not trusted**. DNS override plus a local CA is not sufficient on the stock
  APK.
- Minimum: patch the client to use the local HTTP base URL **and** allow
  cleartext (or patch a network-security-config that trusts the local CA). The
  server does not disable certificate validation.
