# plan-49-video-watch-progress

## 목표

시청 기록의 식별 기준을 `(user_id, episode_id)`에서 `(user_id, video_id)`로 전환한다. 프론트의 실제 본편 영상 UUID 요청부터 백엔드 저장·작품 상세 조회, 기존 기록 이관, API fixture 정리까지 일치시킨다. 범위와 task 구성은 사용자가 각각 승인했다.

## 범위와 비목표

- `user_watch_progress.video_id`는 `content_videos.id`의 INT UNSIGNED 숫자 ID를 저장한다. 외부 API는 영상 UUID를 사용하고 사용자는 Access JWT에서 결정한다. 프로젝트 규칙에 따라 물리 FOREIGN KEY는 추가하지 않는다.
- 신규 migration으로 기존 회차의 최소 display_order FULL 영상에 기록을 이관한다. 공개 상태와 관계없이 위치·완료·생성·변경·최근 재생 시각을 보존한다. 대응 영상이 없거나 예상 스키마가 아니면 파괴적 DDL 전에 중단한다.
- `PUT /me/episodes/:episodeUuid/watch-progress`를 제거하고 `PUT /me/videos/:videoUuid/watch-progress`로 교체한다. 공개 EPISODE/FULL 및 DRAMA/PREVIEW를 저장 대상으로 허용한다.
- 기존 STARTED/COMPLETED body, 204 응답, 2/3 완료 경계, 완료 상태 보존, UTC 저장, 본편 유료 권한 검사를 유지한다. 잘못된 영상 UUID는 400, 인증 실패 401, 미구매 유료 본편 403, 대상 없음·지원하지 않는 종류·비공개는 404다.
- 작품 상세의 episodes[].watchProgress는 그 항목의 videoUuid인 대표 FULL 영상에 저장된 본인 기록만 조회한다. 응답 키는 유지한다. 프리뷰·다른 FULL 영상의 기록을 회차 완료로 합산하지 않는다.
- 본편 화면은 재생 응답의 playback.videoUuid를 기록 요청에 사용한다. 영상·세션 변경 시 오래된 tracker와 재시도 작업을 폐기한다.
- 프리뷰 화면·추천 피드의 실제 기록 전송, 시청 기록 목록 API·페이징·보관함 UI·기록 삭제·이어보기 구현은 범위 밖이다. 프리뷰는 API와 DB에서 저장할 수 있지만 실제 화면 연결은 후속 작업이다.
- 기존 구매 API와 episode_entitlements의 회차별 키는 유지한다. 과거 migration·기존 시드·공통 인증·에러 처리·페이징 모듈을 수정하지 않는다.

## 요청과 조회 경로 확인

| 경로 | 이번 처리 |
| --- | --- |
| watchProgress.ts → playbackScreen_episode.tsx | playback.videoUuid로 새 PUT 호출 |
| PUT /me/episodes/:episodeUuid/watch-progress | 제거. 호환 alias 추가 없음 |
| PUT /me/videos/:videoUuid/watch-progress | 영상 직접 조회, 공개·권한·길이 검사, 사용자/영상 upsert |
| GET /dramas/:dramaId | 대표 FULL video.id에 본인 시청 기록 JOIN |
| GET /episodes/:episodeId/playback | 기존 videoUuid·durationMs 응답 유지와 소비 정합성 검증 |
| GET /dramas/:dramaId/previews/:videoId/playback | 응답 유지. 프리뷰 저장 대상 식별자 정합성 검증 |
| 카탈로그·컬렉션·저장 영상·구매 | 계약 유지. 공통 fixture 변경의 회귀 검증 |

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 이관 migration | 신규 migration·migration 테스트·back/README.md | 데이터 보존 up/down과 적용·복구 절차 |
| 2 | 백엔드·fixture 전환 | Entity·저장/상세 서비스·Postman·fixture·문서 | 영상별 저장·상세 JOIN·사용자/영상 격리와 테스트 정리 |
| 3 | 프론트 요청 전환 | watchProgress.ts·본편 화면·관련 테스트 | 실제 videoUuid 전송과 tracker 수명 검증 |

정확한 writable files와 checks는 이 폴더의 index.json 및 task 문서에 선언한다. 읽고 실행하기만 하는 기존 테스트는 files에 넣지 않는다.

## 실행 순서 및 병렬 작업

