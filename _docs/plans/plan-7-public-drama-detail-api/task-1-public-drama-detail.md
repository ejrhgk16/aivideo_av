# task-1-public-drama-detail

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/src/content/public-catalog.controller.ts`
- `back/src/content/public-catalog.service.ts`
- `back/src/content/entities/drama.entity.ts`
- `back/src/content/entities/episode.entity.ts`
- `back/src/content/entities/dramaImage.entity.ts`
- `back/test/unit/content/public-catalog.service.spec.ts`
- `_docs/api/00-overview/conventions.md`

## 작업

대상 파일은 아래 세 파일로 한정한다.

- `back/src/content/public-catalog.controller.ts`
- `back/src/content/public-catalog.service.ts`
- `back/test/unit/content/public-catalog.service.spec.ts`

`GET /dramas/:dramaId`를 추가한다. 공개 작품(`status = PUBLISHED`, `publishedAt <= now`)만 조회하고, 조건을 만족하지 않거나 존재하지 않는 작품은 NestJS `NotFoundException`으로 처리한다.

응답은 작품의 `id`, `slug`, `title`, `shortDescription`, `synopsis`, 제작사명, 장르, `poster`/`hero`/`thumbnail` 이미지 storage key와 공개 회차 배열을 포함한다. 회차 배열에는 `id`, `episodeNumber`, `title`, `synopsis`, `durationMs`, `pricePoints`를 넣고 `episodeNumber` 오름차순으로 정렬한다. 회차도 `status = PUBLISHED`이고 `publishedAt <= now`인 경우에만 포함한다.

사용자 인증, `episode_entitlements` 조회, 사용자별 접근 상태, 구매·재생 기능은 구현하지 않는다. `pricePoints`는 공개 회차의 가격 정보로만 반환한다.

기존 `PublicCatalogService` 단위 테스트를 확장해 공개 상세 조합, 비공개 회차 제외, 회차 정렬, 가격 보존, 비공개·미존재 작품의 404를 검증한다.

검증 명령:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`

완료 조건: 위 검증 명령이 모두 통과하고, 새 endpoint가 공개 콘텐츠 규칙을 따르며 개인별 권한 데이터를 노출하지 않는다.
