# plan-50-watch-history-library

## 목표

보관함의 시청 기록 탭에서 로그인 사용자의 본편·미리보기 시청기록을 최근 시청순으로 페이징 조회한다. 시청을 완료하지 않은 기록도 포함한다. 추천 화면과 미리보기 영상 화면에서도 실제 재생에 따라 기존 영상별 시청기록 저장 API를 호출한다. 승인된 기능 범위를 유지하며, 사용자 요청에 따라 기존 3개 task를 테스트 작성·소스 구현 및 테스트 실행의 3쌍으로 재구성한다.

## 범위와 비목표

- GET /me/watch-history?page=1을 추가한다. Access JWT 사용자 본인의 user_watch_progress만 조회하며 is_completed나 position_ms로 조회 대상을 제한하지 않는다. STARTED로 생성된 position_ms=0 기록도 포함한다.
- 페이지 크기는 30이다. 기존 공통 parsePage, getPageWindow, createPageResponse를 재사용하고 items/page/hasNext를 반환한다. 최근 last_played_at 내림차순, 동률이면 video_id 내림차순이다. 한 사용자·영상의 기존 복합 기본키를 사용해 같은 영상을 한 항목으로 조회한다.
- 현재 공개된 DRAMA/PREVIEW와 EPISODE/FULL 영상만 반환한다. 작품과 본편 회차의 PUBLISHED 상태 및 UTC 공개 시점 조건을 페이지 조회 전에 적용한다. 프리뷰·다른 FULL 영상의 기록을 대표 회차 기록에 합산하지 않는다.
- 항목은 저장 영상 목록과 같은 videoUuid/contentType/dramaUuid/dramaTitle/imageUrl/durationMs/episodeUuid/episodeNumber/episodeTitle 정보를 갖는다. savedAt 대신 ISO 8601 UTC lastPlayedAt을 사용한다. 목록에는 진행률·완료 배지·시청 시각 UI를 추가하지 않는다. 위치·완료 값을 새 목록 응답에 불필요하게 추가하지 않는다.
- imageUrl은 기존 저장 목록처럼 작품의 POSTER_LANDSCAPE, POSTER 순으로 선택한다. 목록 조회는 구매 권한을 부여하거나 변경하지 않는다. 기존 본편·미리보기 이동과 재생 시점 권한 검사를 유지한다.
- LibraryScreen의 저장한 작품 카드 레이아웃·길이 표시·본편/미리보기 이동을 그대로 시청 기록에도 사용한다. 탭 전환·포커스 복귀 시 첫 페이지를 새로 조회하며 이전 탭·세션 응답을 버린다. 추가 페이지 재시도·중복 방지·비로그인·빈 목록·오류 표시를 구현한다.
- 추천과 미리보기 화면은 기존 createWatchProgressTracker와 PUT /me/videos/:videoUuid/watch-progress를 사용한다. 실제로 재생 시간이 진행될 때 STARTED를, 실제 진행 중 서버 영상 길이의 2/3 이상에 도달할 때 COMPLETED를 전송한다. 추천은 현재 선택되어 실제 재생 중인 영상만 기록한다.
- 익명·세션 복원 중·사전 로딩·일시정지·버퍼링·화면 이탈·탐색만으로는 기록하지 않는다. 화면/영상/세션의 수명이 끝나면 tracker와 리스너·예약된 재시도를 정리한다. 영상 재방문 시 기존 행의 lastPlayedAt이 갱신되고 완료 상태는 기존 저장 API 규칙에 따라 보존된다.
- 기록 삭제, 이어보기 위치 복원, DB 스키마·migration·seed 변경, 기존 기록 저장 endpoint/body 변경, 전역 상태·공통 인증·오류·페이징 모듈 리팩토링은 범위 밖이다. web-prototype/은 읽기·계획·수정·검증 대상에서 제외한다.


## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 시청기록 API 테스트 작성 | 전용 Postman·fixture·실행기·내부 테스트·테스트 README | 계약·격리·페이징·실패 정리 시나리오 작성과 정적 검사 |
| 2 | 시청기록 API 구현·검증 | back/src/playback/watchHistory*.ts, playback.module.ts, API·아키텍처 문서 | 조회 구현 후 task-1의 단위·선택/전체 API 검사 실행 |
| 3 | 추천·미리보기 테스트 작성 | recommendationPreviewBuffer.test.ts, savedVideoScreens.test.ts | 실제 진행·서버 길이·정확한 UUID·사전 로딩 배제·수명 정리 검사 작성 |
| 4 | 추천·미리보기 구현·검증 | RecommendationScreen.tsx, playbackScreen_preview.tsx | tracker 연결 후 task-3의 테스트와 기존 tracker·본편 회귀 실행 |
| 5 | 보관함 테스트 작성 | watchHistory.test.ts, libraryScreen.test.ts, savedVideos.test.ts | 조회 인증·탭/계정 수명·카드/이동·재시도 검사를 작성 |
| 6 | 보관함 구현·검증 | playbackResponses.ts, watchHistory.ts, savedVideos.ts, LibraryScreen.tsx | 조회·보관함 연결 후 task-5의 테스트와 최종 프론트 typecheck 실행 |

