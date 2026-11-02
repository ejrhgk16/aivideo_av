# plan-47-screen-local-saved-videos

## 목표

홈의 저장 버튼을 없애고 대표 작품의 첫 프리뷰로 이동하는 '분위기 미리보기' 버튼을 연결한다. 추천·미리보기·에피소드의 저장 기능과 보관함은 유지하면서 `SavedVideosProvider.tsx`와 `savedVideoState.ts`를 제거한다. 저장 여부는 서버 응답을 기준으로 각 화면에서 직접 다루며, 화면 밖으로 영상별 상태를 누적하지 않는다.

## 승인된 범위와 가정

- 사용자는 범위 제시 후 계획 진행을 승인했고, task 구성에서 제안한 새 로컬 훅 대신 '일단 걍 화면에 직접쓰는걸로'를 선택했다. 이 계획은 앞서 제시한 두 task에서 새 훅·전용 테스트를 제외한 구성이다.
- 새 custom hook, Provider, 전역 store, 모듈 전역 영상별 Map, 캐시·구독 계층을 만들지 않는다. 기존 화면 컴포넌트의 `useState`·`useRef`·이벤트·포커스 조회 경로에 직접 작성한다.
- `saveVideo`, `removeSavedVideo`, `getSavedVideos`와 기존 응답의 `isSaved`를 재사용한다. 백엔드·DB·REST 계약은 바꾸지 않는다.
- 홈은 '재생 준비 중' 기본 버튼을 '분위기 미리보기'로 연결하고 옆의 저장 아이콘 버튼을 제거한다. 현재 hero의 `previewVideos[0].uuid`를 사용하며, 프리뷰가 없거나 세션 복원 중이면 비활성화한다. 비로그인 사용자도 미리보기로 바로 이동한다.
- 추천·미리보기·에피소드의 저장/해제 버튼은 유지한다. 저장 성공 후 화면의 해당 영상 상태만 갱신하고, 실패하면 기존 상태와 재시도 가능성을 유지한다.
- 포커스 복귀 시 저장 메타데이터와 보관함을 서버에서 다시 조회한다. 다른 화면으로 이동한 동안의 즉시 전역 동기화 대신 재조회로 최신 상태를 반영한다.
- 기존 사용자 UUID·세션 버전·요청 취소/세대 검사를 유지한다. 늦은 조회가 완료된 저장 결과를 덮어쓰거나 이전 계정·영상의 결과가 현재 화면에 표시되지 않도록 최소한의 화면 내부 검사만 둔다.
- 영상 URL과 플레이어 버퍼 수명은 저장 상태와 분리한다. 저장/해제와 메타데이터 조회만으로 플레이어를 다시 만들거나 재생 위치를 초기화하지 않는다.

## Provider 점검 결과와 유지 대상

현재 `front/src`의 직접 만든 Context는 `UserProvider`와 `SavedVideosProvider`이다. 루트의 라이브러리 Provider는 `SafeAreaProvider`이다.

| 대상 | 결정 | 근거 |
| --- | --- | --- |
| SavedVideosProvider·savedVideoState | 제거 | 조회·저장한 영상별 상태를 세션 동안 전역 누적하는 구조를 화면 데이터로 대체 |
| UserProvider의 사용자·포인트·인증·세션 | 유지 | 상단 바, 로그인, 구매, 재생 등 여러 소비 화면의 공통 상태 |
| UserProvider의 subtitlesEnabled·autoplayNext 및 setter | 유지 | 현재 외부 사용처는 없지만 사용자가 향후 사용을 위해 유지하라고 명시 |
| SafeAreaProvider | 유지 | 공통 Page의 SafeAreaView와 세 재생 화면의 안전 영역 값 제공. 루트에 한 번 배치된 기존 구조 유지 |

`useLogin`의 단순 래퍼 등 별도 정리는 이번 범위에 넣지 않는다. `UserProvider.tsx`의 상태·설정과 인증 클라이언트는 수정하지 않는다.

## 비목표

