# Phase 2 — Protocol reference

Every entry below was recovered from the IL2CPP dump and confirmed by ARM
cross-references to the endpoint string. Anything that could not be confirmed is
marked **UNKNOWN**. Field names are the client's Newtonsoft property names
(PascalCase) unless the endpoint is OAuth/form based (snake_case).

The client wraps successful model JSON in its own `Result` / `Result<T>` /
`ArrayResult<T>` objects **after** deserialisation. The server therefore returns
the bare model, not `{isError:false,...}`. Error responses are plain
`{error, error_description, message, isError, errorMessage}` with a 4xx status.
This wrapper behaviour is high-confidence but was not device-tested.

## 1. Hosts and URL construction

`Bridge.Authorization.Configs.AuthServerConfigurations..ctor` builds this table:

| `FFEnvironment` | Host |
| --- | --- |
| Production (1) | `https://content-prod.frever-api.com/` |
| Stage (2) | `https://content-stage.frever-api.com/` |
| Test (3) | `https://content-test.frever-api.com/` |
| Develop (4) | `https://dev.frever-api.com/` |
| ProductionUSA (5) | `https://content-prod-us.frever-api.com/` |

`AuthConfig` stores `Host` and `IdentityServerURL = CombineUrls(Host, "auth")`.
`AuthService.AuthUrl` is `AddApiVersion(IdentityServerURL, ApiVersion)`.
`AuthService.BuildUrl(path)` prefixes `api/`; service calls concatenate
`Host + "/" + path` via `ServiceBase.ConcatUrl`.

The precise `AddApiVersion` result could not be recovered (see
`docs/analysis.md` §10), so the token endpoint is served on several plausible
prefixes. They are aliases of one handler:

- `POST /connect/token`
- `POST /auth/connect/token`
- `POST /api/connect/token`
- `POST /api/auth/connect/token`
- `POST /4.0.5/connect/token` (and the `auth/` / `api/` variants)

The other endpoints are registered at the exact literal path found in the
binary. A client patch that changes the host to `http://127.0.0.1:8080` will
produce paths relative to that base; if a device trace shows an extra prefix,
add an alias in `src/endpoints.js` (see README “How to add an endpoint”).

## 2. Headers

Recovered from `Bridge.Authorization.RequestHelper`,`AuthService` and
`BuildUrl`/`BuildShareProfileUrl`:

| Header | When | Value |
| --- | --- | --- |
| `Authorization: Bearer <token>` | every authenticated service call | JWT returned by `connect/token` |
| `Authorization: Basic <base64>` | `connect/token`, `/Account/Register` | base64 of `Server:<redacted secret embedded in the APK>` (`AuthService.ClientIdAndSecret`; the extracted value is deliberately not stored in this repository) |
| `X-Device-Id` | auth and credential calls | `AuthService.DeviceId` (Android device id) |
| `X-Session-Id` | all `RequestHelper` requests | session id passed to `RequestHelper` ctor |
| `x-unity-version` | all `RequestHelper` requests | Unity version string |
| `Content-Type: application/json` | `/Account/Register`, other JSON POSTs | — |
| `Content-Type: multipart/form-data` or urlencoded | `connect/token` | fields from `ICredentials.GetLoginCredentials()` |

The local server only *records* the Basic client id. It does not enforce the
hard-coded secret, because that secret ships inside the APK and enforcing it
adds no security for a two-user LAN server.

## 3. Login flow (confirmed)

1. `ServerBridge` chooses an environment (default Production) and creates
   `AuthService` with `AuthConfig.Host` / `IdentityServerURL`.
2. `CompatibilityService` performs `GET <host>/api/Client/SupportedVersions`
   and compares the result with `VersionProvider.BridgeVersion` /
   `ApiVersion` using `IsCompatible`.
3. `AuthService.LogInAsync(ICredentials)`:
   - validates `credentials.IsValid`;
   - sets `Authorization: Basic base64(ClientIdAndSecret)` and `X-Device-Id`;
   - POSTs `AuthUrl + credentials.LoginEndPoint` with the credential fields.
   - For `UsernameAndPasswordCredentials` the endpoint is `connect/token`,
     `GrantType = "password"`, and `GetLoginCredentials()` returns
     `scope = "friends_factory.creators_api offline_access"`,
     `grant_type = "password"`, `username`, `password`.
   - For `EmailAndPasswordCredentials`: same with `email` instead of `username`.
   - For `PhoneNumberCredentials`: `grant_type = "phone_number_token"`,
     fields `phone_number`, `verification_token`.
   - For `EmailCredentials`: `grant_type = "email_auth_token"`,
     fields `email`, `verification_token`.
   - For Google/Apple: `/Account/LoginWithGoogle` / `LoginWithApple`.