정확한 repository-relative 수정 파일·depends_on·checks는 index.json과 각 task 문서에 동일하게 선언한다. 테스트·fixture·실행기 파일은 작성 task가, 제품 코드·제품 API 문서는 소스 task가 소유하며 수정 목록은 서로 겹치지 않는다. 실행만 하는 테스트 파일을 소스 task의 files에 추가하지 않는다. 각 worker는 담당 역할의 계약·파일·직접 의존 구간을 읽으며, 소스 worker의 테스트 내부는 실패 시 참고 목록으로 둔다.

## 실행 순서 및 병렬 작업

- 선행 상태: plan-49-video-watch-progress가 completed이며 영상별 저장 API와 video_id 스키마가 존재한다. dev에서 계획만 수정하며 새 branch/worktree나 제품 구현은 만들지 않는다.
- task-1·task-3·task-5는 선행 의존성이 없고 병렬 작성할 수 있다. 수정 파일이 백엔드 테스트·재생 화면 테스트·보관함 테스트로 분리된다. 승인된 계약을 사용하므로 아직 없는 제품 모듈이나 API 문서의 생성을 기다리지 않는다.
- 작성 task는 node --check와 컬렉션 JSON 파싱만 수행한다. TypeScript 의미 검사·기능 테스트·예상 실패 확인·API 요청·DB fixture 준비/정리는 실행하지 않는다. 계획된 새 모듈/타입을 참조하는 테스트도 문법만 검사한다. 작성 완료와 기능 검증 통과를 구분한다.
- task-2는 task-1 완료 후 API·문서를 구현하고 관련 단위·선택 API·무인자 전체 API 검사를 실행한다. API 서버/DB를 사용하는 task는 task-2뿐이다. fixture 준비부터 정리 완료까지 exclusive content lock과 실행별 임시 컬렉션/환경을 유지한다. ARCHITECTURE.md 수정도 task-2만 맡는다.
- task-4는 task-3 완료 후 두 재생 화면을 구현하고 선택 테스트를 실행한다. 기존 PUT이 있으므로 task-2와 독립적이다. fake player/HTTP/세션만 사용하며 실제 DB/미디어는 사용하지 않는다.
- task-5의 작성은 task-2/task-4의 구현·검증과도 병렬 실행할 수 있다. front/scripts/test-front.cjs는 선택한 파일만 컴파일하고 실행별 임시 폴더를 사용하므로 task-4가 미구현 보관함 모듈을 참조하는 task-5 테스트를 로드하지 않는다. 수정 파일·출력·fixture가 독립적이다.
- task-6은 task-2·task-4·task-5 완료 후 실행한다. 확정된 조회 API 문서를 소비해 보관함을 구현하고 작성된 선택 테스트와 전체 프론트 typecheck를 실행한다. 미완성 재생 화면/테스트를 전체 타입 검사에서 읽지 않도록 task-4를 기다린다.
- 여섯 task 모두 2뎁스 반복 작업 위임을 허용하지 않는다. 각 역할에 API/fixture·재생 수명·목록/요청 수명의 별도 판단이 필요하다. 담당 harness_worker가 통합·역할별 검사·최종 결과 보고를 맡고 하위 슬롯은 0개다.
- 본 계획의 최대 동시 실행은 worker 3명과 메인 1명, 총 4명이다. 프로젝트의 메인 제외 서브에이전트 5개 한도 안에서 운영하며, task-6은 단독 실행한다.

## 작성과 실행의 완료 기준

- task-1·task-3·task-5: 테스트/지원 코드 작성, 정적 checks 통과, 계약·시나리오 검토 결과와 실제 실행 담당 task를 완료 요약에 기록한다. 동작 테스트를 실행하거나 기능 통과로 보고하지 않는다.
- task-2·task-4·task-6: 선행 테스트 task가 끝난 뒤 소스를 구현하고 자신의 checks를 모두 실행·통과해야 완료한다. 테스트를 임의 수정하거나 assertion을 약화하지 않는다. 테스트 결함은 근거와 함께 별도 수정 범위로 보고한다.
- 기존 단위/API/프론트 회귀 검사 명령과 기능 시나리오는 그대로 유지한다. 선택/전체 API 검증은 task-2, 재생 화면 검증은 task-4, 보관함 검증 및 최종 프론트 typecheck는 task-6이 담당한다.

## 검증과 영향 범위

