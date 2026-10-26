# 드라마 이미지 중복 필드 제거와 프리뷰 재생

## 목표

공개 작품 목록, 작품 상세, 홈 컬렉션 응답에서 화면에 쓰지 않는 images 저장소 키 객체를 제거하고 imageUrls를 유지한다. 드라마 상세 화면의 분위기 미리보기 버튼은 첫 번째 프리뷰 UUID로 별도 전체 화면 플레이어를 연다. 프리뷰 화면은 회차 플레이어와 같은 전체 화면 UI를 사용하되 하단 이전 화·다음 화 버튼 대신 1화부터 본편 보기 버튼을 표시한다. 실제 회차 재생 화면과 새 프리뷰 화면의 파일명은 playbackScreen_episode.tsx, playbackScreen_preview.tsx로 맞춘다.

## 범위와 전제

- 백엔드는 저장소 키를 내부적으로 사용해 imageUrls를 계속 생성한다. 공개 응답에서만 images 객체를 제거한다.
- 상세 응답의 previewVideos는 displayOrder 순서이므로 첫 항목을 재생한다. 항목이 없으면 미리보기 버튼을 비활성화한다.
- 기존 GET /dramas/:dramaId/previews/:videoId/playback API를 사용한다. 이 API는 현재 개발 환경에서만 서명 URL을 반환한다.
- 새 프리뷰 화면은 선택한 작품 한 편을 보여준다. task-4/5에서 만든 RecommendationScreen 카드 UI는 task-6에서 회차 플레이어와 같은 전체 화면 UI로 교체한다. 추천 탭의 피드는 변경하지 않는다.
- 현재 작업 트리에서 삭제로 표시된 미사용 front/src/screens/EpisodePlaybackScreen.tsx는 이 계획의 변경 파일에 포함하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 공개 API 이미지 필드 정리 | back/src/content/publicCatalogService.ts, back/src/programming/publicCollectionService.ts, 두 백엔드 단위 테스트, _docs/api/02-content/dramas.md, _docs/api/03-programming/collections.md | 세 공개 응답에서 images를 제거하고 imageUrls 생성과 API 문서를 일치시킨다. |
| 2 | 프론트 이미지 응답 타입 정리 | front/src/features/drama/dramaContent.ts, front/src/features/home/homeContent.ts, 두 프론트 응답 테스트 | 응답 타입과 fixture에서 images를 제거한다. |
| 3 | 프리뷰 재생 API 클라이언트 | front/src/features/playback/previewPlayback.ts, front/tests/unit/previewPlayback.test.ts | 작품·프리뷰 UUID로 재생 URL을 조회한다. |
| 4 | 프리뷰 화면 연결과 파일명 정리 | front/src/screens/DramaDetailScreen.tsx, front/src/screens/ImmersiveEpisodePlaybackScreen.tsx, front/src/screens/playbackScreen_episode.tsx, front/src/screens/playbackScreen_preview.tsx, front/src/app/_layout.tsx, front/src/app/episode/[id].tsx, front/src/app/preview/[dramaId]/[videoId].tsx | 상세 버튼과 새 화면을 연결하고 RecommendationScreen 카드 UI에서 실제 영상을 재생한다. 실제 회차 플레이어 파일도 이름 변경한다. |
| 5 | 프리뷰 재생 컨트롤·영상 배치 조정 | front/src/screens/playbackScreen_preview.tsx | 영상 영역 탭과 4초 타이머로 컨트롤을 숨기고 다시 표시한다. 재생 버튼을 화면 중앙에 놓고 영상은 비율을 유지해 잘리지 않게 표시한다. |
| 6 | 프리뷰 화면을 회차 플레이어 형식으로 변경하고 제목 라우트 파라미터 제거 | front/src/screens/playbackScreen_preview.tsx, front/src/screens/playbackScreen_episode.tsx, front/src/screens/DramaDetailScreen.tsx, front/src/app/episode/[id].tsx | 프리뷰에 회차 플레이어의 전체 화면 UI를 적용하고 하단 이전 화·다음 화 대신 본편 버튼을 둔다. 회차 이동에서 불필요한 dramaTitle 파라미터를 제거한다. |
| 7 | 프리뷰 본편 버튼 색상과 재생 화면 복귀 경로 수정 | front/src/screens/playbackScreen_preview.tsx | 본편 버튼 색을 추천 화면과 맞추고, 본편 진입 시 미리보기를 스택에서 대체해 회차 화면의 X가 작품 상세로 돌아가게 한다. |

## 실행 순서 및 병렬 작업

- task-1, task-2, task-3은 변경 파일이 겹치지 않아 병렬 실행 가능하다.
- task-4는 task-2와 task-3 완료 후 실행한다. 화면이 수정된 DramaContent 타입과 새 프리뷰 재생 클라이언트를 사용한다.
- task-1은 task-4와도 변경 파일이 겹치지 않아 병렬 실행 가능하다.
- task-5는 task-4 완료 후 실행한다. task-4가 만든 프리뷰 화면의 컨트롤 표시, 중앙 재생 버튼 위치, 영상 맞춤 방식을 변경한다.
- task-6은 task-5 완료 후 실행한다. 프리뷰 화면의 카드 UI를 회차 플레이어 형식으로 교체하고, 회차 화면과 그 진입점의 제목 라우트 파라미터를 정리한다.
- task-7은 task-6 완료 후 실행한다. 프리뷰의 본편 버튼 색과 본편 진입 시 스택 이동 방식만 수정한다.

## 검증

- 백엔드: npm --prefix back run lint, npm --prefix back run test, npm --prefix back run build
- 프론트: npm --prefix front run typecheck, npm --prefix front run test, npm --prefix front run export
