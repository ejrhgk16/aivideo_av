# task-2-episode-playback-screen

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/04-playback/episodes.md`
- `front/src/features/playback/episodePlayback.ts`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/app/drama/[id].tsx`
- `front/src/app/_layout.tsx`
- `front/src/components/ui.tsx`
- Expo SDK 57의 `expo-video` 문서: https://docs.expo.dev/versions/v57.0.0/sdk/video/

## 작업

정확한 변경 파일 범위:

- `front/src/screens/EpisodePlaybackScreen.tsx`
- `front/src/app/episode/[id].tsx`
- `front/src/app/_layout.tsx`
- `front/src/screens/DramaDetailScreen.tsx`

작품 상세의 모든 공개 회차 타일을 선택 가능하게 만들고 해당 회차 ID를 `/episode/[id]` 라우트에 전달한다. 포인트 표시는 유지하되 유료 회차의 잠금 아이콘은 제거한다. 새 라우트를 루트 Stack에 등록한다.

재생 화면은 `getEpisodePlayback`으로 정보를 읽고, 정보가 준비되면 `expo-video`의 `useVideoPlayer`와 `VideoView`를 사용해 기본 재생 컨트롤을 제공한다. 처음부터 재생할 수 있게 하고, 화면을 떠나거나 화면이 사라지면 재생을 멈춘다. URL 조회 중, 조회 실패, 영상 로드 실패를 구분해 기존 UI 구성 요소로 표시한다. 플레이어 생명주기는 Expo 문서의 hook 방식에 따른다. 추가 기능인 구매·해제, 다음 회차 자동 재생, 프리뷰, 자막, 시청 기록은 구현하지 않는다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 모든 공개 회차 타일이 ID를 전달하며 재생 화면이 API URL을 사용한다. 화면에는 기본 컨트롤과 로딩·오류 상태가 있고 이탈 시 재생이 멈춘다. 세 명령이 통과한다. 실제 미디어 디코딩은 개발 서버와 영상 파일이 준비된 기기에서 별도로 확인한다.
