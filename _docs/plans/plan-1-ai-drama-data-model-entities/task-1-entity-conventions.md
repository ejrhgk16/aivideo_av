# task-1-entity-conventions

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- `back/package.json`
- `back/tsconfig.json`

## 작업

`back/src/shared/entities/audited.entity.ts`를 생성하고, 문서의 공통 시간 규칙을 TypeORM abstract class로 정의한다.

- `created_at`, `updated_at`은 MySQL `DATETIME(3)`과 `CURRENT_TIMESTAMP(3)` 기본값을 사용한다.
- 이 기반 클래스는 두 시간 열이 모두 필요한 Entity만 상속하도록 한다. `created_at` 또는 `updated_at`만 있는 테이블의 시간 열은 해당 Entity에서 직접 정의한다.
- Entity가 애플리케이션의 UUID를 받는다는 전제를 유지하며 ID 자동 생성이나 DB 연결 설정은 추가하지 않는다.
- TypeORM 관계 데코레이터와 외래 키는 이 파일에 추가하지 않는다.

### 변경 파일

- `back/src/shared/entities/audited.entity.ts`

### 검증 및 완료 조건

- `npm --prefix back run lint`
- 공통 클래스가 strict TypeScript와 TypeORM 데코레이터 기준으로 lint를 통과한다.
