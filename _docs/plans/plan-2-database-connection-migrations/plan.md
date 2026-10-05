# MySQL 연결 및 TypeORM Migration

## 목표

Plan 1에서 정의한 22개 TypeORM Entity를 NestJS 애플리케이션과 실제 MySQL 8.4 데이터베이스에 연결한다. 개발 환경은 Entity 기반 `synchronize`를 사용하고, production은 `synchronize=false`와 명시적 migration 실행을 사용한다.

## 범위와 비목표

- 범위: 환경별 `.env` 로딩, NestJS TypeORM 연결, TypeORM CLI DataSource, 초기 22개 테이블 migration, 설정 단위 테스트, 실행 문서.
- 개발 환경은 `DB_SYNCHRONIZE=true`를 허용한다.
- production에서 `DB_SYNCHRONIZE=true`는 설정 오류로 거부한다.
- production migration은 앱 시작 시 자동 실행하지 않고 배포 단계의 CLI 명령으로 실행한다.
- migration은 MySQL 8.4, InnoDB, `utf8mb4_0900_ai_ci`, Entity의 인덱스·UNIQUE·CHECK를 반영하며 외래 키는 생성하지 않는다.
- 비목표: seed, repository/service/controller/API, 인증·결제·광고 SDK, 외래 키, `web-prototype/` 변경.

## 사용자 선행 작업

실제 비밀번호와 호스트는 사용자가 작성한다. 저장소에는 `back/.env.example`만 추가하고 `.env.development`, `.env.production`은 커밋하지 않는다.

```env
# back/.env.development
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=여기에_로컬_비밀번호
DB_DATABASE=aivideodb
DB_SYNCHRONIZE=true
```

```env
# back/.env.production
NODE_ENV=production
DB_HOST=운영_DB_호스트
DB_PORT=3306
DB_USERNAME=운영_DB_사용자
DB_PASSWORD=운영_DB_비밀번호
DB_DATABASE=aivideodb
DB_SYNCHRONIZE=false
```

production 실행 시 `.env.production`을 선택할 수 있도록 프로세스 시작 전에 `NODE_ENV=production`을 설정한다. `NODE_ENV`가 없으면 development를 기본값으로 사용한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | database-bootstrap-config | `back/package.json`, `back/package-lock.json`, `back/.env.example`, `back/src/shared/database/databaseConfig.ts`, `back/src/shared/database/dataSource.ts` | 환경변수 계약, 공통 DB 옵션, CLI DataSource, migration npm script 구성 |
| 2 | nest-typeorm-module | `back/src/app.module.ts` | `ConfigModule`과 `TypeOrmModule.forRootAsync`를 통한 앱 DB 연결 |
| 3 | initial-schema-migration | `back/src/shared/database/migrations/20261005000000-initAiDrama.ts` | 22개 테이블의 초기 migration과 역방향 삭제 구현 |
| 4 | tests-and-docs | `back/test/unit/database/databaseConfig.spec.ts`, `_docs/ARCHITECTURE.md`, `back/README.md` | 환경별 설정·production 안전성 테스트와 실행 문서 갱신 |

## 실행 순서 및 병렬 작업

- `task-1`을 먼저 실행한다. Nest 모듈과 CLI migration이 공통 DB 옵션과 DataSource를 사용한다.
- `task-2`와 `task-3`은 `task-1` 완료 후 병렬 실행 가능하다. 대상 파일이 겹치지 않으며, 하나는 Nest bootstrap이고 다른 하나는 migration 파일이다.
- `task-4`는 `task-2`와 `task-3` 완료 후 실행한다. 최종 설정과 migration을 기준으로 테스트와 문서를 검증해야 한다.

## 공통 검증

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- 사용자가 작성한 로컬 MySQL 환경 파일을 기준으로 `npm --prefix back run db:migration:show`
- 사용자가 작성한 로컬 MySQL 환경 파일을 기준으로 `npm --prefix back run db:migration:run`

## 검증 결과

계획 생성 시점에는 제품 코드와 데이터베이스를 변경하지 않았다. Harness 실행 후 각 task 상태와 실제 MySQL 연결·migration 결과를 이 문서에 기록한다.