| 기능/변경 | 검증 | 선택 근거 |
| --- | --- | --- |
| 조회 계약·미완료 포함·페이징·공개 조건·본인 격리 | watch-history Postman suite | 실제 GET 응답과 PUT 기록의 연결을 현재 개발 서버/실제 MySQL에서 확인 |
| 저장 API와 기존 저장 목록 영향 | watch-progress, saved-videos suites | 같은 playback 모듈·공개 조건·영상별 기록을 사용하는 실제 소비 경로 |
| suite 등록 및 fixture 정리 | suiteSelection.spec.ts, fixtureIsolation.spec.ts, watchHistoryFixtures.spec.ts | HTTP 밖의 선택 규칙·실패 시 소유 자원 정리/격리를 최소 단위 테스트로 검사 |
| 테스트 실행기 등록/분기 변경 | 선택 suite 실행 및 무인자 test:api 전체 실행 | 기존 8개 suite의 기본 실행·fixture 분기가 영향받으므로 전체 9개 suite 회귀 검사 필요 |
| 추천·미리보기 재생 저장 | recommendationPreviewBuffer.test.ts, savedVideoScreens.test.ts | 실제 화면 로직을 가짜 player 이벤트로 구동하고 포커스·스와이프·버퍼 재사용·기존 저장 버튼 유지 확인 |
| 공통 tracker와 본편 회귀 | watchProgress.test.ts, playbackScreenEpisode.test.ts | tracker를 변경하지 않고도 같은 STARTED/COMPLETED 규칙과 본편 동작을 유지하는지 확인 |
| 보관함 조회·전환·카드 이동 | watchHistory.test.ts, libraryScreen.test.ts, savedVideos.test.ts | 필수 인증 클라이언트, 탭별 API 선택, 추가 로딩 재시도, 같은 이동 함수의 실제 소비 검증 |
| 프론트 타입 계약 | front typecheck | task-2와 task-4 완료 후 task-6에서 새 응답 타입·이동 인자·화면 prop 연결 전체 검사 |

정확한 실행 명령은 각 task 문서 및 index.json에 선언한다. 일반 task에서 무관한 전체 lint/build/export를 반복하지 않는다. task-2의 전체 API 실행만 실행기 변경에 따른 의도적인 전체 검증이다. 최종 finish-plan은 별도 명시 호출 시 변경 제품의 전체 검증을 수행한다.

API 검증 전에 http://localhost:3000으로 HTTP 요청해 연결과 현재 코드 반영을 확인한다. 반영 여부를 확인할 수 없으면 사용자에게 확인한다. 연결 실패·필수 데이터 부족·assertion 실패·cleanup 실패는 검증 실패다. 서버가 없으면 자동 시작하거나 다른 포트로 우회하지 않고 npm --prefix back run start:dev 실행을 안내한다. 브라우저 확인이 필요하면 기존 http://localhost:8081을 사용하며 서버가 없으면 npm --prefix front run start -- --port 8081을 안내한다.

watch-history의 관리형 fixture는 실행별 새 사용자와 새 콘텐츠·시청기록만 소유하며 기존 콘텐츠 상태를 수정하지 않는다. 동률 정렬용 시각 조정도 자신의 행만 대상으로 한다. 외부 API_TEST_ENVIRONMENT_FILE 모드는 caller가 사전 준비한 fixture를 사용하며 DB 준비/정리를 수행하지 않는다. 비밀 값·토큰·서명 URL을 문서나 컬렉션에 기록하지 않는다.


## 계획 검증 결과

- 기능 범위는 기존 승인 내용과 동일하며 사용자 요청으로 task 책임·의존성·검사 시점만 재구성한다. 상태는 draft/pending을 유지하고 제품 구현이나 worker 실행은 수행하지 않는다.
- 기존 계획의 버전별 공식 문서 링크를 해당 프론트 작성/구현 task에 유지한다.
- 여섯 task 문서를 다시 열어 역할·정확한 파일·checks·완료 조건, 소스와 테스트의 핵심 코드 예시, 역할별 필수/조건부 읽기, 파일·출력·fixture 독립성과 하위 위임 금지를 검토했다.
- 기존 수정 대상 25개 파일과 기능/회귀 검사 명령 6개를 보존했고 task 간 수정 파일 중복은 없다. 각 task 문서의 파일/검사 목록이 index.json과 일치하며 실제 기능 검사 명령은 대응 소스 task에 배정됐음을 확인했다.
- node tools/harness/cli.mjs validate --plan plan-50-watch-history-library가 valid=true, 종료 코드 0으로 통과했다. 기존 TypeScript 테스트의 node --check 지원과 선택 실행기의 파일 격리를 확인했다. 제품 구현·기능 테스트·API/DB 검증은 실행하지 않았다.
