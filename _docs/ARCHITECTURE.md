# Architecture

Application structure, ownership, and dependency boundaries. Installation, execution, tests, and operations are maintained in the [frontend README](../front/README.md) and [backend README](../back/README.md).

```text
front (Expo / React Native) ── HTTP API ──> back (NestJS)
admin (Next.js) ── SQL ──> shared MySQL <── back (schema owner)
```

## Frontend — `front/`

| Path | Responsibility |
| --- | --- |
| `src/app/` | Expo Router routes and navigators. |
| `src/screens/` | Screen UI and local state. |
| `src/components/` | Reusable UI components. |
| `src/common/` | Shared HTTP, storage, environment, theme, and utilities. |
| `src/common/theme/tokens.ts`, `theme.ts` | PEEKA design tokens (light cream / dark ink palettes, type sizes, spacing, radius) and the hooks (`useColors`, `createThemedStyles`) that pick the palette from the device color scheme. Screens use these instead of hard-coded colors. |
| `src/features/` | Feature state, API calls, and response types in `*Responses.ts`. |
| `src/features/auth/authAge.ts` | Pure KST birth-date validation and age calculation for the auth screens. |
| `src/features/drama/resumePoint.ts` | Pure start/resume rule shared by the home hero, the 빼꼼 feed, and the preview player: which episode the primary button opens and its label ("1화 무료로 보기", "8화 이어보기", "9화 보기", "24화 다시 보기"). |
| `src/screens/AuthLoginScreen.tsx`, `AuthOnboardingScreen.tsx` | Social login preview and first-use terms/birth-date setup; draft input stays local to onboarding. |
| `assets/` | Static images, icons, fonts, and licenses. |
| `assets/images/peeka/` | PEEKA mascot images, one file per slot (`logo`, `strip`, `loading`, `loading-egg`, `empty`, `locked`), rendered through `Peeka` in `components/ui.tsx`. |
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

## Admin — `admin/`

Operator web app (Next.js App Router). It reads and writes the same MySQL database as `back/` directly with `mysql2`, but does not own the schema; tables and migrations stay in `back/`. Setup and execution are in the [admin README](../admin/README.md).

| Path | Responsibility |
| --- | --- |
| `src/app/` | App Router routes: login, project list, project/campaign dashboards, upload. |
| `src/components/` | Shared admin UI, tables, and charts. |
| `src/lib/db.ts` | MySQL connection pool. |
| `src/lib/auth.ts`, `session.ts` | Operator login against `users` and signed session cookie. |
| `src/lib/catalog.ts` | Drama/episode catalog reads. |
| `src/lib/upload.ts`, `uploadValidation.ts` | Validation and transactional insert of `SCHEDULED` dramas/episodes. |
| `src/lib/metrics.ts`, `sampleMetrics.ts` | Metric math and generated sample metrics (no collection tables yet). |
| `tests/` | Vitest unit tests. |

## Documentation and tooling

`auth-prototype/` preserves the `front/` source from `ai/app-auth` at commit `0f10df4c180a8b613cb4dd07d3d85d616e2d3ea7` as a standalone reference. It is separate from the active `front/` application; usage is documented in `front/README.md`.

The active `front/` app owns the `/auth/login` preview and `/auth/onboarding` first-use setup routes, with no separate signup entry. Provider buttons always open first-use setup until real OAuth and new-user detection are connected. Local form state does not create a session; the existing `/login` route remains the development auto-login entry point.

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
- `admin/` owns its own package.json/lockfile, imports no `front/` or `back/` source, and never creates or migrates tables.
- `web-prototype/` is a preserved standalone reference, excluded from active app and Harness work.
