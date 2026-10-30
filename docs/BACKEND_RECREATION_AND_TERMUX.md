# FriendFactory Backend Recreation & Termux Architecture Reference

This document maps the original **FriendFactory / Frever** C# .NET microservices architecture to **FreverS**, a zero-dependency, local-only server designed to run directly inside Termux on Android.

---

## 1. Original FriendFactory Backend Architecture

The original FriendFactory backend consisted of multiple C# .NET Core 3.1 / .NET 8 microservices:

| Microservice | Projects & Path | Original Cloud Function |
| --- | --- | --- |
| **AuthServer** | `Microservices/Authorization/AuthServer` | OAuth2, Twilio SMS, Google/Apple SSO, JWT issuing |
| **Client** | `Microservices/Client` | Main client-facing REST API & profile handler |
| **AssetServer** | `Microservices/AssetServer` | CMS & Asset Management (Admin API) |
| **Video** | `Microservices/Video` | Video metadata, upload processing & feeds |
| **TranscodingServer** | `Microservices/Transcoding` | AWS MediaConvert queue processing |
| **Chat** | `Microservices/Chat` | Real-time SignalR / WebSocket chat server |

### Heavy Infrastructure Stack
- **Database:** PostgreSQL (Primary + Read Replica)
- **Caching:** Redis
- **Cloud Assets & Storage:** AWS S3, CloudFront (Signed URLs with RSA Keys), AWS SQS, AWS MediaConvert

---

## 2. FreverS Local Termux Recreation

Running full .NET 8 microservices with PostgreSQL, Redis, and AWS emulator stack on an Android phone in Termux is heavy and inefficient. **FreverS recreates the exact DTOs and API contracts** of all FriendFactory microservices in a single, lightweight Node.js engine.

### Architectural Mapping

| FriendFactory Microservice | FreverS Implementation in Node.js |
| --- | --- |
| **AuthServer** | `src/auth.js` + `src/handlers-auth.js` (JWT HS256, scrypt password hashing, local OAuth2 `/connect/token`) |
| **Client & Main** | `src/endpoints.js` + `src/handlers-data.js` (SupportedVersions, ServicesUrls, MyProfile, Profiles) |
| **AssetServer / AssetManager** | `src/server.js` + `scripts/import-assets.mjs` (Local `/assets/` and `/media/` serving with Range and ETags) |
| **Video & Feeds** | `src/handlers-data.js` (Local video export modes: Gallery Mode & Private Folder Mode) |
| **PostgreSQL DB** | `src/db.js` (`node:sqlite` WAL mode SQLite database in `data/frever.db`) |
| **Redis Cache** | In-memory caching and JSON file-backed status (`data/papk-status.json`, `data/assets/catalog.json`) |

---

## 3. Termux Deployment Advantages

- **Zero External Dependencies:** Built entirely with Node.js built-ins (`node:http`, `node:sqlite`, `node:crypto`). No native C++ compilation required.
- **Instant Launch:** Starts in < 1 second on Android phone hardware.
- **Offline First:** Operates 100% offline without cloud connections, paid third-party APIs, or telemetry.
