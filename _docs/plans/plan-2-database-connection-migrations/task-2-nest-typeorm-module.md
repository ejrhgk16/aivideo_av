# task-2-nest-typeorm-module

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `back/src/app.module.ts`
- `back/src/shared/database/databaseConfig.ts`
- `back/src/shared/database/dataSource.ts`

## 작업

다음 파일만 수정한다.

- `back/src/app.module.ts`

`ConfigModule.forRoot`를 global module로 등록하고, `NODE_ENV`에 따라 `.env.<NODE_ENV>`와 `.env`를 로드한다. `TypeOrmModule.forRootAsync`를 등록하여 task-1의 공통 DB 옵션으로 Nest 부팅 시 MySQL 연결을 초기화한다.

앱 bootstrap에서 migration을 자동 실행하지 않는다. schema 변경은 task-1에서 추가한 TypeORM CLI 명령을 배포 단계에서 명시적으로 실행한다. 기존 `AppController`와 `AppService` 동작은 유지한다.

완료 조건:

- `AppModule`에 TypeORM 연결이 등록된다.
- 22개 Entity registry가 TypeORM 설정에 전달된다.
- 앱 시작 시 `migration:run`이 자동 호출되지 않는다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
