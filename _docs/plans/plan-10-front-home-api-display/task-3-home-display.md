# task-3-home-display

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/HomeScreen.tsx`
- `front/src/features/home/homeContent.ts`
- `front/src/common/media.ts`
- `front/src/components/ui.tsx`
- `front/src/features/drama/catalog.ts`
- `front/src/features/drama/ExperienceProvider.tsx`
- Expo 57 공식 문서: `https://docs.expo.dev/versions/v57.0.0/sdk/image/`

## 작업

정확한 변경 파일 범위: `front/src/screens/HomeScreen.tsx`.

현재 로그만 남기는 세 컬렉션 요청을 화면 상태로 연결한다. `HOME_FEATURED`의 `displayOrder` 순서 작품을 히어로·페이지 선택에, `RECOMMENDATION_DAILY`를 추천 포스터 목록에, `EDITORIAL_TOP_3`를 홈 TOP 3와 랭킹 탭에 표시한다. API의 제목, 짧은 소개, 제작사, 첫 장르, 공개·무료 회차 수, `imageUrls`를 실제 화면에 사용한다. 기존 정적 시안의 필드(`english`, `mood`, `badge` 등)를 API 작품에 임의로 만들어 붙이지 않는다.

각 컬렉션의 로딩, 빈 결과, 요청 실패를 구분한다. 한 요청의 실패가 다른 컬렉션 표시를 막지 않아야 하고, 비어 있는 히어로에서 `dramas[0]` 접근 오류가 없어야 한다. API 작품 선택은 UUID로 상세 화면에 이동한다. API 작품의 재생·저장 버튼은 미연결 상태를 알리고 비활성화한다. 최신·장르 탭, 로맨스 배너, 헤더 포인트, 정적 시안 작품의 다른 화면 동작은 그대로 둔다.

완료 조건: 로그 대신 세 영역에 각 API 컬렉션의 서로 다른 데이터가 보이고, API 작품 선택은 해당 ID의 상세 경로로 이동한다. 빈 결과·요청 실패에서 화면이 깨지지 않으며 재생 화면으로 잘못 이동하지 않는다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
