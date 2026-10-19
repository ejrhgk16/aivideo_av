# task-3-landscape-poster-api

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- `back/src/content/media-url.ts`
- `back/src/content/local-image.controller.ts`
- `back/src/content/public-catalog.service.ts`
- `back/src/programming/public-collection.service.ts`

## 작업
변경 파일은 plan index의 `task-3.files`에 선언된 파일만 허용한다.

- 공개 작품 목록·상세 및 컬렉션 응답의 `images`와 `imageUrls`에 `posterLandscape: string | null`을 추가한다. 기존 `poster`, `homeHero`, `detailCover`, `campaigns` 필드는 그대로 유지한다.
- `POSTER_LANDSCAPE` 레코드를 새 필드에 연결하고 개발 환경 URL도 기존 미디어 URL 생성 규칙으로 만든다. 레코드가 없으면 `null`을 반환한다.
- 향후 별도 파일 경로를 사용할 수 있도록 개발용 이미지 제공 endpoint에서 `poster-landscape` 디렉터리를 허용한다. 기존 경로 검증과 개발 환경 제한을 유지한다.
- `GET /collections/HOME_CAMPAIGN`은 기존 컬렉션 endpoint로 제공되며 `campaigns` 이미지 URL을 포함한다. 새 endpoint는 만들지 않는다.
- 두 API 정의서에서 새 필드, null 규칙, `HOME_CAMPAIGN` 코드, 이미지 제공 경로를 구현과 일치시킨다. 관련 단위 테스트를 갱신한다.
- 완료 조건: 컬렉션과 공개 작품 API가 동일한 `posterLandscape` storage key 및 URL을 반환하고, 기존 필드와 캠페인 배열을 유지한다.
- 검증 명령: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
