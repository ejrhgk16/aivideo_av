# Architecture

```text
front (Expo / React Native) ── HTTP API ──> back (NestJS)
```

## Frontend — `front/`

Expo React Native client. Own `package.json` and lockfile.

| Path | Responsibility |
|---|---|
| `src/app/` | Expo Router routes and navigators. |
| `src/screens/` | Screen-level UI. |
| `src/components/` | Reusable UI components. |
| `src/common/` | Shared HTTP, storage, environment, theme, and pure utility code. |
| `src/features/` | Feature-specific state, endpoints, and types. `user/` owns the current nullable user, points, and in-memory playback preferences in one Context. |
| `assets/images/` | Static screen images. |
| `assets/icons/` | Static icons. |
| `assets/fonts/` | Font files and licenses. |
| `tests/` | Frontend product tests. |

## Backend — `back/`

NestJS API server. Own `package.json` and lockfile.

| Path | Responsibility |
|---|---|
| `src/` | NestJS modules, controllers, and services. |
| `src/{domain}/entities/` | Domain-specific Entity classes and persistence metadata. |
| `src/identity/` | User identity, credential lookup, login/refresh/logout APIs, JWT issuance, Passport Access validation, and session-scoped Refresh rotation/revocation. |
| `src/common/entities/` | Shared persistence base entities and metadata. |
| `src/common/error/` | Shared custom HTTP error base, error codes, concrete exceptions, and response filter used by opted-in controllers. |
| `src/common/database/` | Shared TypeORM configuration and Entity registry, CLI `DataSource`, explicit development seed CLI, and migration files. |
| `test/api/` | Postman collections that call the running development API and its real MySQL database; execution instructions and data requirements. |
| `test/unit/` | Focused tests for internal rules and publication/environment boundaries that cannot be exercised without changing existing data. |

## Web prototype — `web-prototype/`

Preserved standalone web prototype. It is not imported or run by `front/`, and is excluded from active app and Harness work.

## Codex Harness and documentation

| Path | Responsibility |
|---|---|
| `_docs/plans/index.json` | Harness plan catalog and plan-level status only. |
| `_docs/plans/plan-N-name/index.json` | Task definitions and execution state for one plan. |
| `_docs/plans/plan-N-name/plan.md` | Human-readable plan scope, task details, and verification results. |
| `_docs/api/` | Domain-organized REST API contracts and shared API conventions. |
| `.agents/skills/` | Project-local Codex skills. |
| `.codex/agents/` | Codex worker definitions. |
| `.codex/hooks.json` | Codex hook registration. |
| `tools/harness/` | Harness CLI, hook support, and tooling tests. |

## Boundaries

- Frontend and backend dependencies are managed independently.
- `front/tests/`, `back/test/`, and `tools/harness/` are the only test roots.
- A directory responsibility change must update this document in the same task.

### Frontend global state

The root layout provides one `UserProvider`. Its in-memory session holds the nullable user, points, Access token, restore state, session version, and session-expiration signal alongside playback preferences. Refresh remains in SecureStore on native platforms and in memory on web. Login updates user, points, and Access together; logout or invalidation clears them. Session changes do not remount navigation.

The app HTTP client in `src/features/user/sessionClient.ts` uses `src/common/http/api.ts`. Public home, catalog-list, and preview requests omit Authorization. Drama details and episode playback use optional Access authentication. Purchases use required authentication and the `/me` API. A 401 with `AUTH_INVALID_TOKEN` on an authenticated request shares one Refresh rotation, retries that request once, then signals session expiry if it still fails. Error codes are mapped to Korean guidance; each screen handles its own retry or purchase explanation.

The root navigation renders one session-expiration modal. Closing it only dismisses the notice. It navigates to `/login` only after the user presses the login button. The temporary `/login` route calls `useLogin`, which sends `POST /auth/login`; omitted `loginId` and `password` query parameters still default to `admin` for explicit development access. Login failures use the shared error guidance.

## Backend verification

- `npm --prefix back run test` runs focused unit tests followed by the Postman CLI API collection. `test:unit` and `test:api` run each separately.
- API tests use the existing development server at `http://localhost:3000` by default, with its configured MySQL connection. The server must reflect the code being verified. The collection discovers public UUIDs from responses; tests may prepare development-only fixtures and mutate data as needed.
- `back/test/api/README.md` defines startup, target URL overrides, required existing content, and coverage limits. Missing server/data or failed assertions fail verification.

## Backend identity sessions

- `auth_sessions` records one login instance per successful sign-in and links to the user's internal numeric database ID. `refresh_tokens` stores one SHA-256 hash per issued Refresh JWT, its expiry and use time, linked through the internal auth session ID. Token rows are append-only; raw JWTs exist only in responses and client memory/secure storage.
- Refresh rotation and logout lock the auth session row before the refresh token row. Rotation marks the old token used and appends the replacement in one transaction. Replaying any used token commits session revocation before returning 401, so every Refresh from that login is rejected; other device sessions remain independent.
- Passport's HS256 Strategy checks Access purpose, expiry, and active user. `JwtAuthGuard` protects `/me/points/increase` and `/me/episodes/:episodeUuid/purchaseSingle`; the optional guard protects drama detail and episode playback. Those endpoints derive identity from the verified JWT subject and ignore caller-provided `userUuid` queries. Session revocation does not revoke existing Access tokens, which can remain valid for up to 15 minutes. Until an old Refresh is replayed, the server cannot identify an attacker's first use.
- The frontend session layer stores the Refresh JWT in native SecureStore and restores a session with `/auth/refresh`; on web, its storage adapter is memory-only, so refreshing the page ends the session. It clears the token through `/auth/logout`. A concurrent refresh or lost refresh response can trigger strict replay detection and require the user to sign in again.

## Media storage

- `back/src/content/mediaStorage.ts` is the single source for content-media `storageKey` construction.
- `front/media/` is a Git-ignored local workspace for media files; it is not an Expo bundle asset or a public URL by itself.
- The `aivideo-dev` bucket exposes only the configured image key patterns through public `s3:GetObject`; video and subtitle keys remain private. API `imageUrls` values are direct S3 URLs.
- FULL episode videos and DRAMA PREVIEW videos use private S3 objects and one-hour presigned GET URLs in development only. Development configures `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in the Git-ignored `back/.env.development`; the AWS SDK default credential provider chain reads the environment credentials. Production playback remains unavailable.
- The backend does not provide local image file routes. Public image URLs are generated from storage keys; FULL and PREVIEW playback URLs are separately signed.