- 저장 기능 자체의 삭제, 저장 API 변경, DB reset/seed 또는 데이터 정리.
- 새 custom hook·공유 상태 라이브러리·캐시 도입, CSS 전환, SafeArea 구조 변경.
- 재생 버퍼·스와이프·구매·시청기록 기능 리팩토링, 미구현 재생 설정 기능 추가.
- 기존 plan-46 작업이나 다른 변경의 되돌리기. 이 계획 작성 단계에서 제품 코드 수정 또는 worker 실행.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 세 재생 화면의 저장 상태 전환 | RecommendationScreen.tsx, playbackScreen_preview.tsx, playbackScreen_episode.tsx 및 해당 화면 테스트 3개 | 저장 API 직접 호출, 화면 내부 상태·중복 요청 방지·메타데이터 재조회, 재생 수명 유지 |
| 2 | 홈·보관함 전환과 Provider 제거 | HomeScreen.tsx, LibraryScreen.tsx, _layout.tsx, 삭제할 Provider/store/test, 관련 화면 테스트, ARCHITECTURE.md | 홈 분위기 미리보기 연결, 보관함 포커스 재조회, 남은 의존성·전역 store 제거 및 문서 반영 |
| 3 | 저장 변경 후 일시정지 유지 | RecommendationScreen.tsx, recommendationPreviewBuffer.test.ts, savedVideoScreens.test.ts, playbackScreenEpisode.test.ts | 추천 자동 재생의 의존성을 영상·플레이어 기준으로 안정화하고 세 재생 화면의 일시정지 유지 검증 |

정확한 수정 허용 파일과 검증 명령은 이 폴더 `index.json`과 각 task 문서에 선언한다. 기존 테스트를 읽거나 실행하기만 하는 경우 `files`에 넣지 않는다.

## 실행 순서 및 병렬 작업

- `task-1`은 선행 task 없이 시작한다. 독립적으로 실행할 수 있지만 `task-2`와 병렬 실행하지 않는다.
- `task-2`는 `task-1` 완료 후 실행한다(`depends_on: ["task-1"]`). 세 재생 화면이 전환되기 전에 Provider를 삭제하면 import와 동작이 깨진다. 두 task가 `front/tests/unit/savedVideoScreens.test.ts`를 순차 수정하므로 파일 충돌도 방지한다.
- `task-1`에서는 홈·보관함에 필요한 기존 Provider와 store를 그대로 둔다. `task-2`에서 남은 소비처와 루트 연결을 제거한 다음 두 소스와 기존 store 테스트를 삭제한다.
- 두 task 모두 실제 DB·HTTP 서버·공유 fixture를 사용하지 않는다. 테스트 실행기는 실행별 임시 출력 디렉터리를 사용하지만, 공유 테스트 수정과 삭제 의존성 때문에 순차 실행한다.
- 리뷰 후 추가한 `task-3`은 `task-1`·`task-2` 완료 후 순차 실행한다. 두 task의 화면 및 테스트 파일을 다시 수정하므로 병렬 실행하지 않는다. API·미디어 모의 테스트를 사용하고 외부 fixture는 만들지 않는다.
- 기존 `dev` 작업 공간에서 수행한다. branch·worktree·commit·push 작업을 추가하지 않는다.

## 검증과 완료 기준

