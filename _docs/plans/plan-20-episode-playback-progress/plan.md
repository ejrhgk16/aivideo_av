# episode-playback-progress

## 목표

plan-19에서 만든 회차 재생 화면의 현재 시간, 총 재생 길이, 진행 막대와 드래그 탐색이 웹 모바일 화면에서도 정상 동작하도록 한다.

## 범위와 가정

- `front/src/screens/EpisodePlaybackScreen.tsx`의 재생 성공 화면만 수정한다. 본편 영상은 유한한 재생 길이를 가진다.
- 설치된 `expo-video` 웹 구현은 `sourceLoad` 이벤트를 내보내지 않는다. 현재 화면은 이 이벤트에만 총 길이 갱신을 연결했으므로 웹에서 `duration`이 0으로 남아 슬라이더가 비활성화된다. `timeUpdate`와 재생 준비 상태에서 `player.duration`을 읽어 웹과 네이티브를 함께 처리한다.
- 길이를 알기 전에는 탐색을 비활성화하고, 유효한 길이가 확인되면 현재 시간·총 길이·진행 막대와 탐색 가능 상태를 동기화한다. 탐색 중에는 자동 숨김과 재생 시간 갱신이 드래그를 방해하지 않도록 한다.
- 기존 전체 화면 배치, 영상 비율, 뒤로 가기·재생/일시정지 컨트롤, API 응답, 다른 화면 및 디자인 전반은 변경하지 않는다. 디렉터리 책임도 바뀌지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | episode-playback-progress | `front/src/screens/EpisodePlaybackScreen.tsx` | 플레이어 길이·현재 시간 동기화, 진행 막대 표시와 드래그 탐색 복구 |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없는 단일 task다. 함께 실행할 다른 task가 없으므로 병렬 작업은 없다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 완료 기준: 길이가 알려진 본편을 재생하면 총 길이가 0:00 대신 표시되고, 현재 시간과 진행 막대가 재생에 맞춰 증가한다. 막대 드래그를 놓으면 영상이 선택한 위치로 이동하며 이후 시간·막대 표시가 다시 동기화된다. 기존 iOS/Android 재생 컨트롤 동작도 유지한다.
- 웹에서 iPhone/Android 크기의 화면으로 실제 영상을 재생해 길이 표시·진행·드래그·자동 숨김을 확인한다. 자동 명령은 브라우저의 실제 미디어 이벤트와 터치를 검증하지 않으므로 수동 확인 결과를 별도로 기록한다.

## 승인 및 실행 상태

- 범위 승인: 회차 재생 화면의 시간·진행 막대·탐색 복구. API·다른 화면·디자인 변경 제외.
- task 구성 승인: `front/src/screens/EpisodePlaybackScreen.tsx` 한 파일의 단일 task와 선언된 세 검증 명령.
- 계획 상태: draft. `$harness` 실행 전까지 제품 코드는 변경하지 않는다.
