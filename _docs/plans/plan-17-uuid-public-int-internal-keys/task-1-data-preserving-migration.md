# task-1-data-preserving-migration

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `back/src/common/database/migrations/20261005000000InitAiDrama.ts`
- `back/src/common/database/migrations/20261015000000ReplaceContentMedia.ts`
- `back/src/common/database/migrations/20261016000000UpdateMediaStorageKeys.ts`
- `back/src/common/database/migrations/20261019000000AddLandscapePoster.ts`
- `back/src/common/database/databaseConfig.ts`
- `back/README.md`

## 작업

정확한 수정 파일: `back/src/common/database/migrations/20261022000000UseNumericPrimaryKeys.ts` (신규). 기존 마이그레이션은 수정하지 않는다.

1. MySQL 8.4/InnoDB용 TypeORM 마이그레이션을 추가한다. `users`, `production_companies`, `dramas`, `content_images`, `content_videos`, `episodes`, `episode_subtitles`, `content_collections`, `point_transactions`, `episode_entitlements`, `point_products`, `point_purchase_orders`, `ad_reward_offers`, `ad_reward_claims`의 기존 UUID `id`를 보존된 `uuid CHAR(36) NOT NULL UNIQUE`로 옮기고, 새 `id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY`를 부여한다.
2. 모든 UUID 부모 참조 열을 해당 부모의 새 정수 `id`로 매핑한다. 여기에는 `users.production_company_id`, 1:1·복합키 테이블의 기본키 열, 원장·주문·보상 거래 참조와 `content_images/content_videos.content_id`가 포함된다. `content_id`는 `content_type`이 `DRAMA`·`EPISODE`이면 각 테이블의 새 정수 키, `GENRE`이면 기존 `genres.id`를 사용한다. 기존 다형성 유니크·인덱스와 복합키·1:1 유일성을 유지한다. 실제 DB 외래 키 제약은 새로 만들지 않는다.
3. 기존 행의 UUID, 업무 열, 시간 열, `storage_key`, 테이블별 행 수를 보존한다. 임시 UUID→정수 매핑 또는 임시 열을 이용해 자식 열을 바꾸기 전에 누락·중복·범위 초과를 검사한다. 불일치가 있으면 기존 참조 열을 제거하기 전에 오류로 중단한다. 원래의 유니크·CHECK·조회 인덱스·FULLTEXT를 보존한다.
4. `down`은 보존된 UUID로 관계 열과 기본키를 되돌릴 수 있게 작성한다. 작업을 데이터 없는 DB 초기화로 대체하지 않는다. MySQL DDL의 암묵적 커밋을 고려해 마이그레이션을 적용할 별도 DB의 백업·복원 방법과 필요한 사전 점검을 코드 주석에 간결하게 남긴다.

검증 명령: `npm --prefix back run build`.

완료 조건: 신규 마이그레이션이 빌드되고, 별도로 복원한 MySQL DB에서 기존 마이그레이션 연속 적용 및 기존 데이터의 `up`·`down`·재적용을 확인한다. 각 단계에서 행 수·UUID·업무 열·저장 키·부모 참조·인덱스를 비교하고 미매핑 참조 0건을 확인한다. 검증 DB를 사용할 수 없으면 그 사실을 결과에 명시하고 데이터 보존 검증을 통과한 것으로 보고하지 않는다. 운영 DB에는 적용하지 않는다.
