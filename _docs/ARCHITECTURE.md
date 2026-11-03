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
| `src/features/` | Feature-specific state, endpoints, and types. Each feature owns its API response types in `*Responses.ts` and keeps existing feature type exports. `user/` owns the current nullable user, points, and in-memory playback preferences in one Context. |
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
| `src/{domain}/*Responses.ts` | Named public API response types, kept separate from Entities and database query rows. Async controller and service methods declare `Promise<ResponseType>` or `Promise<ResponseType[]>`; empty 204 responses declare `Promise<void>`. |
| `src/identity/` | User identity, credential lookup, login/refresh/logout APIs, JWT issuance, Passport Access validation, and session-scoped Refresh rotation/revocation. |
| `src/playback/` | JWT-authenticated saved-video writes and pages, plus video-keyed watch-progress writes for episode FULL and drama PREVIEW videos. |
| `src/common/entities/` | Shared persistence base entities and metadata. |
| `src/common/error/` | Shared custom HTTP errors and application-wide exception filter that maps business, HTTP, parser, and unknown errors to the common five-field response. |
| `src/common/pagination/` | Shared strict page parsing, offset/lookahead calculation, and generic items/page/hasNext response helpers; domain services own page sizes, queries, ordering, and item mapping. |
| `src/common/database/` | Shared TypeORM configuration and Entity registry, CLI `DataSource`, explicit development seed CLI, and migration files. |
| `test/api/` | Feature-scoped Postman suites, per-run fixture preparation and cleanup, cross-process content locks, and instructions for HTTP tests against the running API and its MySQL database. |
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
- Frontend and backend API response types are defined independently in their respective feature/domain folders; neither side imports the other side's source types.
- `front/tests/`, `back/test/`, and `tools/harness/` are the only test roots.
- A directory responsibility change must update this document in the same task.

### Frontend global state

The root layout provides one `UserProvider`. Its in-memory session holds the nullable user, points, Access token, restore state, session version, and session-expiration signal alongside playback preferences. Native Refresh remains in SecureStore; web Refresh is stored in a server-set HttpOnly cookie and is never read by frontend JavaScript. Login updates user, points, and Access together; logout or invalidation clears them. Session changes do not remount navigation.

The app HTTP client in `src/features/user/sessionClient.ts` uses `src/common/http/api.ts`. Home collections, catalog lists, drama details, and preview/episode playback use optional Access authentication: anonymous reads omit Authorization, while a current session supplies it so responses can include per-user saved flags. Purchases and saved-video reads/writes use required authentication. A 401 with `AUTH_INVALID_TOKEN` on an authenticated request shares one Refresh rotation, retries that request once, then signals session expiry if it still fails.

Read [frontend API error handling](api/00-overview/error-code.md) before changing frontend error parsing, guidance, or session recovery.

Saved-video screens use the playback feature's API directly. Recommendation, preview, and episode screens hold only their current video's saved flag and pending request in local component state, and refresh saved metadata from their existing server responses. The library loads its paged saved-video list when focused; the home hero opens the first preview directly. Writes use the actual video UUID and never grant episode entitlement. No saved-video state accumulates across screens.

The root also provides `SafeAreaProvider` once for the common `Page` safe-area view and the inset-aware playback controls. `UserProvider` continues to own the shared user, points, authentication, session state, and the `subtitlesEnabled` and `autoplayNext` settings reserved for future playback controls. The provider audit found no other app-owned global context to remove; the small `useLogin` wrapper remains outside the saved-video change.

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

- `npm --prefix back run test` runs focused unit tests followed by the eight Postman CLI API suites. `test:api` accepts repeated `--suite <name>` selectors and defaults to all suites; `test:api:parallel` proves separate HTTP-created watch-progress ownership, first-run cleanup preserving the second run's rows, no residual rows/users, and a content reader waiting ahead of a saved-videos writer.
- `back/test/api/run.mjs` creates fresh fixture users and credentials only for suites that need them, holds the normalized base-URL content lock through fixture setup, HTTP assertions, verification, and cleanup, and removes only records owned by that run. Each invocation uses a temporary copy of its one static suite collection and environment. The saved-video suite adds run-owned drama, images, free and paid episodes, preview/full media, and its collection link while holding an exclusive lock. `API_TEST_ENVIRONMENT_FILE` keeps external fixture setup and cleanup with the caller and uses an exclusive lock for the effective API URL.
- API tests use the existing development server at `http://localhost:3000` by default, with its configured MySQL connection. The server must reflect the code being verified. The collection discovers public UUIDs from responses; tests may prepare development-only fixtures and mutate data as needed.
- `back/test/api/README.md` defines suite selection, startup, URL overrides, required existing content, fixture ownership, lock behavior, and coverage limits. Missing server/data, failed assertions, or cleanup errors fail verification.

## Backend identity sessions

- `auth_sessions` records one login instance per successful sign-in and links to the user's internal numeric database ID. `refresh_tokens` stores one SHA-256 hash per issued Refresh JWT, its expiry and use time, linked through the internal auth session ID. Token rows are append-only; raw JWTs exist only in responses and client memory/secure storage.
- Refresh rotation and logout lock the auth session row before the refresh token row. Rotation marks the old token used and appends the replacement in one transaction. Replaying any used token commits session revocation before returning 401, so every Refresh from that login is rejected; other device sessions remain independent.
- Passport's HS256 Strategy checks Access purpose, expiry, and active user. `JwtAuthGuard` protects `/me/points/increase` and `/me/episodes/:episodeUuid/purchaseSingle`; the optional guard protects drama detail and episode playback. Those endpoints derive identity from the verified JWT subject and ignore caller-provided `userUuid` queries. Session revocation does not revoke existing Access tokens, which can remain valid for up to 15 minutes. Until an old Refresh is replayed, the server cannot identify an attacker's first use.
- `PlaybackModule` protects `PUT /me/videos/:videoUuid/watch-progress` with `JwtAuthGuard`, checks current public FULL/PREVIEW video and paid episode entitlement, and upserts the `(user_id, video_id)` row. Drama detail reads progress only for its representative FULL video; a completed row cannot be reset by a later start request.
- Saved-video routes use the Access JWT user for `PUT` writes, idempotent `DELETE` removal, and 30-item `GET` pages. Removal is scoped to the authenticated user and video UUID, including when the video is no longer public.
- The frontend session layer stores the Refresh JWT in native SecureStore and restores a session with `/auth/refresh`. On web, the browser sends the server-set HttpOnly cookie to the existing auth endpoints; page reload restores Access, user, and points from the rotated session response. `/auth/logout` revokes the session and clears the cookie. A concurrent refresh or lost refresh response can trigger strict replay detection and require the user to sign in again.

## Media storage

- `back/src/content/mediaStorage.ts` is the single source for content-media `storageKey` construction.
- `front/media/` is a Git-ignored local workspace for media files; it is not an Expo bundle asset or a public URL by itself.
- The `aivideo-dev` bucket exposes only the configured image key patterns through public `s3:GetObject`; video and subtitle keys remain private. API `imageUrls` values are direct S3 URLs.
- FULL episode videos and DRAMA PREVIEW videos use private S3 objects and one-hour presigned GET URLs in development only. Development configures `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in the Git-ignored `back/.env.development`; the AWS SDK default credential provider chain reads the environment credentials. Production playback remains unavailable.
- The backend does not provide local image file routes. Public image URLs are generated from storage keys; FULL and PREVIEW playback URLs are separately signed.
