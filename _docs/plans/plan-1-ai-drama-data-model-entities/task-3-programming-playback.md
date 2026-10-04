# task-3-programming-playback

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/AI_DRAMA_data_model/03-programming/*.md`
- `_docs/AI_DRAMA_data_model/04-playback/*.md`
- `back/src/shared/entities/audited.entity.ts`
- `back/tsconfig.json`

## 작업

문서의 programming과 playback 영역을 1개 테이블당 1개 TypeORM Entity로 만든다. 파일명은 단수 kebab-case이며, `@Entity`의 실제 테이블명은 문서의 snake_case를 유지한다.

### programming

- `content_collections` → `back/src/programming/entities/content-collection.entity.ts`
- `collection_dramas` → `back/src/programming/entities/collection-drama.entity.ts`
- `back/src/programming/entities/index.ts`

### playback

- `user_saved_dramas` → `back/src/playback/entities/user-saved-drama.entity.ts`
- `user_watch_progress` → `back/src/playback/entities/user-watch-progress.entity.ts`
- `user_preview_feed_states` → `back/src/playback/entities/user-preview-feed-state.entity.ts`
- `back/src/playback/entities/index.ts`

각 문서의 컬럼, nullable, 기본값, 복합 PK, UNIQUE, CHECK, 인덱스를 반영한다. `collection_dramas`의 `(collection_id, drama_id)` PK와 `(collection_id, display_order)` UNIQUE, playback 세 테이블의 문서상 복합 PK를 정확히 정의한다. `ends_at > starts_at`, 피드의 collection/drama 일관성처럼 서비스 검증이 필요한 규칙은 Entity 관계나 FK로 우회하지 말고 주석 또는 구현 task의 계약으로 남긴다.

`user_preview_feed_states`는 `updated_at`만, `user_saved_dramas`는 `saved_at`만, `user_watch_progress`는 문서의 `created_at`, `updated_at`, `last_played_at`을 사용한다. 문서 범위를 넘는 시청 이벤트·추천 점수·다운로드 컬럼은 추가하지 않는다.

### 검증 및 완료 조건

- `npm --prefix back run lint`
- 위 5개 테이블이 각각 정확히 하나의 Entity 파일과 연결되고, 각 도메인 `index.ts`가 해당 Entity만 export한다.
