# plan-43-front-saved-videos

## 목표

기존 저장 API를 프론트 보관함과 저장 버튼에 연결한다. 저장 목록에서 EPISODE는 에피소드 재생 페이지, PREVIEW는 해당 프리뷰 재생 페이지로 이동한다. 영상 조회에 JWT 사용자 기준 저장 여부를 함께 조인해 재접속·화면 이동 후에도 서버의 저장 상태를 표시한다.

사용자는 최초 작업 범위와 task-1~3의 정확한 파일·의존성·검증 구성을 각각 승인했다. 이후 보관함 표시 개선을 이 계획의 task-4로 추가하도록 범위와 task 구성을 각각 승인했다. 계획 문서 작성에서는 제품 코드 변경, worker 실행, 제품 검증, Git 명령을 수행하지 않는다.

## 범위와 가정

- 기존 PUT /me/saved-videos/:videoUuid, DELETE /me/saved-videos/:videoUuid, GET /me/saved-videos?page=1을 재사용한다.
- 저장 목록에 카드 표시와 이동용 정보를 추가한다. 작품 목록·상세·컬렉션의 영상 정보와 본편·프리뷰 재생 응답에 isSaved를 추가한다.
- 사용자 식별은 Access JWT만 사용한다. 작품 목록·컬렉션·프리뷰 재생에도 선택 인증을 적용한다. 익명 조회는 유지하며 익명의 isSaved는 false다. 잘못된 인증 헤더는 기존 선택 인증과 동일하게 401이다.
- 본편 저장의 키는 회차 UUID가 아닌 실제 재생 영상 UUID다. 영상 선택은 기존 최저 displayOrder 규칙을 유지한다.
- 홈·추천은 조회 응답의 첫 프리뷰를 저장한다. 대상 프리뷰가 없으면 비활성화한다. 독립 프리뷰 재생 화면에서는 경로로 받은 정확한 videoId를 사용한다.
- 공통 Provider에서 계정별 영상 저장 여부와 요청 진행 상태를 공유한다. API 성공 후 상태 변경, 중복 요청 방지, 계정 전환·로그아웃 때 상태 분리, 이전 응답 무시를 처리한다.
- 보관함은 기존 30개 페이지와 공개 조건·사용자 격리·저장 시각 및 동률 영상 ID 정렬을 유지한다. 저장은 유료 본편 재생 권한을 부여하지 않는다.
- task-4: 보관함 이미지 크기는 메인 TOP3와 같은 112×63으로 맞춘다. PREVIEW·EPISODE 모두 해당 드라마의 POSTER_LANDSCAPE를 우선하고 없으면 POSTER를 사용하며, 회차 커버는 사용하지 않는다. 기존 drama JOIN과 이미지 서브쿼리를 재사용한다.
- task-4: 카드에는 드라마명, 미리보기 또는 에피소드 n화, 영상시간을 차례로 표시한다. 회차 제목은 제외하고, 1분 미만은 15초처럼 초로 표시하며 1분 30초·2분처럼 분과 초를 표시한다. API의 실제 영상 durationMs를 사용한다.

## 비목표

