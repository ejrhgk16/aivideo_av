# plan-43-front-saved-videos

## 목표

기존 저장 API를 프론트 보관함과 저장 버튼에 연결한다. 저장 목록에서 EPISODE는 에피소드 재생 페이지, PREVIEW는 해당 프리뷰 재생 페이지로 이동한다. 영상 조회에 JWT 사용자 기준 저장 여부를 함께 조인해 재접속·화면 이동 후에도 서버의 저장 상태를 표시한다.

사용자는 작업 범위와 아래 3개 task의 정확한 파일·의존성·검증 구성을 각각 승인했다. 이번 계획 생성에서는 제품 코드 변경, worker 실행, 제품 검증, Git 명령을 수행하지 않는다.

## 범위와 가정

- 기존 PUT /me/saved-videos/:videoUuid, DELETE /me/saved-videos/:videoUuid, GET /me/saved-videos?page=1을 재사용한다.
- 저장 목록에 카드 표시와 이동용 정보를 추가한다. 작품 목록·상세·컬렉션의 영상 정보와 본편·프리뷰 재생 응답에 isSaved를 추가한다.
- 사용자 식별은 Access JWT만 사용한다. 작품 목록·컬렉션·프리뷰 재생에도 선택 인증을 적용한다. 익명 조회는 유지하며 익명의 isSaved는 false다. 잘못된 인증 헤더는 기존 선택 인증과 동일하게 401이다.
- 본편 저장의 키는 회차 UUID가 아닌 실제 재생 영상 UUID다. 영상 선택은 기존 최저 displayOrder 규칙을 유지한다.
- 홈·추천은 조회 응답의 첫 프리뷰를 저장한다. 대상 프리뷰가 없으면 비활성화한다. 독립 프리뷰 재생 화면에서는 경로로 받은 정확한 videoId를 사용한다.
- 공통 Provider에서 계정별 영상 저장 여부와 요청 진행 상태를 공유한다. API 성공 후 상태 변경, 중복 요청 방지, 계정 전환·로그아웃 때 상태 분리, 이전 응답 무시를 처리한다.
- 보관함은 기존 30개 페이지와 공개 조건·사용자 격리·저장 시각 및 동률 영상 ID 정렬을 유지한다. 저장은 유료 본편 재생 권한을 부여하지 않는다.

## 비목표

- 시청 기록 탭 구현, 홈 재생 버튼 연결, 새 재생 경로 도입.
- DB 스키마·마이그레이션·시드 변경, API 테스트 runner 변경, DB 초기화.
- 새 상태 관리·목록 라이브러리 도입, 무관한 코드·스타일 정리.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 백엔드 저장 목록·저장 여부 응답 확장 | `back/src/playback/savedVideoService.ts`, `back/src/content/publicCatalogController.ts`, `back/src/content/publicCatalogService.ts`, `back/src/programming/publicCollectionController.ts`, `back/src/programming/publicCollectionService.ts`, `back/src/programming/programming.module.ts`, `back/test/unit/playback/savedVideoService.spec.ts`, `back/test/unit/content/publicCatalogService.spec.ts`, `back/test/unit/programming/publicCollectionService.spec.ts`, `back/test/api/public.postman_collection.json`, `_docs/api/04-playback/saved-videos.md`, `_docs/api/04-playback/episodes.md`, `_docs/api/02-content/dramas.md`, `_docs/api/03-programming/collections.md`, `_docs/api/00-overview/authentication.md` | 카드·이동 정보 및 저장 여부 JOIN, 선택 인증·문서·HTTP 검증 |
| 2 | 프론트 공통 저장 API·상태 구성 | `front/src/features/playback/savedVideos.ts`, `front/src/features/playback/savedVideoState.ts`, `front/src/features/playback/SavedVideosProvider.tsx`, `front/src/features/playback/episodePlayback.ts`, `front/src/features/playback/previewPlayback.ts`, `front/src/features/drama/dramaContent.ts`, `front/src/features/home/homeContent.ts`, `front/src/app/_layout.tsx`, `front/tests/unit/savedVideos.test.ts`, `front/tests/unit/savedVideoState.test.ts`, `front/tests/unit/episodePlayback.test.ts`, `front/tests/unit/previewPlayback.test.ts`, `front/tests/unit/dramaContent.test.ts`, `front/tests/unit/homeContent.test.ts`, `front/scripts/test-front.cjs`, `_docs/ARCHITECTURE.md` | 공통 API·종류별 이동·계정별 상태와 조회 타입·인증 모드 |
| 3 | 저장 페이지·전체 저장 버튼 연결 | `front/src/screens/LibraryScreen.tsx`, `front/src/screens/playbackScreen_episode.tsx`, `front/src/screens/playbackScreen_preview.tsx`, `front/src/screens/RecommendationScreen.tsx`, `front/src/screens/HomeScreen.tsx`, `front/tests/unit/libraryScreen.test.ts`, `front/tests/unit/savedVideoScreens.test.ts`, `front/tests/unit/playbackScreenEpisode.test.ts`, `front/tests/unit/recommendationPreviewBuffer.test.ts`, `front/scripts/test-front.cjs` | 저장 목록·추가 조회·종류별 재생 이동 및 모든 저장 버튼 연결 |

정확한 변경 허용 목록과 checks는 이 폴더의 index.json과 각 task 문서에 동일하게 기록한다.

## 실행 순서 및 병렬 작업

- task-1은 depends_on: []다. 선행 의존성은 없지만 이번 계획에서 독립적으로 병렬 실행할 task는 없다.
- task-2는 depends_on: ["task-1"]이다. 백엔드의 확정된 추가 응답과 선택 인증을 프론트 타입·API 함수가 소비하므로 순차 실행한다.
- task-3은 depends_on: ["task-2"]이다. 공통 API·Provider·이동 함수를 사용하며 front/scripts/test-front.cjs도 함께 변경하므로 순차 실행한다.
- 실행 순서는 task-1 → task-2 → task-3이며 병렬 실행 대상은 없다. 다른 계획이 같은 파일을 실행 중이면 해당 작업 종료를 확인하고 최신 변경을 읽는다. 다른 작업의 변경을 되돌리지 않는다.
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

- API 검증은 기존 http://localhost:3000의 HTTP 응답과 변경 코드 반영을 먼저 확인한 뒤 실제 개발 MySQL과 기존 Postman fixture를 사용한다. 영상 URL의 S3 객체 다운로드는 검증 범위에 넣지 않는다.
- 조회 검증을 위한 DB 초기화·시드 쓰기는 하지 않는다. 저장·해제 회귀 검증은 기존 runner가 생성·정리하는 격리 fixture와 실제 PUT·DELETE를 사용한다. 기존 저장·지갑·권한을 초기화하지 않는다.
- 서버 연결 실패나 필수 데이터 부족은 검증 실패다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 백엔드가 없으면 npm --prefix back run start:dev, 프론트 서버가 필요한 수동 검증에서 없으면 npm --prefix front run start -- --port 8081 실행을 안내한다.
- 제품 테스트는 task 실행 시 수행한다. 계획 생성에서는 모든 task Markdown의 핵심 코드·파일 범위·완료 조건을 재검토한 뒤 node tools/harness/cli.mjs validate --plan plan-43-front-saved-videos를 실행한다.

## 현재 상태

- 범위 승인 완료, task 구성 승인 완료.
- 계획 생성 단계이며 모든 task는 pending이다.
- 실행 상태의 단일 기준은 이 폴더의 index.json이다.