| 기능/영향 | 검증 파일 또는 명령 | 확인 사항 |
| --- | --- | --- |
| 미리보기 저장·홈 이동 | front/tests/unit/savedVideoScreens.test.ts | 실제 UUID·PUT/DELETE 호출 인자, 로컬 버튼 상태, 포커스 재조회, 홈의 미리보기 이동·미제공·익명 접근 |
| 추천 저장·플레이어 수명 | front/tests/unit/recommendationPreviewBuffer.test.ts | 저장 후 카드 재진입·복귀, 조회/저장 경합, 기존 버퍼·제스처·현재 영상 유지 |
| 에피소드 저장·시청 | front/tests/unit/playbackScreenEpisode.test.ts | EPISODE의 실제 videoUuid, 중복 요청·실패·세션 경계, 재생 위치·시청기록 유지 |
| 저장 API 클라이언트 | front/tests/unit/savedVideos.test.ts | 기존 API 클라이언트·saved route 계약 회귀 |
| 시청기록 | front/tests/unit/watchProgress.test.ts | 저장 UI 전환과 무관하게 기존 tracker 경계 유지 |
| 보관함 | front/tests/unit/libraryScreen.test.ts | 포커스 복귀 재조회, 저장/해제 후 서버 목록 반영, 페이지 중복·실패·계정 경계 |
| 루트 세션·구매 소비처 | front/tests/unit/sessionExpiredDialog.test.ts, session.test.ts, login.test.ts, episodeUnlockDialog.test.ts | Provider wrapper 제거 후 루트 모달·세션·로그인·구매 회귀 |
| 전체 프론트 타입 | npm --prefix front run typecheck | 삭제된 import·타입·props의 잔존 검출 |
| 문서·삭제 일치 | 소스와 테스트에서 삭제 모듈 참조 검색 및 ARCHITECTURE.md 대조 | 현재 구조 설명에 이전 Provider/store의 책임이 남지 않음. 과거 plan 문서는 수정하지 않음 |

선택 검사 범위는 Provider import와 소비 화면을 전수 검색한 근거로 정했다. UserProvider의 구현과 공통 API 클라이언트는 변경하지 않으므로 이번 task에서 전체 프론트 테스트·export를 반복하지 않는다. 최종 `$finish-plan` 단계는 변경된 프론트 전체 typecheck·test·export를 수행한다.

명시된 task checks는 서버 없이 실행하는 모의 화면·클라이언트 테스트이다. 실제 개발 서버 연결·네이티브 기기 실행을 검증했다고 보고하지 않는다. 추가로 서버 검증을 하게 되면 기존 프론트 8081·백엔드 3000만 사용하며 자동 실행하거나 다른 포트로 우회하지 않는다.

완료 시 전역 영상별 저장 store와 새 custom hook이 없고, 홈 미리보기·기존 저장 기능·보관함·세션 보호가 모두 선택 검사를 통과해야 한다.

## 계획 작성 검증

- 제품 코드는 변경하지 않는다. task 상태는 모두 `pending`이다.
- 두 task 문서를 다시 열어 수정 범위·핵심 로직 예시·검증 명령·완료 조건이 index와 일치하는지 검토 완료.
- 계획 구조 검증: `node tools/harness/cli.mjs validate --plan plan-47-screen-local-saved-videos` 통과(`valid: true`, exit 0).
- 제품 테스트는 아직 실행하지 않았다. 실제 구현과 task별 checks는 사용자가 `$harness`를 명시적으로 호출한 뒤 수행한다.

## 리뷰 후 추가 작업

- `task-1`·`task-2` 구현 완료 후, 추천 화면에서 일시정지한 영상을 저장·해제하면 재생이 다시 시작되는 P2 문제가 리뷰에서 재현됐다. 저장 결과가 collection 객체를 바꾸고, `activePreviewTarget` 참조 변경이 자동 재생 effect를 재실행하는 것이 원인이다.
- 사용자의 추가 task 작성 요청에 따라 `task-3`을 `pending`으로 추가했다. 기존 두 task의 완료 상태와 결과는 유지한다. 위 계획 작성 검증은 최초 작성 시점의 기록이다.
- 추천 화면의 영상 선택 값과 자동 재생 의존성만 최소 수정한다. 별도 미리보기·에피소드 화면은 같은 원인의 문제가 확인되지 않았으므로 제품 코드는 수정하지 않고 기존 화면 harness에 일시정지 후 저장·해제 회귀 검증을 추가한다.
- 추천 테스트는 기존 코드에서 실패하는 재현 사례와 실제 영상 전환의 자동 재생을 함께 검사한다. 미리보기·에피소드 테스트는 저장 변경 후 재생 상태·위치·플레이어 수명 보존을 확인한다. 영향 범위가 화면과 기존 테스트 세 파일로 한정되므로 해당 테스트 및 타입 검사를 선언하며, 전체 test·export는 `$finish-plan`에서 수행한다.
- 이번 추가 작업은 task 문서·목록만 작성한다. 제품 코드 수정과 제품 테스트 실행은 후속 `$harness`에서 수행한다.

