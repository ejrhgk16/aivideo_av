# plan-35-episode-watch-progress

## 목표

로그인 사용자의 본편 영상이 실제로 재생되기 시작하면 `user_watch_progress`를 생성하거나 마지막 재생 시각을 갱신한다. 현재 위치가 영상 길이의 2/3 이상에서 재생되면 위치와 완료 상태를 저장한다. 앞으로 시간이동한 위치도 인정하며, 완료 상태는 뒤로 이동하거나 다시 재생해도 해제하지 않는다.

범위와 태스크 구성은 사용자에게 각각 승인받았다. 영향을 받는 레이어는 본편 프론트 플레이어, JWT 사용자 귀속 저장 API, MySQL 기존 테이블, API 문서와 테스트다. 기존 `(user_id, episode_id)` 복합 키와 컬럼을 사용하고 마이그레이션하지 않는다. 프론트 테스트 실행기가 파일 목록을 명시하므로 새 테스트 등록을 위한 목록 수정도 포함한다.

### 승인된 동작과 가정

- 로그인 사용자만 저장한다. 비로그인 무료 재생은 그대로 허용한다.
- 화면에서 회차의 실제 재생 시작은 1회, 2/3 도달은 1회만 저장한다. 재개·슬라이더 조작마다 요청하지 않는다.
- 단순 play 호출이나 로딩 완료만으로 저장하지 않는다. 재생 중 시간이 실제 진행된 것을 관찰한다. 시간이동 자체로는 저장하지 않고 이동 후 재생 진행을 확인한다.
- 요청 중에는 중복을 차단하고 성공 후 해당 이벤트를 다시 전송하지 않는다. 시작과 완료 요청을 직렬 처리한다.
- 네트워크 실패·5xx는 이벤트당 2초 뒤 1회만 재시도한다. 4xx·세션 변경은 추가 재시도하지 않는다. 공통 HTTP 클라이언트의 401 갱신 1회는 기존 정책 그대로다.
- 정상적인 저장 호출은 화면 진입당 최대 2회다. 제한된 재시도와 공통 인증 재전송은 별도다. 고의적인 직접 API 호출을 제한하는 서버 rate limit은 범위 밖이다.
- 기준 길이는 재생 URL API가 반환한 FULL 영상 `durationMs`이며 서버는 같은 영상 선택 규칙으로 검증한다. 프론트는 현재 초를 정수 ms로 변환하고 해당 길이 안으로 제한한다.
- `is_completed`는 이번 정책에서 2/3 도달 완료를 뜻한다. 실제 시청 구간 누적이나 끝까지 재생했다는 증명은 아니다.
- 기존 기록이 있으면 시작 요청은 위치·완료를 보존하고 시각만 갱신한다. 완료 요청은 위치를 저장하고 완료를 true로 유지한다. 중복 요청 시 행은 늘지 않으며 기록 시각은 서버의 수신 시각으로 갱신될 수 있다.
- 저장 실패로 영상 재생을 중단하지 않는다. 재시도 소진 후 이벤트마다 재요청하지 않으며, 다음 화면 진입에서 다시 시도할 수 있다.

비목표: 미리보기, 이어보기, 종료·시간이동·주기적 위치 저장, 보관함 연결, 고유 시청 구간 집계, 서버 요청 제한, DB 스키마 변경, 기존 테이블 정의서의 별도 정비, 구매·잔액 변경.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | backend-watch-progress-api | `back/src/app.module.ts`, `back/src/playback/playback.module.ts`, `back/src/playback/watchProgressController.ts`, `back/src/playback/watchProgressService.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/04-playback/README.md`, `_docs/api/04-playback/watch-progress.md`, `_docs/ARCHITECTURE.md` | JWT 필수 PUT API, 공개·권한·위치 검증, 원자적 저장, 문서와 실제 HTTP 검증 |
| 2 | front-watch-progress-events | `front/src/screens/playbackScreen_episode.tsx`, `front/src/features/playback/watchProgress.ts`, `front/tests/unit/watchProgress.test.ts`, `front/tests/unit/playbackScreenEpisode.test.ts`, `front/scripts/test-front.cjs` | 실제 재생 이벤트 연결, 시작·완료 중복 차단, 제한된 재시도와 취소, 동작 테스트 |
| 3 | backend-watch-progress-utc | `back/src/playback/watchProgressService.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/04-playback/watch-progress.md` | 조회를 TypeORM QueryBuilder로 전환, 원자적 upsert 유지, DB UTC 통일과 HTTP 검증 보강 |

리뷰 후 사용자 요청으로 task-3을 추가한다. 드라이버의 `timezone: 'Z'`는 유지하고, 새 저장 API의 SQL을 `UTC_TIMESTAMP(3)` 기준으로 맞춘다. task-1 문서의 `CURRENT_TIMESTAMP(3)` 예시는 task-3의 UTC 지시로 대체된다. 기존 데이터 보정·DB 전역/세션 설정 변경·다른 도메인 시간 처리 변경은 포함하지 않는다.

추가 사용자 요청에 따라 task-3에서 직접 SELECT를 TypeORM QueryBuilder로 전환한다. 저장은 기존 단일 원자적 upsert SQL을 유지해 동시 요청의 완료 상태·위치 보존을 지킨다. 이 조회 방식 변경도 task-1의 SELECT 예시보다 우선한다.

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성 없이 실행한다. 파일은 task-2와 겹치지 않지만 계약과 실제 API를 먼저 확정하기 위해 병렬 실행하지 않는다.
- `task-2`는 `task-1` 완료 후 실행한다(`depends_on: ["task-1"]`). 확정된 API 계약과 서버에 연결해 재생 이벤트를 검증한다.
- `task-3`은 `task-2` 완료 후 실행한다(`depends_on: ["task-2"]`). 기존 task의 완료 기록은 보존하고 UTC 수정만 추가 실행한다.
- 제품 코드 구현·worker 실행은 이 계획 작성 단계에서 수행하지 않는다. 실행은 사용자의 명시적인 `$harness` 호출로 시작한다.

## 검증

- 백엔드: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
- 프론트: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
- HTTP 검증은 현재 코드가 반영된 기존 `http://localhost:3000` API와 실제 MySQL을 사용한다. 기존 읽기 fixture를 변경하지 않는 별도 기록 대상으로 쓰기 검증을 수행한다. DB 초기화·전체 시드는 계획하지 않는다.
- 서버가 없으면 검증 실패로 보고하고 `npm --prefix back run start:dev`를 안내한다. 화면 직접 확인이 필요할 때는 기존 `http://localhost:8081`만 사용하며 없으면 `npm --prefix front run start -- --port 8081`를 안내한다. 서버를 자동 실행하지 않는다.
- 계획 검증: `node tools/harness/cli.mjs validate --plan plan-35-episode-watch-progress`.

## 검증 결과

task-1과 task-2는 완료했다. 실행 결과와 검증 내역은 plan-local `index.json`의 각 summary에 기록돼 있다. 추가 task-3은 작성 단계이며 아직 구현·제품 검증하지 않았다.
