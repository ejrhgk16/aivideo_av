# front-episode-video-playback

## 목표

작품 상세의 모든 공개 회차를 ID로 선택해 기존 `GET /episodes/:episodeId/playback` 응답의 영상 URL을 `expo-video`로 재생한다.

## 범위와 가정

- 작품 상세의 회차 목록에 있는 모든 회차를 선택할 수 있다. `pricePoints`가 0보다 큰 회차도 현재 API 계약대로 재생한다.
- 포인트 표시는 유지하지만 재생 가능 상태와 모순되는 잠금 아이콘은 제거한다. 구매·해제·권한 제약은 추후 작업으로 남긴다.
- 별도 회차 재생 화면에서 `expo-video`의 기본 컨트롤을 사용한다. URL 조회와 영상 로드의 대기·실패 상태를 표시하고 화면을 벗어나면 재생을 멈춘다.
- API가 반환하는 서버 기준 상대 URL은 `EXPO_PUBLIC_API_BASE_URL`을 기준으로 절대 URL로 변환한다. 절대 URL은 그대로 사용한다.
- 백엔드 API·계약, 프리뷰 영상, 구매·해제, 시청 기록은 변경하지 않는다. 로컬 영상 API는 현재 개발 환경에서만 제공된다.
- 기존 디렉터리 책임 안에 파일을 추가하므로 `_docs/ARCHITECTURE.md`는 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | episode-playback-api | `front/src/features/playback/episodePlayback.ts`, `front/tests/unit/episodePlayback.test.ts` | 회차 ID로 재생 정보를 조회하고 재생 URL을 해석하며 성공·오류 계약을 테스트 |
| 2 | episode-playback-screen | `front/src/screens/EpisodePlaybackScreen.tsx`, `front/src/app/episode/[id].tsx`, `front/src/app/_layout.tsx`, `front/src/screens/DramaDetailScreen.tsx` | 회차 선택을 새 재생 화면에 연결하고 `expo-video` 재생·상태 표시·이탈 시 정지 구현 |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없어 먼저 실행한다. `task-2`가 사용할 재생 정보 조회 함수를 제공한다.
- `task-2`는 `task-1` 완료 후 실행한다. 두 task의 대상 파일은 겹치지 않지만 재생 화면이 첫 task의 API 함수에 의존하므로 병렬 실행하지 않는다.

## 검증

- `task-1`: `npm --prefix front run test`, `npm --prefix front run typecheck`.
- `task-2`: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
- 완료 기준: 모든 공개 회차를 선택하면 해당 ID로 재생 정보를 요청하고, 받은 URL로 영상이 재생된다. 상대·절대 URL, 요청 실패, 영상 로드 실패를 처리하며 화면 이탈 시 재생이 멈춘다. 선언된 명령이 통과한다.
- 런타임 영상 재생 확인에는 개발 서버의 공개 회차 영상 파일과 접근 가능한 `EXPO_PUBLIC_API_BASE_URL`이 필요하다. 자동 명령은 네이티브 디코딩까지 검증하지 않는다.

## 승인 및 실행 상태

- 범위 승인: 공개 회차 전체를 ID로 선택해 재생하고 제약은 추후 구현한다.
- task 구성 승인: API 조회·테스트 후 화면·이동을 연결하는 2개 순차 task와 각 파일 범위·검증 명령.
- 계획 상태: draft. `$harness` 실행 전까지 제품 코드는 변경하지 않는다.
