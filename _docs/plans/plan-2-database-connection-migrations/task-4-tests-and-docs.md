# task-4-tests-and-docs

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `back/src/app.module.ts`
- `back/src/shared/database/databaseConfig.ts`
- `back/src/shared/database/dataSource.ts`
- `back/src/shared/database/entities.ts`
- `back/src/shared/database/migrations/20261005000000-initAiDrama.ts`
- `back/test/unit/entities/entities.spec.ts`
- `back/README.md`

## 작업

다음 파일만 수정 또는 생성한다.

- `back/test/unit/database/databaseConfig.spec.ts`
- `_docs/ARCHITECTURE.md`
- `back/README.md`

`databaseConfig.spec.ts`는 실제 MySQL에 연결하지 않는 단위 테스트로 작성한다.

- development 환경에서 `DB_SYNCHRONIZE=true`가 적용되는지 검증한다.
- production 환경의 기본 `synchronize=false`를 검증한다.
- production에서 `DB_SYNCHRONIZE=true`가 throw되는지 검증한다.
- MySQL driver, database name, Entity registry, migration 경로가 설정되는지 검증한다.

`_docs/ARCHITECTURE.md`의 `src/shared/database/` 책임을 Entity registry만이 아니라 TypeORM 공통 설정, CLI DataSource, migrations를 포함하는 것으로 갱신한다.

`back/README.md`에는 다음을 문서화한다.

- `back/.env.example`을 기반으로 `.env.development`와 `.env.production`을 사용자가 작성하는 방법
- development에서만 `DB_SYNCHRONIZE=true`를 사용하는 정책
- production에서 `DB_SYNCHRONIZE=false`를 유지하는 정책
- 배포 단계의 `db:migration:show` 및 `db:migration:run` 실행 절차
- 비밀번호와 실제 환경 파일을 커밋하지 않는 규칙

완료 조건:

- 새 테스트가 `back/test/unit/**/*.spec.ts` 아래에 있다.
- 설정 단위 테스트가 DB 없이 통과한다.
- 아키텍처 문서와 실제 구현 책임이 일치한다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
