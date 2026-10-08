# task-1-seed-data-definition

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/scope.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `back/src/common/database/entities.ts`
- `back/src/content/entities/index.ts`
- `back/src/programming/entities/index.ts`
- `back/src/economy/entities/index.ts`

## 작업

`back/src/common/database/seed/initialData.ts`에 TypeORM entity property 이름을 사용하는 고정 UUID 초기 데이터 정의를 만든다. 대상은 제작사 3개, 장르 6개, 작품 5개, 작품-장르 10개, 작품 이미지 15개, 회차 20개, 회차 영상 40개, 회차 자막 20개, 컬렉션 3개, 컬렉션-작품 연결 13개, 포인트 상품 3개, 광고 보상 상품 2개다.

모든 작품과 회차는 일반 조회 가능한 `PUBLISHED` 상태와 과거 `publishedAt`을 사용한다. 작품별 1화는 `pricePoints` 0, 2~4화는 양수로 설정한다. 영상은 회차별 `FULL`과 `PREVIEW` 행을 각각 하나씩 정의하고, 경로는 `episode_videos.storage_key`에 들어갈 예시 키 문자열만 사용한다. 이미지와 자막도 각각의 `storageKey`만 정의하며 실제 파일은 추가하지 않는다.

`back/test/unit/database/initialData.spec.ts`에 DB 연결 없이 데이터 정의만 검증하는 단위 테스트를 작성한다. 정확한 행 수, 참조 대상 존재, 작품별 무료/유료 회차 구성, 회차별 `FULL`/`PREVIEW` 쌍, 컬렉션 편성 순서, 스토리지 키의 대상 컬럼을 검증한다.

완료 조건:

- 정의된 모든 ID와 유니크 코드가 고정되어 재실행 때 동일하다.
- 관계 컬럼이 정의 내의 상위 데이터 ID를 가리킨다.
- 사용자·지갑·원장·구매·권한 데이터는 포함하지 않는다.
- 아래 검증이 통과한다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```
