# task-2-document-public-drama-detail

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/02-content/README.md`
- `_docs/api/02-content/dramas.md`
- `back/src/content/public-catalog.controller.ts`
- `back/src/content/public-catalog.service.ts`

## 작업

대상 파일은 `_docs/api/02-content/dramas.md`로 한정한다.

구현된 `GET /dramas/:dramaId`의 path parameter, 인증 여부, 200 응답 예시와 모든 필드, 404 응답, 공개 작품·회차 필터와 회차 정렬 규칙을 문서화한다. 회차의 `pricePoints`가 0이면 무료이고, 0보다 크면 해제에 필요한 포인트임을 설명한다.

사용자별 구매·해제 여부와 `FREE`/`LOCKED`/`ENTITLED` 접근 상태는 이번 공개 API의 응답에 포함되지 않으며, 인증된 후속 API의 범위라는 점을 명시한다.

검증 명령:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`

완료 조건: 문서가 실제 구현의 경로, 필드, 오류와 공개 규칙을 정확히 반영하며 개인화되지 않은 공개 API의 경계를 명확히 설명한다.