- 시청 기록 탭 구현, 홈 재생 버튼 연결, 새 재생 경로 도입.
- DB 스키마·마이그레이션·시드 변경, API 테스트 runner 변경, DB 초기화.
- 새 상태 관리·목록 라이브러리 도입, 무관한 코드·스타일 정리.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 백엔드 저장 목록·저장 여부 응답 확장 | `back/src/playback/savedVideoService.ts`, `back/src/content/publicCatalogController.ts`, `back/src/content/publicCatalogService.ts`, `back/src/programming/publicCollectionController.ts`, `back/src/programming/publicCollectionService.ts`, `back/src/programming/programming.module.ts`, `back/test/unit/playback/savedVideoService.spec.ts`, `back/test/unit/content/publicCatalogService.spec.ts`, `back/test/unit/programming/publicCollectionService.spec.ts`, `back/test/api/public.postman_collection.json`, `_docs/api/04-playback/saved-videos.md`, `_docs/api/04-playback/episodes.md`, `_docs/api/02-content/dramas.md`, `_docs/api/03-programming/collections.md`, `_docs/api/00-overview/authentication.md` | 카드·이동 정보 및 저장 여부 JOIN, 선택 인증·문서·HTTP 검증 |
| 2 | 프론트 공통 저장 API·상태 구성 | `front/src/features/playback/savedVideos.ts`, `front/src/features/playback/savedVideoState.ts`, `front/src/features/playback/SavedVideosProvider.tsx`, `front/src/features/playback/episodePlayback.ts`, `front/src/features/playback/previewPlayback.ts`, `front/src/features/drama/dramaContent.ts`, `front/src/features/home/homeContent.ts`, `front/src/app/_layout.tsx`, `front/tests/unit/savedVideos.test.ts`, `front/tests/unit/savedVideoState.test.ts`, `front/tests/unit/episodePlayback.test.ts`, `front/tests/unit/previewPlayback.test.ts`, `front/tests/unit/dramaContent.test.ts`, `front/tests/unit/homeContent.test.ts`, `front/tests/unit/sessionExpiredDialog.test.ts`, `front/scripts/test-front.cjs`, `_docs/ARCHITECTURE.md` | 공통 API·종류별 이동·계정별 상태와 조회 타입·인증 모드 |
| 3 | 저장 페이지·전체 저장 버튼 연결 | `front/src/screens/LibraryScreen.tsx`, `front/src/screens/playbackScreen_episode.tsx`, `front/src/screens/playbackScreen_preview.tsx`, `front/src/screens/RecommendationScreen.tsx`, `front/src/screens/HomeScreen.tsx`, `front/tests/unit/libraryScreen.test.ts`, `front/tests/unit/savedVideoScreens.test.ts`, `front/tests/unit/playbackScreenEpisode.test.ts`, `front/tests/unit/recommendationPreviewBuffer.test.ts`, `front/scripts/test-front.cjs` | 저장 목록·추가 조회·종류별 재생 이동 및 모든 저장 버튼 연결 |
| 4 | 보관함 이미지·문구·영상시간 수정 | `back/src/playback/savedVideoService.ts`, `_docs/api/04-playback/saved-videos.md`, `back/test/api/public.postman_collection.json`, `front/src/screens/LibraryScreen.tsx`, `front/tests/unit/libraryScreen.test.ts` | 드라마 포스터 선택·112×63 이미지·종류별 문구·분/초 시간 표시와 회귀 검증 |

정확한 변경 허용 목록과 checks는 이 폴더의 index.json과 각 task 문서에 동일하게 기록한다.

## 실행 순서 및 병렬 작업

- task-1은 depends_on: []다. 선행 의존성은 없지만 이번 계획에서 독립적으로 병렬 실행할 task는 없다.
- task-2는 depends_on: ["task-1"]이다. 백엔드의 확정된 추가 응답과 선택 인증을 프론트 타입·API 함수가 소비하므로 순차 실행한다.
- task-3은 depends_on: ["task-2"]이다. 공통 API·Provider·이동 함수를 사용하며 front/scripts/test-front.cjs도 함께 변경하므로 순차 실행한다.
- task-4는 depends_on: ["task-3"]이다. task-3의 보관함 구현과 같은 화면·테스트를 수정하고 task-1의 저장 목록 API를 사용하므로 기존 구현 완료 후 실행한다. task-1~3의 completed 상태와 실행 이력은 유지하며 새 task-4만 pending으로 추가한다.
- 실행 순서는 task-1 → task-2 → task-3 → task-4이며 병렬 실행 대상은 없다. 다른 계획이 같은 파일을 실행 중이면 해당 작업 종료를 확인하고 최신 변경을 읽는다. 다른 작업의 변경을 되돌리지 않는다.
- plan-44 task-2, plan-45 task-3과는 back/test/api/public.postman_collection.json이 겹치므로 동시 실행하지 않는다. plan-44가 컬렉션 분리를 먼저 완료해 저장 테스트 위치가 바뀌면 실행 전 이 task의 정확한 files와 지시를 현재 구조로 갱신하고 validate한다. 삭제되거나 이동한 컬렉션을 다시 만들거나 다른 계획의 변경을 되돌리지 않는다. 별도 계획과 전체 API 테스트·프론트 export를 겹쳐 실행하지 않는다.
- 각 task는 선언된 파일 범위 안에서 apply_patch로 수정하고 검증한 뒤 다음 task를 시작한다. 작업은 dev에서만 수행하며 branch·worktree를 만들지 않는다.

## 검증

task-1:

~~~text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
~~~

task-2와 task-3 각각:

~~~text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
~~~

task-4:

~~~text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
~~~

