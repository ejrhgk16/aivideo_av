# Architecture

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
| `tests/` | Frontend product tests. |

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
| `test/api/` | Postman HTTP suites and owned fixture/lock support. |
| `test/unit/` | Internal rules and boundaries that HTTP cannot reproduce safely. |

## Documentation and tooling

| Path | Responsibility |
| --- | --- |
| `_docs/api/` | REST contracts and shared API rules. |
| `_docs/AI_DRAMA_data_model/` | Table and domain definitions. |
| `_docs/plans/` | Plan catalog, per-plan task state, and human-readable task instructions. |
| `.agents/skills/` | Project workflow skills. |
| `.codex/agents/` | Task and child agent definitions. |
| `.codex/hooks.json`, `.codex/hooks/` | Hook registration and task/file/command/result guards. |
| `tools/harness/` | Harness CLI and tooling tests. |

Harness execution rules are maintained in [plans/README.md](plans/README.md) and the invoked skill. API test operation, fixture ownership, and locking are maintained in [back/test/api/README.md](../back/test/api/README.md).

## Boundaries

- Frontend and backend own independent package.json/lockfiles and response types; neither imports the other's source.
- Backend controllers/services declare explicit `Promise<ResponseType>` return types, including `Promise<void>` for empty 204 responses.
- `front/tests/`, `back/test/`, and `tools/harness/` are the only test roots; exact placement is defined in [AGENTS.md](../AGENTS.md).
- `web-prototype/` is a preserved standalone reference, excluded from active app and Harness work.
- Structure or file-responsibility changes must update this document.

### Frontend global state

- The root owns one UserProvider for user, points, Access/session state, and playback preferences (`subtitlesEnabled`, `autoplayNext`), plus one SafeAreaProvider. Session changes do not remount navigation.
- Saved flags, active-video progress trackers, and saved/history lists stay in the relevant screens. Features call `user/sessionClient.ts` through `common/http/api.ts`.
- Access stays in memory; native Refresh stays in SecureStore and web Refresh in a server-set HttpOnly cookie. Authentication, refresh, and expiry behavior follow [authentication.md](api/00-overview/authentication.md) and [error-code.md](api/00-overview/error-code.md). Playback behavior is defined in [playback contracts](api/04-playback/README.md).

## 시간 저장·비교·표시 기준

- DB 저장·비교는 UTC다. MySQL DATETIME(3)은 시간대가 없으므로 값 자체가 UTC여야 한다. TypeORM의 `timezone: 'Z'`는 Date 변환 설정이며 DB 서버·세션 시간대를 바꾸지 않는다.
- DB의 현재 시각은 `UTC_TIMESTAMP(3)`을 사용한다. `CURRENT_TIMESTAMP(3)`·`NOW(3)`는 세션 시간대에 의존한다. UTC 드라이버 설정에서 애플리케이션 Date 바인딩도 가능하다.
- API는 ISO 8601 UTC(Z), 한국 시각 표시는 클라이언트의 Asia/Seoul 변환을 사용한다. 표시 목적으로 DB 값에 9시간을 더하지 않는다.
- 시청기록의 명시적 UTC 처리가 기존 스키마 기본값·다른 저장 경로까지 정비한 것은 아니다. 기존 CURRENT_TIMESTAMP 기본값의 적용 범위를 확인한다. 시간 정책 변경은 드라이버·기존 데이터·기본값·공개 시점·직렬화를 함께 검토한다.

## Media storage

- `back/src/content/mediaStorage.ts` owns storageKey construction. `front/media/` is an ignored local workspace, separate from bundled or public assets.
- Images use public S3 URL patterns; video/subtitle objects remain private. FULL/PREVIEW playback URLs are signed only in development. There are no backend local-image routes.
- URL contracts and expiry follow [API conventions](api/00-overview/conventions.md) and [playback contracts](api/04-playback/README.md).
