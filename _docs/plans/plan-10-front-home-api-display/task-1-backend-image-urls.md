# task-1-backend-image-urls

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- `back/src/content/media-storage.ts`
- `back/src/content/content.module.ts`
- `back/src/content/public-catalog.service.ts`
- `back/src/programming/public-collection.service.ts`
- `back/test/unit/content/public-catalog.service.spec.ts`
- `back/test/unit/programming/public-collection.service.spec.ts`

## 작업

정확한 변경 파일 범위:

- `back/src/content/media-url.ts` (신규)
- `back/src/content/local-image.controller.ts` (신규)
- `back/src/content/content.module.ts`
- `back/src/content/public-catalog.service.ts`
- `back/src/programming/public-collection.service.ts`
- `back/test/unit/content/media-url.spec.ts` (신규)
- `back/test/unit/content/local-image.controller.spec.ts` (신규)
- `back/test/unit/content/public-catalog.service.spec.ts`
- `back/test/unit/programming/public-collection.service.spec.ts`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`

기존 `images`의 storage key 형태를 유지하고, 동일한 `poster`, `homeHero`, `detailCover`, `campaigns` 구조의 `imageUrls`를 컬렉션과 공개 작품 목록·상세 응답에 추가한다. 이미지가 없는 필드는 `null` 또는 빈 배열을 유지한다. 개발 환경에서는 `storageKey`로부터 API 서버 기준 상대 URL을 생성한다. 운영 signer가 없는 환경에는 개발용 로컬 URL을 내보내지 않는다.

NestJS에 개발용 이미지 GET 경로를 추가한다. `MEDIA_STORAGE_ROOT` 아래 작품 이미지 `.webp`만 허용하고 경로 탈출·영상 파일 요청은 거부한다. 파일을 JSON에 넣지 않고 HTTP 응답으로 제공한다. 개발 전용 노출 규칙, 경로·요청 값·성공·오류 응답을 콘텐츠 API 문서에 적고, 컬렉션·작품 응답 문서에 `imageUrls`의 로컬 URL과 향후 signed URL 형식을 명시한다. 기존 공개 조건과 정렬을 유지한다.

완료 조건: 개발 이미지 파일 요청이 정상 응답하고 잘못된 경로·이미지 외 파일은 거부되며, 컬렉션·작품 응답의 `images`와 `imageUrls`가 같은 이미지에 대응한다. 백엔드 endpoint 변경 문서를 구현과 일치시킨다.

검증 명령:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
