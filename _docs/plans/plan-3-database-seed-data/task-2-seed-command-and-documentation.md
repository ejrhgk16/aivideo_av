# task-2-seed-command-and-documentation

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/package.json`
- `back/README.md`
- `back/src/common/database/dataSource.ts`
- `back/src/common/database/databaseConfig.ts`
- `back/src/common/database/entities.ts`
- `back/src/common/database/seed/initialData.ts`

## 작업

`back/src/common/database/seed.ts`에 TypeORM `DataSource`를 초기화하고 `initialData.ts`의 데이터를 논리적 부모-자식 순서로 upsert하는 CLI 진입점을 만든다. 모든 데이터 쓰기는 하나의 트랜잭션에서 실행하고, 성공·실패와 관계없이 데이터소스 연결을 종료한다. 각 저장소는 고정 기본 키를 충돌 기준으로 upsert하여 동일 명령의 재실행이 중복 행을 만들지 않게 한다.

`back/package.json`에 `db:seed` 스크립트를 추가한다. 이 스크립트는 컴파일된 시드 CLI를 실행하며, 서버 시작·빌드·마이그레이션 스크립트에서 호출하지 않는다.

`back/README.md`에 개발자가 수동으로 실행하는 방법, 필요한 DB 환경 변수, 재실행 가능성, 운영 배포 자동 실행 제외 원칙을 문서화한다. `_docs/ARCHITECTURE.md`의 백엔드 공용 데이터베이스 영역에는 시드 CLI 책임을 추가한다.

완료 조건:

- `npm --prefix back run db:seed`는 명시적으로 실행할 때만 DB에 데이터를 쓴다.
- 서버 시작, 빌드, 마이그레이션 명령은 시드를 실행하지 않는다.
- 시드 명령을 두 번 연속 실행해도 unique 제약 오류나 중복 행이 발생하지 않는다.
- 아래 검증이 통과한다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
npm --prefix back run db:seed
npm --prefix back run db:seed
```
