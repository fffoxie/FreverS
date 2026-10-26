# Phase 1 — Reverse engineering notes

All artefacts referenced here live in `analysis/`, which is git-ignored. No APK,
asset bundle, dump, or extracted file is committed.

## 1. Input verification

| Property | Value |
| --- | --- |
| File | `Frever_4.0.5_APKPure.apk` |
| Size | 217,417,874 bytes (matches the brief) |
| MD5 | `c53f40eb25c8738538981ac923871917` — **verified** |
| Package | `com.FriendFactory.Frever` |
| Version | 4.0.5, versionCode 409 |
| minSdk / targetSdk / compileSdk | 28 / 34 / 34 |
| Native ABI | **armeabi-v7a only** (no arm64-v8a, no x86) |

## 2. Unpacked contents

`unzip -l` reports 2,115 entries and 438,497,533 bytes uncompressed. The full
listing is saved to `analysis/apk-filelist.txt` (git-ignored).

| Group | Count / size |
| --- | --- |
| `assets/` | 1,530 entries |
| `assets/bin/Data/` | 1,527 entries, 262,060,795 bytes |
| Native libraries | 24 files, all under `lib/armeabi-v7a/` |
| `classes.dex` | 8,594,804 bytes |
| `classes2.dex` | 6,310,720 bytes |
| `res/` | 511 entries |
| Other | `resources.arsc`, `AndroidManifest.xml` (40,560 B), META-INF, Kotlin metadata |

Key files:

| File | Size | MD5 |
| --- | --- | --- |
| `lib/armeabi-v7a/libil2cpp.so` | 123,550,124 | `3fe8600e6894f342f6d34837660e3c29` |
| `assets/bin/Data/Managed/Metadata/global-metadata.dat` | 27,295,144 | `c58edd78b965cb2094f4f31890c6b267` |
| `assets/bin/Data/00000000000000000000000000000000` | 66,063,788 | shared asset data |

There is no `assets/bin/Data/data.unity3d`; the build uses the split
`assets/bin/Data/<hash>` layout.

## 3. Engine and build facts

- **Unity 2022.3.28f1** (`libunity.so` contains the version string).
- **IL2CPP**, metadata version reported by Il2CppDumper: **29** (auto-switched to 29.1).
- CodeRegistration `0x0704C778`, MetadataRegistration `0x071BBE70`.
- The binary is **protected/stripped** to a degree:
  - Il2CppDumper prints `WARNING: find JNI_OnLoad` and
    `ERROR: This file may be protected.` but still finds both registrations with
    its v29 heuristics.
  - Cpp2IL 2022.0.7 and 2022.1.0-pre-release.21 both fail with
    `Failed to find pCodegenModules`; they could not be used.
  - Because of this, **method bodies were recovered by targeted ARM
    disassembly**, not by a decompiler. IL2CPP string literals are reached
    through PIC metadata-usage slots, so a `ldr rX,[pc,#imm] ; ldr rX,[pc,rX]`
    pair plus a `.data.rel.ro` read resolves the literal address. The scripts
    used are in `analysis/tools/` (`ann.py`, `scan_xrefs.py`).

### Tooling used

| Tool | Version | Result |
| --- | --- | --- |
| Il2CppDumper | 6.7.46 (net6) | `dump/dump.cs` (61,356,003 B), `dump/script.json` (168,366,703 B), `dump/stringliteral.json` (2,745,446 B), DummyDll |
| jadx | 1.5.6 | `jadx-out/` (57 MB of Java), 16 decode errors, all in SDK code |
| androguard | 4.1.4 | manifest, permissions, SDK levels |
| capstone | 5.0.9 | ARM/Thumb disassembly and string-literal xrefs |
| JDK | Temurin 17.0.21 | for jadx |
| .NET runtime | 6.0.36 | for Il2CppDumper/Cpp2IL |

Il2CppDumper's `dump.cs` preserves class fields, const string values, nested
async-state-machine types, and method RVAs, which was enough to recover the

## 4. Java side

