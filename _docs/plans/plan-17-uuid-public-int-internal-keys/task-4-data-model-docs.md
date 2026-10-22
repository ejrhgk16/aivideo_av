# task-4-data-model-docs

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/plans/plan-17-uuid-public-int-internal-keys/task-1-data-preserving-migration.md`
- `_docs/plans/plan-17-uuid-public-int-internal-keys/task-2-entities-and-seed.md`
- `back/src/common/database/migrations/20261022000000UseNumericPrimaryKeys.ts`
- 이 task의 아래 대상 테이블에 대응하는 `back/src/*/entities/*.entity.ts`

## 작업

정확한 수정 파일:

```text
_docs/AI_DRAMA_data_model/00-overview/common-rules.md
_docs/AI_DRAMA_data_model/01-identity/users.md
_docs/AI_DRAMA_data_model/01-identity/user_preferences.md
_docs/AI_DRAMA_data_model/02-content/production_companies.md
_docs/AI_DRAMA_data_model/02-content/dramas.md
_docs/AI_DRAMA_data_model/02-content/drama_genres.md
_docs/AI_DRAMA_data_model/02-content/content_images.md
_docs/AI_DRAMA_data_model/02-content/content_videos.md
_docs/AI_DRAMA_data_model/02-content/episodes.md
_docs/AI_DRAMA_data_model/02-content/episode_subtitles.md
_docs/AI_DRAMA_data_model/03-programming/content_collections.md
_docs/AI_DRAMA_data_model/03-programming/collection_dramas.md
_docs/AI_DRAMA_data_model/04-playback/user_preview_feed_states.md
_docs/AI_DRAMA_data_model/04-playback/user_saved_dramas.md
_docs/AI_DRAMA_data_model/04-playback/user_watch_progress.md
_docs/AI_DRAMA_data_model/05-economy/wallets.md
_docs/AI_DRAMA_data_model/05-economy/point_transactions.md
_docs/AI_DRAMA_data_model/05-economy/episode_entitlements.md
_docs/AI_DRAMA_data_model/05-economy/point_products.md
_docs/AI_DRAMA_data_model/05-economy/point_purchase_orders.md
_docs/AI_DRAMA_data_model/05-economy/ad_reward_offers.md
_docs/AI_DRAMA_data_model/05-economy/ad_reward_claims.md
```

1. 공통 규칙에 숫자 내부 키와 고유 UUID 외부 식별자를 명시한다. UUID 단일 기본키였던 14개 테이블 문서에는 `id INT UNSIGNED AUTO_INCREMENT PK`, `uuid CHAR(36) NOT NULL UNIQUE`, 숫자 참조 열을 실제 구현대로 적는다.
2. 독립 UUID가 없는 복합키 5개와 1:1 키 2개는 참조 열의 정수 타입과 기존 유일성 의미를 문서화한다. 다형성 `content_id`는 `content_type`별 숫자 대상과 `GENRE`의 기존 `SMALLINT` 키를 설명한다. 실제 DB 외래 키가 없다는 규칙은 유지한다.
3. 각 문서의 인덱스·CHECK·관계 대상과 구현을 대조한다. 이 변경과 무관한 예시·설명은 정리하지 않는다.

검증 명령: `npm --prefix back run build`. 문서의 열 타입·PK·UUID 유니크·참조 대상은 엔티티와 마이그레이션을 직접 대조한다.

완료 조건: 21개 테이블 정의와 공통 규칙이 실제 스키마와 일치하고, 기존 UUID PK 또는 UUID 부모 참조라는 잘못된 설명이 대상 문서에 남지 않는다.
