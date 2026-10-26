# task-6-preview-episode-player-ui

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- front/src/screens/playbackScreen_preview.tsx
- front/src/screens/playbackScreen_episode.tsx
- front/src/screens/DramaDetailScreen.tsx
- front/src/app/episode/[id].tsx
- Expo SDK 57의 expo-video 문서

## 작업

목표: `playbackScreen_preview.tsx`를 `playbackScreen_episode.tsx`와 같은 전체 화면 재생 UI로 바꾼다. 하단의 이전 화·다음 화 버튼 두 개는 두지 않고, 그 자리에 `1화부터 본편 보기` 버튼 하나만 표시한다.

정확한 변경 파일: `front/src/screens/playbackScreen_preview.tsx`, `front/src/screens/playbackScreen_episode.tsx`, `front/src/screens/DramaDetailScreen.tsx`, `front/src/app/episode/[id].tsx`. 회차 플레이어는 `dramaTitle` 파라미터 제거에 필요한 부분만 수정한다. 공용 플레이어 추출이나 다른 화면 변경은 하지 않는다.

회차 화면의 전체 화면 배경·영상 비율(`contain`)·안전 영역·상단 닫기/배속/더보기·우측 저장/회차/공유·중앙 재생/일시정지·하단 작품 정보/재생 시간/탐색바의 위치와 동작을 프리뷰에 맞게 적용한다. 영상 탭에 따른 컨트롤 표시 전환과 4초 자동 숨김, 탐색 중 타이머 정지와 탐색 완료 후 재시작, 화면 이탈 시 정리도 회차 화면과 같이 동작해야 한다. 회차 번호 등 본편 전용 문구는 `미리보기`로 표시하고, 실제 프리뷰 영상은 현재의 `getPreviewPlayback(dramaId, videoId)`와 프리뷰 UUID로 계속 재생한다. 기존 로딩·오류 처리와 상세 화면 진입 경로는 유지한다. 이전 화·다음 화 선택 로직은 프리뷰에 복사하지 않는다.

`1화부터 본편 보기`는 작품 회차를 `episodeNumber` 오름차순으로 정렬한 첫 회차를 대상으로 한다. 회차가 없으면 버튼을 비활성화한다. 무료 회차면 기존 `/episode/[id]` 경로로 이동하면서 회차 UUID와 `dramaId`만 전달한다. `dramaTitle` 라우트 파라미터는 전달하지 않는다. 유료 회차면 현재 상세 화면의 `EpisodeUnlockDialog` 흐름을 따른다. 재생 화면을 떠날 때 프리뷰 영상을 멈춘다. 저장·회차·공유 버튼은 기존 동작을 유지하고, 회차 화면의 하단 작품 제목 링크는 해당 작품 상세로 연결한다.

회차 화면에서도 `dramaTitle` 라우트 파라미터와 `PlaybackScreenEpisode`/`PlaybackVideo` props를 제거한다. 상세 화면의 회차 이동, 회차 화면의 이전·다음 화 이동, 프리뷰의 본편 이동은 모두 회차 UUID와 `dramaId`만 넘긴다. 회차 화면의 작품명은 이미 호출하는 `getDramaContent(dramaId)` 결과에서 얻고, 조회 전이나 실패 시에는 기존 `playback.title` 또는 회차 번호를 대체 문구로 쓴다. 공유 문구는 조회된 작품명이 있으면 포함한다. `EpisodeUnlockDialog`의 `dramaTitle` UI prop은 유지하되 조회된 작품명 또는 `작품`을 전달한다. 백엔드 API와 회차 재생 API 요청은 변경하지 않는다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 가능한 실행 환경에서 프리뷰의 전체 화면 배치, 세로·가로 영상의 잘림 여부, 탭·4초 자동 숨김, 배속·탐색, 본편 버튼의 첫 회차 이동을 수동 확인한다. 실행 환경이 없으면 해당 항목은 미검증으로 보고한다.

## 완료 조건

- 프리뷰가 회차 플레이어와 같은 전체 화면 형식으로 보이고, 프리뷰 영상의 비율이 유지된다.
- 회차 플레이어의 재생 컨트롤이 프리뷰에서도 동작한다. 프리뷰에는 이전 화·다음 화 버튼이 없고 하단에 `1화부터 본편 보기` 버튼 하나가 있다.
- 본편 버튼은 첫 회차로 이동하거나 유료 회차의 잠금 안내를 연다. 회차가 없을 때는 비활성화된다.
- 회차 라우트와 모든 진입점에서 `dramaTitle` URL 파라미터를 사용하지 않는다. 작품명은 회차 화면의 기존 작품 상세 조회 결과로 표시한다.
- 프리뷰 API, UUID, 로딩·오류 화면은 유지되고 세 검증 명령이 통과한다.