`classes.dex` / `classes2.dex` contain the Unity player, AndroidX, Google Play
Billing, Firebase/OneSignal/Amplitude/Sentry wrappers, and the launcher
activities. **There is no application HTTP client in Java.** The only
app-specific classes are:

- `com.FriendFactory.Frever.BuildConfig`, `R`
- `com.friendfactory.frever.IntermediateActivity`
- `com.friendfactory.amplitude.experiment.*` (Amplitude wrapper)

The earlier finding “package `com.friendfactory.bridge` contains
`SupportedVersions.cs`” is **rejected for Java**: no such Java package exists.
`SupportedVersions` is a C# class in `Bridge.EnvironmentCompatibility`
(TypeDefIndex 7225), compiled into `libil2cpp.so`.

Certificate pinning is **not** implemented by the app's Java code. OkHttp's
`CertificatePinner` class is present only as part of the library; it is never
configured by `com.FriendFactory.*`.

## 5. Third-party SDKs found

| SDK | Evidence | Needed for login/startup? |
| --- | --- | --- |
| Amplitude (+ Experiment) | `Amplitude` 484 hits in `dump.cs`; Java wrapper | No — analytics only |
| OneSignal | 239 hits; notification activities/services | No — push notifications |
| Firebase (messaging/analytics/install referrer) | 21 hits; manifest services/providers | No |
| Sentry | 2,572 hits; `libsentry.so`, `libsentry-android.so` | No — crash reporting |
| AppsFlyer | 75 hits | No — attribution |
| Unity Analytics | `UnityServicesProjectConfiguration.json` (Core 1.12.5, Analytics 5.0.0) | No |
| Giphy | `SG_GiphyUploader` (StansAssets) | No — share flow |
| TikTok | share/deep-link strings | No — share flow |
| Epidemic Sound | partner URL constant | No — music catalogue |
| 7digital | `Bridge.Services._7Digital` | No — external music |

**Runtime verification was not possible** (no Android device in this
environment), so “needed for startup” is a static judgement: the core login and
startup paths live entirely in `Bridge.Authorization` and
`Bridge.EnvironmentCompatibility`, and none of them reference an SDK API. The
server therefore does not emulate any SDK. If a device run shows an SDK blocking
startup, the first candidates are Firebase/OneSignal initialisation and Sentry;
they can be disabled by the client-side patch that is already required to change
the host.

## 6. Candidate host verification

Confirmed from `Bridge.Authorization.Configs.AuthServerConfigurations..ctor`
(the five literals are loaded in the same method):

| Host | Environment enum | Verdict |
| --- | --- | --- |
| `https://content-prod.frever-api.com/` | `Production = 1` | CONFIRMED |
| `https://content-stage.frever-api.com/` | `Stage = 2` | CONFIRMED |
| `https://content-test.frever-api.com/` | `Test = 3` | CONFIRMED |
| `https://dev.frever-api.com/` | `Develop = 4` | CONFIRMED |
| `https://content-prod-us.frever-api.com/` | `ProductionUSA = 5` | CONFIRMED |

`web.frever-api.com` is confirmed in `SocialService.BuildShareProfileUrl` and
the deep-link regexes (`/video/{0}`, `/@{nickname}`, `/season/{id}`). It is a
web share host, not an API host.

The client uses the host strings **as-is** (the error string
`Could not resolve host 'content-prod.frever-api.com'` is a literal in the
binary). There is no host transformation or per-request signing layer that would
make an unmodified client talk to another host.


## 7. Startup version check

Recovered from `Bridge.EnvironmentCompatibility.CompatibilityService` and its
async state machine:

- Method: `GET` (via `UnityWebRequest`)
- URL: `<environment host>/api/Client/SupportedVersions`
  (constant `END_POINT = "api/Client/SupportedVersions"`)
- Caller: `ServerBridge.GetEnvironmentCompatibilityData(FFEnvironment)` /
  `GetEnvironmentsCompatibilityData()` → `ICompatibilityService`
