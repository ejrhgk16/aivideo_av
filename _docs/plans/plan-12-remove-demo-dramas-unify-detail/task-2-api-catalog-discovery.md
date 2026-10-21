# task-2-api-catalog-discovery

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `front/src/features/drama/dramaContent.ts`
- `front/src/features/home/homeContent.ts`
- `front/src/screens/HomeScreen.tsx`
- `front/src/screens/SearchScreen.tsx`
- `front/tests/unit/dramaContent.test.ts`

## 작업

정확한 변경 파일 범위:

- `front/src/features/drama/dramaContent.ts`
- `front/src/screens/HomeScreen.tsx`
- `front/src/screens/SearchScreen.tsx`
- `front/tests/unit/dramaContent.test.ts`

`GET /dramas?sort=latest`의 공개 작품 배열 타입과 조회 함수를 추가하고 응답 URL·실패를 단위 테스트한다. 홈 추천·랭킹의 기존 API 컬렉션 연결은 유지한다. 홈 최신 탭은 새 목록을, 장르 탭은 목록의 `genres`와 해당 작품 포스터를 사용한다. 검색 화면은 같은 목록에서 작품명·장르명을 검색하고 장르 필터를 구성한다. 정적 카탈로그와 샘플 포인트 표시·이동을 제거한다. 목록 로딩, 요청 실패, 빈 결과를 구분하고 이미지가 없으면 기존 자리표시를 사용한다.

완료 조건: 세 임시 작품이 홈 최신·장르와 검색에 나타나지 않고, 공개 API 목록의 ID로 상세 화면에 이동한다. API의 빈 결과와 실패가 임시 작품으로 대체되지 않는다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