- task-4의 Postman 검증은 기존 runner가 소유권과 정리를 관리하는 PREVIEW 및 임시 유료 FULL fixture를 재사용해 저장 목록 imageUrl과 드라마 상세의 포스터를 비교한다. 기존 FULL의 저장 행을 새로 만들거나 runner를 변경하지 않는다. 프론트는 실제 카드 렌더링을 통해 종류별 문구·이미지 크기·짧은 영상의 초 표시를 검증한다.
- API 검증은 기존 http://localhost:3000의 HTTP 응답과 변경 코드 반영을 먼저 확인한 뒤 실제 개발 MySQL과 기존 Postman fixture를 사용한다. 영상 URL의 S3 객체 다운로드는 검증 범위에 넣지 않는다.
- 조회 검증을 위한 DB 초기화·시드 쓰기는 하지 않는다. 저장·해제 회귀 검증은 기존 runner가 생성·정리하는 격리 fixture와 실제 PUT·DELETE를 사용한다. 기존 저장·지갑·권한을 초기화하지 않는다.
- 서버 연결 실패나 필수 데이터 부족은 검증 실패다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 백엔드가 없으면 npm --prefix back run start:dev, 프론트 서버가 필요한 수동 검증에서 없으면 npm --prefix front run start -- --port 8081 실행을 안내한다.
- 제품 테스트는 task 실행 시 수행한다. 계획 생성에서는 모든 task Markdown의 핵심 코드·파일 범위·완료 조건을 재검토한 뒤 node tools/harness/cli.mjs validate --plan plan-43-front-saved-videos를 실행한다.

## 현재 상태

- 범위 승인 완료, task 구성 승인 완료.
- task-1~4가 모두 completed다. 기존 task-1~3의 실행 이력을 유지하며 추가 task-4 실행도 완료했다. 최종 Harness next 결과는 done이고 plan 카탈로그 상태도 completed다.
- task 문서 3개를 재열람해 핵심 코드·완료 조건을 검토했고, 생성 시 파일 목록(15/16/10개)과 checks가 index.json에 일치함을 확인했다.
- task-2 실행 중 root layout의 새 Provider import에 필요한 기존 sessionExpiredDialog.test.ts mock 누락을 발견해 해당 파일만 task-2 범위에 추가했다(총 17개). 기존 세션 만료 assertion은 유지하며 제품 기능 범위는 동일하다.
- 계획 생성 시 node tools/harness/cli.mjs validate --plan plan-43-front-saved-videos가 통과했다(valid: true).
- task-1: 백엔드 lint·test·build 통과. 단위 테스트 110개, 실제 개발 API/MySQL 대상 Postman 요청 293개·assertion 343개, 실패 0개. 저장·해제 전후 조회의 isSaved와 익명·다른 사용자 격리를 검증했다.
- task-2: 프론트 typecheck·test(133개)·export(Web/iOS/Android) 통과. 공통 API·계정별 저장 상태·Provider와 조회 계약을 연결했다.
- task-3: 프론트 typecheck·test(140개)·export(Web/iOS/Android) 통과. 보관함의 종류별 이동·추가 페이지·오류 재시도·늦은 계정 응답 차단, 정확한 프리뷰 저장 대상, 홈 저장·해제, 포커스 복귀 시 재생 유지와 기존 추천 입력 동작을 검증했다.
- 최초 세 task 실행 후 git diff --check가 통과했다. task-4에서도 변경 범위의 git diff --check가 통과했다. $harness에서는 commit·push·finish를 실행하지 않았으며, 다음 마무리 단계는 사용자의 명시적 $finish-plan 호출이다.
- task-4의 범위와 정확한 파일 5개·선행 task-3·검증 명령 6개는 두 단계 승인을 받았다. 이번 추가 계획 작성에서는 제품 코드 변경이나 제품 검증을 실행하지 않는다.
- 추가한 task-4 문서를 재열람해 쿼리·카드·시간 표시·HTTP 검증 코드와 완료 조건을 검토했고, index.json의 파일 5개·checks 6개·의존성과 일치함을 확인했다. 추가 후 node tools/harness/cli.mjs validate --plan plan-43-front-saved-videos가 통과했다(valid: true).
- task-4: 사용자 명시적 $harness 호출로 실행했다. 드라마 포스터 선택과 112×63 카드·종류별 문구·분/초 시간 표시를 반영했다. 백엔드 lint·test(단위 110개, 실제 API 요청 301개·assertion 346개·실패 0개)·build, 프론트 typecheck·test(141개)·export(Web/iOS/Android)가 모두 통과했다. Postman JSON 파싱도 통과했다.
- task-4 검증 한계: 실제 PREVIEW와 runner 소유 임시 FULL의 드라마 포스터 일치는 HTTP로 검증했다. 기존 fixture에 가로 포스터 없음·모든 포스터 없음 조건이 없어 해당 fallback 분기는 쿼리 우선순위와 문서 일치로 확인했다. 해당 분기의 실데이터 HTTP 검증은 수행하지 않았다.
- 실행 상태의 단일 기준은 이 폴더의 index.json이다.