4. Response is deserialised into `Bridge.Authorization.TokenResponse`:
   `access_token`, `refresh_token`, `server_url`, `transcoding_server`,
   `video_server`, `social_server`, `notification_server`, `client_server`,
   `chat_server`, `assetmanager_server`.
5. `AuthService.ParseToken` splits the access token on `.`, base64url-decodes the
   payload and deserialises it into `Bridge.Authorization.Models.UserInfo`:
   `UserId`, `PrimaryGroupId`, `GroupIds`, `Email`, `Employee`, `QA`,
   `Moderator`, `Artist`, `RegisteredWithAppleId`, `OnboardingCompleted`,
   `MainCharacterId`.
6. `AuthService.GetServicesUrls()` calls `GET api/client/urls` and deserialises
   into `Models.Client.ServicesUrls` (`Main`, `Asset`, `Transcoding`, `Video`,
   `Social`, `Notification`, `AssetManager`, `Chat`, `Client`).
7. `AuthService.RenewToken()` posts `grant_type=refresh_token`,
   `refresh_token`, `scope` to `connect/token`.

`AuthService.LogOut()` is client-side only; it clears local storage (no HTTP
call found).


## 4. Implemented endpoints

Status legend: **IMPLEMENTED** = route + documented shape + automated test.

| # | Status | Method / path | Auth | Request | Response | Caller (class::method) | Flow |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | IMPLEMENTED | `GET /api/Client/SupportedVersions` | none | empty | `SupportedVersions` (§7 of analysis) | `CompatibilityService::GetEnvironmentCompatibilityData` | startup compatibility gate |
| 2 | IMPLEMENTED | `POST /connect/token` (+ aliases in §1) | Basic | form/multipart: `grant_type`, `scope`, `username`/`email`, `password`; or `grant_type=refresh_token`, `refresh_token` | `TokenResponse` | `AuthService::LogInAsync`, `AuthService::RenewToken` | login / token refresh |
| 3 | IMPLEMENTED | `GET /api/client/urls` (+ `POST`) | Bearer | empty | `ServicesUrls` | `AuthService::GetServicesUrls` | post-login host discovery |
| 4 | IMPLEMENTED | `POST /api/verify-email` | Bearer | body shape **UNKNOWN**; server accepts `{email}` | `{}` 200 | `AuthService::RequestEmailVerification` | e-mail verification |
| 5 | IMPLEMENTED | `POST /api/verify-phone-number` | Bearer | body shape **UNKNOWN**; server accepts `{phoneNumber}` | `{}` 200 | `AuthService::RequestPhoneNumberVerificationCode` | phone verification |
| 6 | IMPLEMENTED | `POST`/`PUT /api/credential/username` | Bearer | body shape **UNKNOWN**; server accepts `{username}` | `{}` 200 | `AuthService::UpdateUsername` | settings → change username |
| 7 | IMPLEMENTED | `GET /auth/age-confirmation/quiz` | optional Bearer | empty | `AgeConfirmationQuizResponse` | `AgeControlService::GetAgeConfirmationQuestions` | age gate |
| 8 | IMPLEMENTED | `GET /auth/age-confirmation/quiz/status` | optional Bearer | empty | `AgeConfirmationQuizResponse` | `AgeControlService::GetQuizStatus` | age gate status |
| 9 | IMPLEMENTED | `POST /auth/age-confirmation/quiz` | optional Bearer | `AgeConfirmationAnswer[]` (client method signature; body not inspected) | `AgeConfirmationQuizResponse` | `AgeControlService::ConfirmAgeWithAnswers` | age gate |
| 10 | IMPLEMENTED | `GET /group/follow-recommendations` | optional Bearer | empty | `FollowRecommendation[]` | `RecommendationsService::GetFollowRecommendations` | follow suggestions |
| 11 | IMPLEMENTED | `GET /group/follow-back-recommendations` | optional Bearer | empty | `FollowRecommendation[]` | `RecommendationsService::GetFollowBackRecommendations` | follow suggestions |
| 12 | IMPLEMENTED | `GET /group/frever-official` | optional Bearer | empty | `Profile` | `SocialService::GetFreverOfficialProfile` | home → official profile |
| 13 | IMPLEMENTED | `GET /group/star-creators-in-your-country` | optional Bearer | empty | `Profile[]` | `SocialService::GetStarCreatorsInYourCountry` | discover page |
| 14 | IMPLEMENTED | `GET /gamification/reward/past` | optional Bearer | empty | `ClaimPastRewardsResult` | `SeasonService::ClaimPastRewards` | season rewards |
| 15 | IMPLEMENTED | `GET /me` | Bearer | empty | `MyProfile` | `SocialService::CurrentUserProfileInternal` | local user bootstrap / avatar owner |
| 16 | IMPLEMENTED | `GET /me/balance` | Bearer | empty | `UserBalance` | `SocialService::GetUserBalance` | wallet display |
| 17 | IMPLEMENTED | `GET /group/{id}` | optional Bearer | empty | `Profile` | `SocialService::GetBaseProfileInternal` (`group/{0}`) | profile / avatar data |
| 18 | IMPLEMENTED | `GET /health` | none | empty | `{status:"ok"}` | not called by the game | local probe |