- Deserialised into `Bridge.EnvironmentCompatibility.SupportedVersions`
- Compared by `CompatibilityService.IsCompatible(targetVersion, minVersion,
  maxVersion)` — called with `_bridgeVersion` / `_apiVersion` from
  `VersionProvider`.

Exact response shape (Newtonsoft, PascalCase property names):

```json
{
  "BridgeMinVersion": "0.0.0",
  "BridgeMaxVersion": "99.99.99",
  "FreverMinBuild": 0,
  "FreverMaxBuild": 999999,
  "FreverMinVersion": "0.0.0",
  "FreverMaxVersion": "99.99.99"
}
```

`FreverMinBuild`/`FreverMaxBuild` are `int`; the other four are strings. The
server's values accept build 409 (4.0.5). The exact value of the client's
`_bridgeVersion` / `_apiVersion` could not be recovered: they come from the
`Version` ScriptableObject loaded by `VersionProvider.LoadData()` and are not
string literals. Wide min/max bounds avoid the problem.

There is a separate OAuth-style `POST <auth base>/connect/token` call for login
(see `docs/protocol.md`); it is *not* the version check.

## 8. TLS and certificate pinning

- No `networkSecurityConfig` and no `usesCleartextTraffic` attribute in
  `AndroidManifest.xml`. targetSdk is 34, so **cleartext HTTP is blocked by the
  platform default**.
- No pinning configuration was found in app code. BestHTTP (with its BouncyCastle
  TLS stack and an optional `TLSSecurity` addon) is present; the app calls a
  `ServerBridge.SetupTlsCertificate()` method that installs a certificate
  verification callback, but no certificate fingerprints, SPKI pins or custom
  trust anchors are present in the binaries/metadata.
- On Android 7+ (and especially targetSdk 34), **user-installed CAs are not
  trusted by apps** unless the app opts in via `network_security_config`. A DNS
  override plus a user CA therefore does not work on an unmodified APK.
- Minimum to redirect the analysed client:
  1. Patch the APK to point the five environment hosts at the server (IL2CPP
     string patch or runtime hook), and
  2. patch the manifest to allow cleartext (`android:usesCleartextTraffic="true"`
     or a `network_security_config` that trusts the local CA), or use a
     system-CA install on a rooted device with a man-in-the-middle proxy.
- The server itself does **not** disable or bypass certificate checks. It speaks
  plain HTTP on port 8080; TLS termination, if wanted, is a deployment choice
  outside this repository.

## 9. Corrections to the original findings

| Original claim | Finding |
| --- | --- |
| `com.friendfactory.bridge` contains `SupportedVersions.cs` | No Java package; it is C# `Bridge.EnvironmentCompatibility.SupportedVersions` |
| `/api/credential/username` is the login endpoint | It is `AuthService.UpdateUsername`; login is `connect/token` (password grant) |
| `/auth/age-confirm` | Does not exist; actual paths are `/auth/age-confirmation/quiz` and `/auth/age-confirmation/quiz/status` |
| `group/public/group/star-creators-in-your-country` | Actual literal is `group/star-creators-in-your-country` |
| `/api/client/SupportedVersions` | Actual casing is `api/Client/SupportedVersions` (host + `api/Client/SupportedVersions`) |
| `/api/client/urls` | Confirmed as `api/client/urls` |
| Login is JSON | Login is **form/multipart** (`scope`, `grant_type`, `username`, `password`) with Basic auth and `X-Device-Id` |

## 10. Limitations

- No device or emulator was available, so no runtime trace, no TLS handshake
  capture, and no confirmation of which SDKs actually gate startup.
- Method bodies were reconstructed by reading ARM code and resolving string
  literals. The exact JWT claim names consumed by `AuthService.ParseToken` are
  inferred from the `UserInfo` struct (the binary does not expose the JSON keys);
  the server emits every plausible spelling.
- The exact `AuthService` base URL (`IdentityServerURL` + API version) could not
  be reconstructed with certainty; `Bridge.Extensions.AddApiVersion` combines
  `auth` + a version segment in a way that the stripped code does not make
  obvious. The server accepts the plausible `connect/token` paths and documents
  them as aliases.

request/response models.
