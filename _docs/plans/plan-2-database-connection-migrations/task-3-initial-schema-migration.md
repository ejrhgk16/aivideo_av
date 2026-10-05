# task-3-initial-schema-migration

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- `_docs/AI_DRAMA_data_model/01-identity/`
- `_docs/AI_DRAMA_data_model/02-content/`
- `_docs/AI_DRAMA_data_model/03-programming/`
- `_docs/AI_DRAMA_data_model/04-playback/`
- `_docs/AI_DRAMA_data_model/05-economy/`
- `back/src/shared/database/entities.ts`
- `back/src/*/entities/*.entity.ts`
- `back/src/shared/database/dataSource.ts`

## 작업

다음 파일만 생성한다.

- `back/src/shared/database/migrations/20261005000000-initAiDrama.ts`

TypeORM `MigrationInterface`로 초기 schema migration을 구현한다. `up`에는 다음 22개 테이블을 생성하고, `down`에는 의존성이 없는 역순으로 삭제한다.

- `users`, `user_preferences`
- `production_companies`, `dramas`, `genres`, `drama_genres`, `drama_images`, `episodes`, `episode_videos`, `episode_subtitles`
- `content_collections`, `collection_dramas`
- `user_saved_dramas`, `user_watch_progress`, `user_preview_feed_states`
- `wallets`, `point_transactions`, `episode_entitlements`, `point_products`, `point_purchase_orders`, `ad_reward_offers`, `ad_reward_claims`

Entity와 데이터 모델 문서의 컬럼 타입, nullable/default, PK, UNIQUE, CHECK, 인덱스를 반영한다. 모든 테이블은 InnoDB와 `utf8mb4_0900_ai_ci`를 사용한다. 문서의 외래 키 비사용 원칙에 따라 `FOREIGN KEY`, `REFERENCES`, `ON DELETE`는 생성하지 않는다.

특히 UUID `CHAR(36)`, UTC `DATETIME(3)`, 정수형 포인트·원화, enum CHECK 조건, FULLTEXT title index를 보존한다. migration은 앱 부팅에 연결하지 않고 CLI로만 실행한다.

완료 조건:

- 새 빈 schema에 migration을 실행하면 22개 테이블이 생성된다.
- 같은 migration을 두 번 실행해도 pending migration 또는 duplicate 오류가 발생하지 않는다.
- `migration:show`에서 초기 migration이 적용 상태로 표시된다.
- 실제 로컬 MySQL 검증 시 사용자가 작성한 환경 파일의 대상 DB만 사용한다.

검증:

- `npm --prefix back run build`
- `npm --prefix back run db:migration:show`
- `npm --prefix back run db:migration:run`
