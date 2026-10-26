# task-7-preview-button-navigation

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- front/src/screens/playbackScreen_preview.tsx
- front/src/screens/RecommendationScreen.tsx (버튼 색상 참고만)
- front/src/screens/playbackScreen_episode.tsx (X의 복귀 동작 확인만)
- Expo SDK 57의 Expo Router 탐색 문서

## 작업

정확한 변경 파일은 `front/src/screens/playbackScreen_preview.tsx` 하나다.

`1화부터 본편 보기` 버튼의 배경·아이콘·문구·오른쪽 메타 색을 `RecommendationScreen.tsx`의 같은 버튼과 맞춘다. 현재 위치·크기와 비활성 상태는 유지한다. 추천 화면 자체는 수정하지 않는다.

현재 상세 → 미리보기 → 무료 첫 회차가 모두 `router.push`로 쌓여 회차 화면의 X가 미리보기로 돌아간다. 무료 첫 회차 진입에서는 미리보기 경로를 회차 경로로 대체하여, 상세에서 진입한 경우 회차 화면의 X가 상세로 돌아가게 한다. 기존 회차 화면의 X 동작과 다른 진입 경로는 수정하지 않는다. 회차 UUID와 작품 UUID(`dramaId`) 전달, 첫 회차 정렬, 유료 회차 잠금 안내, 회차 없음 비활성 상태, 화면 이탈 시 프리뷰 재생 정지는 유지한다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 가능한 실행 환경에서 상세 → 미리보기 → 무료 1화 → X 순서로 이동하여 상세 화면으로 돌아가는지, 버튼 색과 비활성 상태를 확인한다. 실행 환경이 없으면 해당 항목을 미검증으로 보고한다.

## 완료 조건

- 프리뷰의 본편 버튼은 추천 화면과 같은 강조 색을 사용한다.
- 상세에서 미리보기로 들어와 무료 1화로 이동한 뒤 X를 누르면 미리보기가 다시 나타나지 않고 상세로 돌아간다.
- 유료 첫 회차는 기존 잠금 안내를 열고, 회차가 없으면 버튼이 비활성화된다.
- 세 검증 명령이 통과한다.
