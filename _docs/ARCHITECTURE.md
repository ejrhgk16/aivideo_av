# Architecture

Application structure, ownership, and dependency boundaries. Installation, execution, tests, and operations are maintained in the [frontend README](../front/README.md) and [backend README](../back/README.md).

```text
front (Expo / React Native) ── HTTP API ──> back (NestJS)
```

## Frontend — `front/`

| Path | Responsibility |
| --- | --- |
| `src/app/` | Expo Router routes and navigators. |
| `src/screens/` | Screen UI and local state. |
| `src/components/` | Reusable UI components. |
| `src/common/` | Shared HTTP, storage, environment, theme, and utilities. |
| `src/features/` | Feature state, API calls, and response types in `*Responses.ts`. |
| `assets/` | Static images, icons, fonts, and licenses. |
| `tests/` | Frontend test suites, shared setup, and test support. |
| `scripts/test-front.cjs` | Frontend test entry point. |
| `jest.config.cjs` | Jest/Expo test configuration. |

Frontend state ownership is defined in the [frontend README](../front/README.md#전역-상태).

## Backend — `back/`

| Path | Responsibility |
| --- | --- |
| `src/{domain}/` | Domain modules, controllers, and services. |
| `src/{domain}/entities/` | Domain TypeORM entities. |
| `src/{domain}/*Responses.ts` | Public response types, separate from entities and query rows. |
| `src/identity/` | User identity, JWT authentication, and login sessions. |
| `src/playback/` | Playback access, saved videos, watch progress, and history. |
| `src/common/entities/` | Shared persistence base entities. |
| `src/common/error/` | Shared errors and application-wide HTTP exception mapping. |
| `src/common/pagination/` | Page parsing, offset/lookahead, and page responses; domains own sizes and queries. |
| `src/common/database/` | DB configuration, entity registry, CLI DataSource, migrations, and development seed. |
| `src/content/mediaStorage.ts` | Media storage-key construction. |
| `test/api/` | Postman HTTP suites and owned fixture/lock support. |
| `test/unit/` | Internal rules and boundaries that HTTP cannot reproduce safely. |

## Documentation and tooling

| Path | Responsibility |
| --- | --- |
| `AGENTS.md` | Project-wide agent instructions. |
| `_docs/api/` | REST contracts and shared API rules. |
| `front/README.md` | Frontend environment, execution, and tests. |
| `back/README.md` | Backend environment, execution, database operations, and tests. |
| `_docs/AI_DRAMA_data_model/` | Table and domain definitions. |
| `_docs/plans/` | Plan catalog, per-plan task state, and human-readable task instructions. |
| `.agents/skills/` | Project workflow skills. |
| `.codex/agents/` | Task and child agent definitions. |
| `.codex/hooks.json`, `.codex/hooks/` | Hook registration and task/file/command/result guards. |
| `tools/harness/` | Harness CLI and tooling tests. |

## Boundaries

- Frontend and backend own independent package.json/lockfiles and response types; neither imports the other's source.
- `web-prototype/` is a preserved standalone reference, excluded from active app and Harness work.
- `admin-prototype/` is a generated static web build of the front `/admin` prototype for review; regenerate it from `front/` per its [README](../admin-prototype/README.md) instead of editing it.
