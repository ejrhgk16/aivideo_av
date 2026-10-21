# task-3-remove-demo-flows

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/src/features/home/homeContent.ts`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/LibraryScreen.tsx`
- `front/src/screens/AccountScreen.tsx`
- `front/src/screens/PlayerScreen.tsx`
- `front/src/screens/WalletScreen.tsx`
- `front/src/app/_layout.tsx`
- `front/src/app/player/[id].tsx`
- `front/src/app/wallet.tsx`

## 작업

정확한 변경 파일 범위:

- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/LibraryScreen.tsx`
- `front/src/screens/AccountScreen.tsx`
- `front/src/screens/PlayerScreen.tsx` (삭제)
- `front/src/screens/WalletScreen.tsx` (삭제)
- `front/src/app/_layout.tsx`
- `front/src/app/player/[id].tsx` (삭제)
- `front/src/app/wallet.tsx` (삭제)

추천 탭은 기존 `RECOMMENDATION_DAILY` API 컬렉션의 작품 포스터와 상세 이동만 표시한다. 샘플 기반 자동 재생, 회차 해제, 미리보기, 포인트 동작을 제거한다. 보관함은 저장·시청 기록 API가 연결되지 않은 상태를 명확히 표시한다. 내 정보에서는 체험 포인트·기기 저장 기록·샘플 재생 설정과 이에 대한 설명을 제거하고 현재 제공 가능한 정보만 남긴다. 샘플 전용 재생·포인트 화면과 라우트를 삭제하고 루트 네비게이터·Provider 참조를 정리한다. API 작품 상세로 이동하는 유효한 경로는 유지한다.

완료 조건: 추천·보관함·내 정보가 임시 작품이나 허구의 잔액·시청 상태를 표시하지 않으며, 삭제된 재생·포인트 라우트로 이동하는 버튼이 없다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
