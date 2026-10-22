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
| `src/features/` | Feature-specific state, endpoints, and types. |
| `assets/images/` | Static screen images. |
| `assets/icons/` | Static icons. |
| `assets/fonts/` | Font files and licenses. |
| `media/` | 기존 로컬 미디어 작업 파일. 백엔드에서 이미지나 영상을 직접 제공하지 않는다. |
| `tests/` | Frontend product tests. |

## Backend — `back/`

NestJS API server. Own `package.json` and lockfile.

| Path | Responsibility |
|---|---|
| `src/` | NestJS modules, controllers, and services. |
| `src/{domain}/entities/` | Domain-specific Entity classes and persistence metadata. |
| `src/common/entities/` | Shared persistence base entities and metadata. |
| `src/common/database/` | Shared TypeORM configuration and Entity registry, CLI `DataSource`, explicit development seed CLI, and migration files. |
| `test/unit/` | Backend unit tests. |

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

## Media storage

- `back/src/content/mediaStorage.ts` is the single source for content-media `storageKey` construction.
- `front/media/` is a Git-ignored local workspace for media files; it is not an Expo bundle asset or a public URL by itself.
- The `aivideo-dev` bucket exposes only the configured image key patterns through public `s3:GetObject`; video and subtitle keys remain private. API `imageUrls` values are direct S3 URLs.
- FULL episode videos and DRAMA PREVIEW videos use private S3 objects and one-hour presigned GET URLs in development. The backend reads AWS credentials from the default provider chain and uses `AWS_REGION` and `S3_BUCKET` configuration.
- The backend does not provide local image file routes. Public image URLs are generated from storage keys; FULL and PREVIEW playback URLs are separately signed.
