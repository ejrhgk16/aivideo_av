# task-1-database-bootstrap-config

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `back/package.json`
- `back/src/shared/database/entities.ts`
- `back/src/*/entities/*.entity.ts`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`

## 작업

다음 파일만 수정한다.

- `back/package.json`
- `back/package-lock.json`
- `back/.env.example`
- `back/src/shared/database/databaseConfig.ts`
- `back/src/shared/database/dataSource.ts`

`@nestjs/config`를 직접 의존성으로 추가하고 다음 환경변수 계약을 구현한다.

- `NODE_ENV`: `development`, `test`, `production`; 미설정 시 `development`.
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`.
- `DB_SYNCHRONIZE`: boolean 문자열이며 development에서만 `true` 허용.

`.env.<NODE_ENV>`를 먼저 읽고 `.env`를 fallback으로 읽는 공통 환경 로딩을 구성한다. 실제 `.env.development`와 `.env.production`은 생성하거나 수정하지 않는다.

`createDatabaseOptions(env)`를 export하여 Nest와 TypeORM CLI가 동일한 옵션을 사용하게 한다. MySQL driver는 `mysql2`, Entity는 `aiDramaEntities`, charset은 `utf8mb4`, timezone은 UTC 기준으로 설정한다. migration glob은 빌드 결과의 `shared/database/migrations`를 가리키고 앱 시작 시 migration 자동 실행은 활성화하지 않는다.

production에서 `DB_SYNCHRONIZE=true`가 들어오면 명확한 설정 오류를 throw한다. development의 기본값은 `true`, production과 test의 기본값은 `false`로 한다.

`dataSource.ts`는 CLI가 사용할 default `DataSource`를 export한다. 다음 npm script를 추가한다.

- `db:migration:show`
- `db:migration:run`
- `db:migration:revert`

각 script는 build된 `dist/shared/database/dataSource.js`를 `-d` 옵션으로 사용한다.

`back/.env.example`에는 실제 비밀번호가 아닌 placeholder만 기록한다.

완료 조건:

- Nest와 CLI가 동일한 `createDatabaseOptions`를 사용한다.
- production에서 `synchronize` 활성화를 방지한다.
- 비밀 값이 저장소 파일에 들어가지 않는다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run build`
