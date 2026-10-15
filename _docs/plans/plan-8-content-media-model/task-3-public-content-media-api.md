# task-3-콘텐츠-공개-api-미디어-매핑

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/02-content/genres.md`
- `back/src/content/content.module.ts`
- `back/src/content/public-catalog.service.ts`
- `back/test/unit/content/public-catalog.service.spec.ts`
- `back/src/content/entities/contentImage.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`

## 작업

기존 `DramaImage` repository 의존성을 `ContentImage`와 `ContentVideo` repository로 교체한다. 작품 목록과 상세는 드라마 대상 이미지에서 `poster`, `homeHero`, `detailCover`, 정렬된 `campaigns` storage key 배열을 만든다. 같은 작품의 `PREVIEW` 영상은 `displayOrder` 오름차순 `previewVideos` 배열로 반환하며, 각 원소는 `storageKey`, `durationMs`를 가진다.

장르 목록은 해당 장르의 `GENRE_TILE` storage key를 `tileImage`로 반환한다. 작품 상세의 공개 회차는 해당 회차의 `EPISODE_COVER` storage key를 `image`로 반환한다. 이미지 또는 프리뷰가 없으면 단일 키는 `null`, 배열은 빈 배열을 반환한다. 이전 `hero`, `thumbnail` 응답 키는 제거한다.

`GET /dramas`, `GET /dramas/:dramaId`, `GET /genres`의 문서를 실제 응답·노출 규칙과 일치시킨다. 단위 테스트는 새 이미지 종류의 매핑, 캠페인·프리뷰 정렬, 장르 타일, 회차 이미지, 기존 공개 필터와 집계를 함께 검증한다.

완료 조건: 콘텐츠 공개 API 타입·구현·단위 테스트·문서가 새 미디어 응답을 동일하게 정의한다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