- 선행 조건: `plan-48-common-pagination`의 task와 검증 완료. 범위 검토 시 실행 중이던 해당 plan은 계획 파일 생성 직전에 completed로 확인했다. 이 계획은 draft/pending으로 생성한다. 공유 ARCHITECTURE.md와 saved-videos 컬렉션에 다른 plan의 변경을 보존한다. 이 외부 선행 조건은 문서에 명시하며, plan 내부 depends_on에 다른 plan의 task ID를 넣지 않는다.
- task-1은 plan 내부 선행 의존성이 없다. migration·적용 절차를 먼저 확정하므로 다른 task와 병렬 실행하지 않는다.
- task-2는 task-1 완료 후 실행한다. Entity 반영 전에 백업·리허설·자동 동기화 방지·스키마 전환 조건을 확인한다. 기존 서버에 바뀐 스키마와 소스가 함께 반영된 뒤 HTTP 검증한다.
- task-3은 task-2 완료 후 실행한다. 검증된 영상 UUID 계약을 소비하므로 파일이 겹치지 않아도 병렬 실행하지 않는다.
- 모든 task를 순차 실행한다. task-1 build의 back/dist/와 migration 적용 중 다른 build·DB/API 검증을 겹치지 않는다.
- watch-progress/content/playback은 shared content lock을 유지한다. 복수 FULL·공개 상태 경계는 saved-videos의 실행별 소유 콘텐츠와 exclusive lock에서 검증한다. 기존 공개 콘텐츠를 수정하지 않는다.
- test:api:parallel의 별도 사용자·영상 쌍, 임시 환경·컬렉션과 기존 lock 규칙을 유지한다. 이 명시적 fixture 격리 검증은 plan task 병렬 실행과 구별한다.

## DB 전환 전제

back/README.md의 키 변경 migration 규칙을 따른다. 실행 중 사용자가 `허용할게 재시작해`라고 명시해 task-2에서 로컬 DB_SYNCHRONIZE=false 설정과 기존 백엔드 중지·동일 포트 재시작을 허용했다. 다른 서버를 추가하거나 포트를 바꾸지 않는다. Entity 수정 전에 기존 서버의 자동 동기화가 해제되었는지 확인하고, 쓰기가 멈춘 구간에서 백업·복원 가능성 확인과 별도 MySQL DB의 up/down/up 리허설을 완료한다. 환경 전제가 준비되지 않으면 해당 전제를 확인할 때까지 의존 작업을 진행하지 않는다. 추가 writable files는 task-2 문서와 index에 선언했으며 임시 스크립트는 사용 후 제거한다.

적용 이력과 실제 스키마를 대조한다. synchronize로 바뀐 DB에 과거 migration부터 무조건 재실행하지 않는다. 이관 전후 행 수, 사용자→회차→대표 영상 대응, 위치·완료·모든 시각 값의 동일성을 비교한다. MySQL DDL 실패를 전체 rollback으로 간주하지 않는다. 백업·시크릿·실제 자격 증명을 저장소에 추가하지 않는다.

## 검증과 영향 범위

| task/대상 | 확인할 내용 |
| --- | --- |
| 1 | mapping·데이터 보존, 예상 밖 스키마·대응 영상 없음의 사전 실패, 안전한 down 및 손실 위험 down 거부, migration 컴파일 |
| 2 내부 | Entity PK·숫자 참조 메타데이터, 상세 JOIN·null/UTC 변환, fixture 소유 쌍 정리·실패 전파 |
| 2 watch-progress | 영상 UUID, 시작·2/3 완료·반복·동시 요청·완료 보존·UTC·인증·권한·입력·기존 경로 제거 |
| 2 content/playback | 대표 FULL 기록·사용자 격리·익명 null, 기존 videoUuid/길이 계약 |
| 2 saved-videos | 소유 복수 FULL·프리뷰의 독립 기록, 공개·종류 경계, 저장 플래그·유료 권한 보존 |
| 2 전체/병렬 API | 공통 fixture 실행기 선택·무인자 전체 실행, 서로 다른 실행 데이터 정리 격리 |
| 3 | 영상 경로와 실제 재생 UUID 전송, 영상·세션 전환 후 늦은 작업 무효화, 기존 완료 회차 표시 |

각 task의 정확한 명령은 index.json과 task 문서에 중복 없이 같은 값으로 기록한다. 공통 run.mjs·fixtureContext.mjs를 여러 suite가 소비하므로 선택 API와 무인자 전체 API 명령을 모두 선언한다. 일반 task에서 전체 lint·제품 test·export를 반복하지 않는다. 최종 $finish-plan은 task checks 및 변경 제품의 전체 프론트 typecheck/test/export와 백엔드 lint/test/build를 수행한다.

API 검증 전 http://localhost:3000/에 HTTP 요청하고 현재 코드·스키마 반영 여부를 확인한다. 포트/프로세스 조회만으로 부재를 판단하지 않는다. 반영 여부를 알 수 없으면 사용자에게 확인한다. 서버가 없으면 실패로 기록하고 `npm --prefix back run start:dev`를 안내한다. 프론트 서버 검증이 필요해지면 기존 8081을 사용하고 부재 시 `npm --prefix front run start -- --port 8081`을 안내한다. 다른 포트나 추가 서버를 사용하지 않는다. 필수 데이터·S3 서명 설정·DB 연결 부족, assertion·cleanup 실패는 실패다. API README의 조건을 따르고 기존 데이터 reset·seed를 하지 않는다.

## 완료 조건과 계획 검증

