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
| `src/playback/` | JWT-authenticated episode watch-progress writes against the existing user/episode progress key. |
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

The root layout provides one `UserProvider`. Its in-memory session holds the nullable user, points, Access token, restore state, session version, and session-expiration signal alongside playback preferences. Native Refresh remains in SecureStore; web Refresh is stored in a server-set HttpOnly cookie and is never read by frontend JavaScript. Login updates user, points, and Access together; logout or invalidation clears them. Session changes do not remount navigation.

The app HTTP client in `src/features/user/sessionClient.ts` uses `src/common/http/api.ts`. Public home, catalog-list, and preview requests omit Authorization. Drama details and episode playback use optional Access authentication. Purchases use required authentication and the `/me` API. A 401 with `AUTH_INVALID_TOKEN` on an authenticated request shares one Refresh rotation, retries that request once, then signals session expiry if it still fails. Error codes are mapped to Korean guidance; each screen handles its own retry or purchase explanation.

The root navigation renders one session-expiration modal. Closing it only dismisses the notice. It navigates to `/login` only after the user presses the login button. The temporary `/login` route calls `useLogin`, which sends `POST /auth/login`; omitted `loginId` and `password` query parameters still default to `admin` for explicit development access. Login failures use the shared error guidance.

## 시간 저장·비교·표시 기준

- DB의 시각 값은 UTC 기준으로 저장하고 비교한다. MySQL `DATETIME(3)`은 시간대 정보를 저장하지 않으므로, 저장된 숫자 자체가 UTC 시각이어야 한다.
- `back/src/common/database/databaseConfig.ts`의 TypeORM `timezone: 'Z'`는 드라이버가 JavaScript `Date`와 DB 날짜 값을 UTC 기준으로 변환하도록 한다. 이 옵션은 MySQL 서버나 연결 세션의 시간대를 UTC로 바꾸지 않는다.
- DB에서 현재 시각을 구해 UTC 열에 저장하거나 비교할 때는 `UTC_TIMESTAMP(3)`을 사용한다. `CURRENT_TIMESTAMP(3)`과 `NOW(3)`은 MySQL 세션 시간대에 의존한다. 애플리케이션에서 구한 JavaScript `Date`를 바인딩하는 방식도 기존 UTC 드라이버 설정에 맞춰 사용한다.
- DB 서버나 세션이 KST여도 UTC 저장 원칙은 유지한다. 예를 들어 한국 시각 `18:00`은 UTC `09:00`으로 저장한다. KST 숫자 `18:00`을 그대로 저장하면 UTC 드라이버가 UTC `18:00`으로 읽어 한국 시각 표시가 다음 날 `03:00`이 된다.
- API 시각은 ISO 8601 UTC(`Z`)로 전달한다. 한국 시각 표시는 프론트에서 `Asia/Seoul` 기준으로 변환한다. 표시를 위해 DB 값에 9시간을 더해 저장하지 않는다.
- 현재 시청기록 저장 API는 공개 시점 비교와 기록 시각을 `UTC_TIMESTAMP(3)`으로 명시한다. 기존 스키마의 `CURRENT_TIMESTAMP(3)` 기본값과 다른 저장 경로 전체를 이번 변경으로 정비한 것은 아니다. 해당 기본값에 의존하는 경로는 세션 시간대에 따른 영향을 별도로 확인해야 한다.
- KST 저장으로 정책을 바꾸려면 드라이버 변환, 기존 데이터, 기본값, 공개 예약 비교, API 직렬화를 함께 검토해야 한다. DB 서버의 시간대만으로 저장 정책을 변경하지 않는다.

## Backend verification

- `npm --prefix back run test` runs focused unit tests followed by the Postman CLI API collection. `test:unit` and `test:api` run each separately.
- `back/test/api/run.mjs` forwards fixture credentials through a temporary Postman environment for both normal tests and Harness finish. Its default local-development mode restores temporary fixture logins and removes only progress rows created by the run. `API_TEST_ENVIRONMENT_FILE` selects an externally prepared environment without automatic database preparation or cleanup.
- API tests use the existing development server at `http://localhost:3000` by default, with its configured MySQL connection. The server must reflect the code being verified. The collection discovers public UUIDs from responses; tests may prepare development-only fixtures and mutate data as needed.
- `back/test/api/README.md` defines startup, target URL overrides, required existing content, and coverage limits. Missing server/data or failed assertions fail verification.

## Backend identity sessions

- `auth_sessions` records one login instance per successful sign-in and links to the user's internal numeric database ID. `refresh_tokens` stores one SHA-256 hash per issued Refresh JWT, its expiry and use time, linked through the internal auth session ID. Token rows are append-only; raw JWTs exist only in responses and client memory/secure storage.
- Refresh rotation and logout lock the auth session row before the refresh token row. Rotation marks the old token used and appends the replacement in one transaction. Replaying any used token commits session revocation before returning 401, so every Refresh from that login is rejected; other device sessions remain independent.
- Passport's HS256 Strategy checks Access purpose, expiry, and active user. `JwtAuthGuard` protects `/me/points/increase` and `/me/episodes/:episodeUuid/purchaseSingle`; the optional guard protects drama detail and episode playback. Those endpoints derive identity from the verified JWT subject and ignore caller-provided `userUuid` queries. Session revocation does not revoke existing Access tokens, which can remain valid for up to 15 minutes. Until an old Refresh is replayed, the server cannot identify an attacker's first use.
- `PlaybackModule` protects `PUT /me/episodes/:episodeUuid/watch-progress` with `JwtAuthGuard`, checks current public episode/video and paid entitlement, and upserts the existing composite-key row. The user comes from the Access JWT; a completed row cannot be reset by a later start request.
- The frontend session layer stores the Refresh JWT in native SecureStore and restores a session with `/auth/refresh`. On web, the browser sends the server-set HttpOnly cookie to the existing auth endpoints; page reload restores Access, user, and points from the rotated session response. `/auth/logout` revokes the session and clears the cookie. A concurrent refresh or lost refresh response can trigger strict replay detection and require the user to sign in again.

## Media storage

- `back/src/content/mediaStorage.ts` is the single source for content-media `storageKey` construction.
- `front/media/` is a Git-ignored local workspace for media files; it is not an Expo bundle asset or a public URL by itself.
- The `aivideo-dev` bucket exposes only the configured image key patterns through public `s3:GetObject`; video and subtitle keys remain private. API `imageUrls` values are direct S3 URLs.
- FULL episode videos and DRAMA PREVIEW videos use private S3 objects and one-hour presigned GET URLs in development only. Development configures `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in the Git-ignored `back/.env.development`; the AWS SDK default credential provider chain reads the environment credentials. Production playback remains unavailable.
- The backend does not provide local image file routes. Public image URLs are generated from storage keys; FULL and PREVIEW playback URLs are separately signed.