Notes:

- Empty arrays are deliberate: the local database has no social graph, videos,
  seasons or star creators. Returning `[]` is shape-valid and avoids inventing
  data.
- `/group/frever-official` returns group id 1000 with nickname
  `Frever Official`; `Profile` fields not documented in `dump.cs` are omitted
  (`null`), which Newtonsoft leaves at its own defaults.
- `GET /me` returns `MyProfile`; `Id`, `GroupId`, `Email` are also included
  (used by the bridge's `UserProfile`) even though they are not declared on
  `MyProfile` itself.
- The token is a JWT signed with HS256. Claims include both the `UserInfo`
  PascalCase names and the usual OAuth snake_case names because the exact

## 5. Confirmed paths that are *not* implemented

These paths were confirmed by string/xref, but their request or response shapes
were not recovered completely. They are not routed by the server, so the client
will receive `404` and the log line will show method, path and body size. This is
intentional: no guessed field names.

| Path | Caller | Shape / note |
| --- | --- | --- |
| `/Account/Register` | `AuthService::RegisterAsync` | JSON body confirmed from literals: `userName`, `birthDate` (`yyyy-MM-dd`), `gender`, `allowDataCollection`, `analyticsEnabled`, `country`, `defaultLanguage`, plus credential fields. Response **UNKNOWN**. |
| `/Account/VerifyMyAccountEmail` | `AuthService::RequestMyParentEmailVerification` | **UNKNOWN** |
| `/Account/VerifyMyAccountEmailCode` | `AuthService::VerifyMyParentEmail` | **UNKNOWN** |
| `/Account/StoreEmailForAppleId` | `AuthService::StoreEmailForAppleId` | **UNKNOWN** |
| `/Account/LoginWithGoogle` | `GoogleAuthCredentials.LoginEndPoint` | **UNKNOWN** (third-party token login) |
| `/Account/LoginWithApple` | `AppleAuthCredentials.LoginEndPoint` | **UNKNOWN** |
| `account/suggestnicknames?count={0}` | `AuthService::GetSuggestedNicknames` | response `string[]` (client type); exact wrapper **UNKNOWN** |
| `account/update` | `AuthService::UpdateUserInfo` | **UNKNOWN** |
| `account/verifyparentemail` | `AuthService::RequestParentEmailVerificationCode` | **UNKNOWN** |
| `account/assignparentemail` | `AuthService::AssignParentEmail` | **UNKNOWN** |
| `account/CheckIfParentEmailBound` | `AuthService::CheckIfParentEmailBound` | **UNKNOWN** |
| `account/ConfigureParentalConsent` | `AuthService::ConfigureParentalConsent` | **UNKNOWN** |
| `account/RegisterTemporaryAccount` | `AuthService::RegisterTemporaryAccount` | **UNKNOWN** |
| `account/ValidatePassword` | `AuthService::ValidatePasswordStrength` | **UNKNOWN** |
| `ValidateLoginInfo` / `ValidateRegistrationInfo` | `AuthService::ValidateLoginCredentials` / `ValidateRegistrationCredentials` | **UNKNOWN** |
| `invitation-code/validate` | `AuthService::ValidateInvitationCode` | **UNKNOWN** |
| `/api/credential` | `AccountVerificationService::.ctor` (base for credential-status calls) | **UNKNOWN** |
| `assets/*` | `AssetServiceBase::BuildUrl` | asset catalogue/upload; large model set, **UNKNOWN** |
| `start-pack/*` | `StartPackServiceBase<T>` | start pack metadata/user assets, **UNKNOWN** |
| `create-page/*` | `CreatePageService` | home rows; query formats confirmed, response models **UNKNOWN** |
| `gamification/*` (season, level, quest rewards) | `SeasonService` | claim paths confirmed, response `ClaimRewardResult` DTO **UNKNOWN** |
| `video/*` | `VideoReadService` / `VideoWriteService` | large video API, not needed for login/avatar |
| `group/{id}/follower`, `group/{id}/following`, `group/{id}/friends`, `group/top`, `group/blocked-users` | `SocialService` | query formats confirmed, response `Profile[]` |
| `me/PurchasedAssetsInfo`, `me/balance/initial`, `me/advertising/tracking/*` | `SocialService`, `AdTrackingService` | **UNKNOWN** |

A full machine-generated list of 321 methods with path-like literals is produced
during analysis (`analysis/xrefs_game.tsv`), but it is not committed because it
contains extracted game strings.


## 6. Verification of the original candidate list

| Candidate | Verdict | Evidence |
| --- | --- | --- |
| `content-prod.frever-api.com` | **CONFIRMED** (Production host) | `AuthServerConfigurations..ctor` |
| `content-prod-us.frever-api.com` | **CONFIRMED** (ProductionUSA) | same method |
| `content-stage.frever-api.com` | **CONFIRMED** (Stage) | same method |
| `content-test.frever-api.com` | **CONFIRMED** (Test) | same method |
| `dev.frever-api.com` | **CONFIRMED** (Develop) | same method |
| `web.frever-api.com` (`/video/`, `/@user`, `/season`) | **CONFIRMED** but share/deep-link only | `SocialService::BuildShareProfileUrl`, `DeepLinksHandler` regexes |
| `/api/client/SupportedVersions` | **CONFIRMED with different casing**: `api/Client/SupportedVersions` | `CompatibilityService.END_POINT` |
| `/api/client/urls` | **CONFIRMED** as `api/client/urls` | `AuthService::GetServicesUrls` |
| `/api/credential/username` | **CONFIRMED**, but it is `UpdateUsername`, **not login** | `AuthService::<UpdateUsername>d__82` |
| `/api/credential` | **CONFIRMED** as a base used by `AccountVerificationService` | ctor string |
| `/api/verify-email` | **CONFIRMED** | `AuthService::RequestEmailVerification` |
| `/api/verify-phone-number` | **CONFIRMED** | `AuthService::RequestPhoneNumberVerificationCode` |
| `/auth/age-confirm` | **REJECTED** | actual: `/auth/age-confirmation/quiz`, `/auth/age-confirmation/quiz/status` |
| `group/follow-recommendations` | **CONFIRMED** | `RecommendationsService::GetFollowRecommendations` |
| `group/frever-official` | **CONFIRMED** | `SocialService::GetFreverOfficialProfile` |
| `group/public/group/star-creators-in-your-country` | **REJECTED**; actual `group/star-creators-in-your-country` | `SocialService::GetStarCreatorsInYourCountry` |
| `gamification/reward/past` | **CONFIRMED** | `SeasonService::ClaimPastRewards` |
| Login path is `/api/credential/username` | **REJECTED**; login is `connect/token` (OAuth password grant) | `EmailCredentialsBase::get_LoginEndPoint`, `UsernameAndPasswordCredentials::GetLoginCredentials` |
| Client uses hosts as-is | **CONFIRMED** | no host rewrite code; literal error string |

## 7. Remaining UNKNOWNs

1. **Exact auth base URL.** `AddApiVersion` and `VersionProvider` hide the
   `auth/<version>` composition. Server aliases cover the plausible forms.
2. **`ParseToken` JSON keys.** The payload is deserialised into `UserInfo`, but
   the string keys are not visible in the stripped binary. Server emits both
   PascalCase `UserInfo` names and snake_case OAuth names.
3. **Exact request bodies for `/api/verify-email`,
   `/api/verify-phone-number`, `/api/credential/username`.** The endpoint and
   method are confirmed; the anonymous request object is not. Server accepts
   multiple plausible field names.
4. **`/Account/Register` response**, and every path in §5.
5. **Whether the client tolerates a partial `Profile`/`MyProfile`.** The field
   names are confirmed; missing nested models become `null` after Newtonsoft
   deserialisation. Only a device run can confirm the UI accepts that.
6. **Runtime SDK gates.** See `docs/analysis.md` §5.
7. **Protobuf.** `ServiceBase.SendRequestForSingleModel` defaults to
   `useProtobuf = true` and `ProtobufResponseReader` exists; the server always
   returns JSON. Login, `/me` and the group/profile handlers were not proven to
   request protobuf, but if a device shows a decode failure on one of them, add
   an `Accept: application/vnd.google.protobuf` response path. All implemented
   routes currently return `application/json`.

## 8. Evidence trail

For every implemented endpoint, the evidence is:

1. a string literal in `dump/stringliteral.json` (address + value),
2. a `Method` entry in `dump/script.json` whose ARM code resolves that literal
   through a metadata-usage slot, and
3. a caller class/method in `dump/dump.cs` with a matching return type.

The scan is reproducible with the tools described in `docs/analysis.md` §3.

  `ParseToken` keys could not be read from the stripped binary.