- 세 task가 허용 범위에서 완료되고 사용자·영상 키가 프론트/백엔드/fixture/문서에서 일치한다.
- 이관 단위 검사와 실DB 적용 결과를 구분한다. 단위 테스트만으로 실DB 이관 성공을 주장하지 않는다.
- 과거 migration의 episode_id와 episode_entitlements의 회차 키는 정상이다. 현재 시청 기록 코드·fixture의 회차 키 참조만 제거한다.
- 새 task 문서를 다시 열어 핵심 코드·호출 지점·수정 파일·검증·완료 조건을 직접 대조한 뒤 인덱스를 검증한다.
- 계획 생성 검증: `node tools/harness/cli.mjs validate --plan plan-49-video-watch-progress`.
- 계획 단계에서는 제품 코드·DB·서버·다른 plan 상태를 바꾸거나 제품 검증을 실행하지 않는다.

## 계획 생성 검증 결과

- 세 task 문서를 다시 열어 migration mapping·사전 거부, 저장/상세 JOIN·fixture, 프론트 UUID 호출 지점의 핵심 코드가 있는지 확인했다.
- 각 문서의 수정 허용 파일·depends_on·checks를 plan-local index와 대조했다. 읽기 전용 테스트는 writable files에 넣지 않았다.
- `node tools/harness/cli.mjs validate --plan plan-49-video-watch-progress` 통과: `valid: true`.
- plan은 draft, 모든 task는 pending이다. 제품 코드·DB·서버 변경 및 제품 검증 실행은 하지 않았다.

## 실행 이력과 복구 결과

- 세 task 완료: task-1의 migration 단위 테스트 5개와 `npm --prefix back run build` 통과. task-2의 focused unit 3파일/24개, 관련 API 4 suite, 전체 API 8 suite, 병렬 API 검증 통과. task-3의 프론트 요청 전환과 선택된 4개 테스트 파일의 54개 테스트도 통과했다. 최종 전체 제품 검증과 commit/push는 사용자가 명시적으로 호출하는 $finish-plan에서 수행한다.
- task-2에서 사용자는 기존 백엔드 재시작을 명시적으로 허용했다. `back/.env.development`의 DB_SYNCHRONIZE만 false로 변경했으나 최초 실행 권한으로는 Windows가 기존 3000 node 프로세스(PID 9696)의 종료를 거부했다. 이는 자동 승인 심사 거절이 아닌 OS 접근 거부였다. 사용자가 다시 중지·진행을 지시한 뒤 Windows 관리자 권한 실행으로 listener와 확인된 backend watcher를 종료했다.
- 첫 별도 DB 리허설에서 기존 TypeORM DataSource의 setOptions로 database만 바꾼 것이 driver의 대상 DB를 바꾸지 못해, 의도와 달리 원본 aivideodb의 시청 기록 스키마가 video_id로 전환됐다. 당시 원본 migration 이력에는 신규 migration이 없었고, 첫 리허설 DB에는 반대로 기존 스키마와 신규 이력이 남았다. 이후 아래 검증을 거쳐 정합화했으며 원본 DDL을 재실행하거나 rollback하지 않았다.
- 원본 백업은 저장소 밖 `C:\Users\jdh\AppData\Local\Temp\plan49-watch-progress-qpL0o0\source.sql`에 보관한다. 같은 폴더 manifest를 함께 보존한다. 최초 리허설 DB `plan49_rehearsal_9fc27743af0645ec`는 조사 후 manifest로 실행별 소유권을 확인하고 정리했다.
- 원본 4건과 백업 복원본을 사용자·회차/대표 영상 대응·위치·완료·last_played_at/created_at/updated_at까지 정규화해 비교한 SHA-256은 모두 `4d26b2d90d9225178aae2f36dbc9912c75d6a8cc51782596e3551412a966681f`로 일치했다. 위치 합계 84395, 완료 1건이며 확인된 데이터 손실은 없다.
- 이후 새 DataSource를 별도 DB 옵션으로 생성하고 SELECT DATABASE(), driver.database, options.database가 모두 별도 DB인지 검사한 뒤 원본 백업으로 다시 리허설했다. 25개 테이블 복원 행 수, up/down/up의 시청 기록 전체 값 보존과 무관한 테이블 행 수 유지가 통과했다. 두 번째 리허설 DB는 정리했다.
- 서버 중지 후 새 DataSource의 실제 연결 DB, 원본 스키마·PK·인덱스·CHECK 및 백업 값 일치를 확인하고, 유일한 미기록 migration을 TypeORM fake mode로 이력에 반영했다. Entity/API 변경 후 process-local DB_SYNCHRONIZE=false를 명시해 3000 백엔드를 재시작했다. 새 경로 401·제거 경로 404 및 실제 HTTP suite로 코드 반영을 확인했다. task-2의 모든 검증·fixture 정리 뒤에도 원본 4건의 SHA-256과 스키마·이력 정합성이 유지됐다. 임시 스크립트는 제거했다. persistent exec session 86861의 백엔드는 실행 상태로 인계했다.
