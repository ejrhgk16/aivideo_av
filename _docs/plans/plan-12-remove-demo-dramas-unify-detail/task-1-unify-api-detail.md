# task-1-unify-api-detail

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/ApiDramaDetailScreen.tsx`
- `front/src/features/drama/dramaContent.ts`
- `front/src/common/media.ts`

## 작업

정확한 변경 파일 범위:

- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/ApiDramaDetailScreen.tsx` (삭제)

`DramaDetailScreen`이 모든 작품 ID에 대해 `getDramaContent(id)`를 호출하도록 한다. 기존 API 화면의 로딩, 404, 요청 실패, 상세 커버 없음, 공개 회차 없음 상태를 옮기고, 기존 정적 화면의 상세 구성과 소개·회차 탭을 API 응답 필드에 맞춘다. 없는 `english`, `total`, `free` 값이나 고정 `10P` 가격을 만들지 않는다. 회차 탭은 응답의 `episodes`만 기존 작은 네모 격자로 렌더링하고 `episodeNumber`, `pricePoints`를 그대로 표시한다. 사용자별 권한·재생 URL이 없으므로 회차 선택, 구매, 저장, 이어보기 버튼은 제공하지 않는다. 별도 `ApiDramaDetailScreen.tsx`는 삭제한다.

완료 조건: API ID 하나가 단일 상세 화면에서 로딩·오류·빈 이미지·빈 회차를 포함해 안전하게 표시되고, 공개 회차는 번호순 네모 격자로 나타난다. 세 임시 ID 전용 분기는 화면에 남지 않는다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
