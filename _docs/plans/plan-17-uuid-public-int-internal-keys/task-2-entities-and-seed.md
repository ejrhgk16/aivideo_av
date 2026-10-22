# task-2-entities-and-seed

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-17-uuid-public-int-internal-keys/task-1-data-preserving-migration.md`
- `back/src/common/database/entities.ts`
- `back/src/common/database/seed.ts`
- `back/src/common/database/seed/initialData.ts`
- `back/test/unit/entities/entities.spec.ts`
- `back/test/unit/database/initialData.spec.ts`

## 작업

정확한 수정 파일:

```text
back/src/identity/entities/user.entity.ts
back/src/identity/entities/userPreference.entity.ts
back/src/content/entities/productionCompany.entity.ts
back/src/content/entities/drama.entity.ts
back/src/content/entities/dramaGenre.entity.ts
back/src/content/entities/contentImage.entity.ts
back/src/content/entities/contentVideo.entity.ts
back/src/content/entities/episode.entity.ts
back/src/content/entities/episodeSubtitle.entity.ts
back/src/programming/entities/contentCollection.entity.ts
back/src/programming/entities/collectionDrama.entity.ts
back/src/playback/entities/userPreviewFeedState.entity.ts
back/src/playback/entities/userSavedDrama.entity.ts
back/src/playback/entities/userWatchProgress.entity.ts
back/src/economy/entities/wallet.entity.ts
back/src/economy/entities/pointTransaction.entity.ts
back/src/economy/entities/episodeEntitlement.entity.ts
back/src/economy/entities/pointProduct.entity.ts
back/src/economy/entities/pointPurchaseOrder.entity.ts
back/src/economy/entities/adRewardOffer.entity.ts
back/src/economy/entities/adRewardClaim.entity.ts
back/src/common/database/seed.ts
back/src/common/database/seed/initialData.ts
back/test/unit/entities/entities.spec.ts
back/test/unit/database/initialData.spec.ts
back/test/unit/database/seed.spec.ts
```

1. 14개 UUID 단일 `id` 엔티티를 `@PrimaryGeneratedColumn`의 `INT UNSIGNED` 숫자 `id`와 고유한 기존 UUID `uuid` 열로 전환한다. 나머지 참조 열은 마이그레이션과 동일한 정수 타입으로 바꾼다. 복합키 5개와 1:1 키 2개는 숫자 참조 열의 기본키 의미를 유지한다. `Genre`와 공통 시간 엔티티는 변경하지 않는다.
2. 초기 시드의 고정 UUID와 S3 키 문자열은 유지한다. 부모를 UUID로 upsert·조회하여 실제 정수 `id`를 얻은 다음 자식 참조에 넣는다. 시드 재실행에서 정수 기본키가 다시 생성되거나 부모 관계가 달라지지 않게 한다. `content_type/content_id`의 `GENRE`·`DRAMA`·`EPISODE` 세 경우를 모두 처리한다.
3. 엔티티 메타데이터 테스트와 초기 시드 테스트를 갱신하고, `seed.spec.ts`에는 UUID→정수 참조 해석과 재실행 후 관계·행 수 보존을 검증하는 단위 테스트를 추가한다. S3 키와 기존 고정 UUID 값이 유지되는지도 검증한다.

검증 명령: `npm --prefix back run test -- test/unit/entities/entities.spec.ts test/unit/database/initialData.spec.ts test/unit/database/seed.spec.ts`.

완료 조건: 해당 테스트가 통과하고 엔티티 메타데이터의 기본키·UUID 유니크·참조 열이 새 마이그레이션과 일치한다. 이 task 중 다른 서비스가 아직 UUID `id`를 사용해 전체 빌드가 실패할 수 있으므로, 전체 빌드는 `task-3`에서 확인한다.
