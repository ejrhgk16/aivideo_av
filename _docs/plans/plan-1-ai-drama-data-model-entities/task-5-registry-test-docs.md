# task-5-registry-test-docs

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `back/src/identity/entities/index.ts`
- `back/src/content/entities/index.ts`
- `back/src/programming/entities/index.ts`
- `back/src/playback/entities/index.ts`
- `back/src/economy/entities/index.ts`
- `back/test/unit/app.controller.spec.ts`
- `back/package.json`

## 작업

### 전체 Entity registry

`back/src/shared/database/entities.ts`를 생성한다.

- 5개 도메인 barrel을 re-export한다.
- `aiDramaEntities` 배열에 22개 Entity를 문서의 테이블 범위와 동일하게 한 번씩 등록한다.
- DB 연결이나 `AppModule` import는 추가하지 않는다. 이 registry는 이후 TypeORM 설정이 사용할 수 있는 순수 export로 둔다.

### 메타데이터 단위 테스트

`back/test/unit/entities/entities.spec.ts`를 생성한다.

- `aiDramaEntities`의 개수가 22개인지 확인한다.
- Entity metadata의 실제 테이블명 집합이 문서의 22개 snake_case 테이블명과 정확히 일치하는지 확인한다.
- 중복 테이블명과 누락 테이블을 검출한다.
- 복합 PK, 대표 UNIQUE/CHECK/index metadata가 유지되는지 최소한의 대표 검증을 추가한다.
- 생성한 Entity들에 object relation metadata가 등록되지 않았음을 확인해 문서의 FK 비사용 원칙을 보호한다.
- 실제 MySQL 연결 없이 TypeORM decorator metadata만 검증한다.

### 아키텍처 문서

`_docs/ARCHITECTURE.md`의 Backend 표에 `src/{domain}/entities/`, `src/shared/entities/`, `src/shared/database/` 책임을 추가한다. 도메인별 Entity, 공통 persistence metadata, Entity registry만 문서화하며, DB 연결·migration·service 책임을 이 경로에 부여하지 않는다.

### 검증 및 완료 조건

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- 22개 Entity가 모두 registry와 테스트에 포함되고, 기존 `AppController` 테스트도 통과한다.
