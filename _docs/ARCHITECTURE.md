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
| `src/identity/` | User identity entity, login API, and credential lookup. The development seed supplies admin/admin; the current login response does not issue tokens or sessions. |
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

The root layout provides one `UserProvider`. `UserContext` stores `{ user, points, subtitlesEnabled, autoplayNext }`, initially `{ user: null, points: null, subtitlesEnabled: true, autoplayNext: false }`. Login updates the user and server-returned points together through `setUser(user, points)`; `setUser(null)` clears those two fields and preserves playback preferences. `setPoints(points)` replaces the current logged-in user's balance. All point displays read `useUser().points`, distinguishing `null` from a real zero. Playback preferences are read and updated through the same `useUser()` hook with `setSubtitlesEnabled` and `setAutoplayNext`. User updates do not remount the navigation tree. All state is held in memory.

The temporary frontend `/login` route calls the existing `useLogin` hook, which sends `POST /auth/login` and stores the returned user and points together. Omitted `loginId` and `password` query parameters default to `admin` for convenient development login; explicit parameters are passed through. After login, or when already logged in, the route redirects to `/` without a browser reload so the in-memory state is retained. Invalid parameters and request failures are displayed on the route.

## Backend verification

- `npm --prefix back run test` runs focused unit tests followed by the Postman CLI API collection. `test:unit` and `test:api` run each separately.
- API tests use the existing development server at `http://localhost:3000` by default, with its configured MySQL connection. The server must reflect the code being verified. The collection discovers public UUIDs from responses; tests may prepare development-only fixtures and mutate data as needed.
- `back/test/api/README.md` defines startup, target URL overrides, required existing content, and coverage limits. Missing server/data or failed assertions fail verification.

## Media storage

- `back/src/content/mediaStorage.ts` is the single source for content-media `storageKey` construction.
- `front/media/` is a Git-ignored local workspace for media files; it is not an Expo bundle asset or a public URL by itself.
- The `aivideo-dev` bucket exposes only the configured image key patterns through public `s3:GetObject`; video and subtitle keys remain private. API `imageUrls` values are direct S3 URLs.
- FULL episode videos and DRAMA PREVIEW videos use private S3 objects and one-hour presigned GET URLs in development only. Development configures `AWS_REGION`, `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` in the Git-ignored `back/.env.development`; the AWS SDK default credential provider chain reads the environment credentials. Production playback remains unavailable.
- The backend does not provide local image file routes. Public image URLs are generated from storage keys; FULL and PREVIEW playback URLs are separately signed.
