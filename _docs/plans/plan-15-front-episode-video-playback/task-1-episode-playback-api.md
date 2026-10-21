# task-1-episode-playback-api

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/04-playback/episodes.md`
- `front/src/features/drama/dramaContent.ts`
- `front/tests/unit/dramaContent.test.ts`
- Expo SDK 57의 `expo-video` 문서: https://docs.expo.dev/versions/v57.0.0/sdk/video/

## 작업

정확한 변경 파일 범위:

- `front/src/features/playback/episodePlayback.ts`
- `front/tests/unit/episodePlayback.test.ts`

회차 ID를 받아 `GET /episodes/:episodeId/playback`을 호출하는 함수를 만든다. 응답의 `url`, `title`, `episodeNumber`, `durationMs`를 타입으로 표현하고, 호출자에게 재생 가능한 절대 URL을 제공한다. API 서버 기준 상대 URL은 `EXPO_PUBLIC_API_BASE_URL`로 해석하고 절대 URL은 그대로 둔다. 회차 ID는 URL 경로에서 인코딩한다. 프로젝트의 기존 fetch·오류 처리 스타일을 따른다. 새 공용 HTTP 계층이나 백엔드 변경은 만들지 않는다.

단위 테스트에서 회차 ID 경로, 상대 URL 해석, 절대 URL 유지, 실패 응답, API 기본 URL 누락을 확인한다. 테스트는 `front/tests/`에만 둔다.

검증 명령:

- `npm --prefix front run test`
- `npm --prefix front run typecheck`

완료 조건: 재생 API 응답을 올바른 영상 URL과 메타데이터로 반환하고, 실패 응답을 호출자가 구별할 수 있는 오류로 전달하며 두 명령이 통과한다.
