# task-3-recommendation-video-layout

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md` 및 구현 전에 Expo 57 문서 `https://docs.expo.dev/versions/v57.0.0/`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx` (읽기 전용 영상 배치 참고)

## 작업

변경 파일은 `front/src/screens/RecommendationScreen.tsx` 하나다. `playbackScreen_preview.tsx`와 다른 화면은 수정하지 않고 공통 재생 컴포넌트를 만들지 않는다.

1. 추천 화면에서 영상이 약 4분의 1만 보이고 확대된 것처럼 잘리는 원인을 카드·플레이어의 크기 및 배치에서 확인한다. `playbackScreen_preview.tsx`와 동일하게 실제 영상의 전체 프레임이 카드 영역에 비율을 유지하며 보이도록 수정한다. 영상 자체의 종횡비가 카드와 다르면 남는 영역은 단색 배경으로 둔다.
2. 추천 카드의 모든 포스터 **이미지**를 제거한다. 재생 중 첫 프레임 전 덮개와 비활성·로딩·프리뷰 없음·URL 오류·플레이어 오류 상태의 포스터를 포함한다. 영상이 표시되지 않을 때는 단색 배경을 사용한다. 포스터 URL 계산과 이미지 전용 import 등 이 변경으로 불필요해진 코드도 제거한다.
3. 기존 세로 페이징, `initialId` 우선 표시, 활성 카드별 URL 요청, 재생 조작, 저장·회차·공유·본편 보기 동작을 유지한다. 포스터가 없는 상태에서도 실패 카드의 텍스트·조작과 세로 스크롤을 사용할 수 있어야 한다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기기에서 영상의 상하·좌우 프레임이 잘리지 않는지, 포스터 이미지가 어떤 카드 상태에도 나타나지 않는지, 스와이프와 재생 조작이 유지되는지 확인한다. 기기 확인을 수행하지 못했다면 그 제한을 결과에 명시한다.

완료 조건: 추천 카드의 영상이 확대되거나 잘리지 않고 전체 프레임을 보여주며, 추천 화면 어디에도 포스터 이미지가 렌더링되지 않는다. 영상 로딩·실패 시 단색 배경에서 기존 카드 조작과 스크롤이 동작한다.
