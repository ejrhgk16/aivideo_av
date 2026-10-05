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
| `src/theme/` | Design tokens and shared styling. |
| `src/features/` | Feature state, endpoints, and types. |
| `src/services/` | Shared HTTP, storage, and environment services. |
| `src/utils/` | Pure shared utility functions only. |
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
| `src/shared/entities/` | Shared persistence base entities and metadata. |
| `src/shared/database/` | Shared TypeORM configuration and Entity registry, CLI `DataSource`, and migration files. |
| `test/unit/` | Backend unit tests. |

## Web prototype — `web-prototype/`

Preserved standalone web prototype. It is not imported or run by `front/`, and is excluded from active app and Harness work.

## Codex Harness and documentation

| Path | Responsibility |
|---|---|
| `_docs/plans/index.json` | Harness plan catalog and plan-level status only. |
| `_docs/plans/plan-N-name/index.json` | Task definitions and execution state for one plan. |
| `_docs/plans/plan-N-name/plan.md` | Human-readable plan scope, task details, and verification results. |
| `.agents/skills/` | Project-local Codex skills. |
| `.codex/agents/` | Codex worker definitions. |
| `.codex/hooks.json` | Codex hook registration. |
| `tools/harness/` | Harness CLI, hook support, and tooling tests. |

## Boundaries

- Frontend and backend dependencies are managed independently.
- `front/tests/`, `back/test/`, and `tools/harness/` are the only test roots.
- A directory responsibility change must update this document in the same task.
