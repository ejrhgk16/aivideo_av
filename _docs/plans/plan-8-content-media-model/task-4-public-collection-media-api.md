# task-4-컬렉션-공개-api-미디어-매핑

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/03-programming/collections.md`
- `back/src/programming/programming.module.ts`
- `back/src/programming/public-collection.service.ts`
- `back/test/unit/programming/public-collection.service.spec.ts`
- `back/src/content/entities/contentImage.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`

## 작업

컬렉션 작품 요약이 `ContentImage`와 `ContentVideo`를 조회하도록 Module과 Service를 변경한다. `images`는 콘텐츠 API와 동일하게 `poster`, `homeHero`, `detailCover`, `campaigns`로 반환하고, `previewVideos`는 `storageKey`, `durationMs`를 `displayOrder` 오름차순으로 반환한다. 기존 대문자 `POSTER`, `HERO`, `THUMBNAIL` 응답 키는 제거한다.

컬렉션 API 문서를 새 응답 객체와 관련 테이블(`content_images`, `content_videos`)로 변경한다. 단위 테스트는 공개 컬렉션·작품·회차 필터 및 정렬을 유지하면서 새 이미지·프리뷰 매핑을 검증한다.

완료 조건: `GET /collections/:code`의 구현, 테스트, 문서가 콘텐츠 API와 같은 미디어 응답 계약을 사용한다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
