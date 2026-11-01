# plan-45-saved-video-review-fixes

## 목표

plan-43 저장 영상 리뷰의 검색·추천 문제와, plan-44 이후 저장 API 테스트 fixture 문제를 수정한다.

1. 검색 화면이 세션 복원·만료·로그인·로그아웃·화면 복귀 후 다시 조회하고 오래된 응답을 무시한다.
2. 추천 컬렉션이 재정렬되거나 작품이 제거된 뒤 현재 재생 작품과 실제 스크롤 위치를 일치시킨다.
3. 저장 API 테스트가 서로 다른 무료·유료 FULL을 정확한 회차에 연결해 검증하고, 저장 직후 실패해도 실행 소유 데이터를 정리한다.

사용자가 $harness로 실행을 요청한 뒤 plan-44의 파일·테스트 구조 변경을 재점검하고 수정하도록 승인했다. 이 문서는 해당 승인을 반영한 실행 계획이다. plan-43·44의 문서·상태나 기존 변경을 되돌리지 않는다.

## 범위

- 검색: 기존 선택 인증을 유지하며 포커스·사용자 UUID·세션 세대에 맞춰 조회한다. 첫 실행에서 추가된 테스트 수동 등록은 제거하고 plan-44의 자동 탐색을 사용한다.
- 추천: 새 컬렉션 렌더에서 현재 UUID 또는 fallback의 새 인덱스를 구해 기존 pendingAlignmentRef와 실제 도착 확인 경로로 정렬한다.
- fixture: saved-videos의 실행 전용 작품·회차를 사용한다. 현재 무료 회차에 연결되는 paidVideo를 유료 회차에 연결하고 별도 무료 FULL을 생성한다. 실제 DB 연결·가격과 API 응답을 대조한다.
- 기존 ownedSavedPairs, generated 목록, fixtureContext.cleanup과 exclusive content lock을 재사용한다. 실패 경로에서 실행 소유 사용자·저장 행·콘텐츠가 제거되는지 확인한다. 외부 환경의 fixture 준비·정리는 호출자 책임이다.
- 기존 사용자·저장 행·콘텐츠를 변경하거나 DB reset/seed하지 않는다. 공개 API 계약·인증 정책·DB 스키마·디렉터리 책임은 바꾸지 않는다.

## Task

| 번호 | 이름 | 수정 허용 파일 | 작업 |
| --- | --- | --- | --- |
| 1 | 검색 화면의 세션 만료 후 조회 복구 | front/src/screens/SearchScreen.tsx, front/tests/unit/searchScreen.test.ts, front/scripts/test-front.cjs | 기존 검색 구현 유지, 불필요한 수동 등록 제거 및 회귀 검증 |
| 2 | 추천 컬렉션 갱신 후 현재 작품 스크롤 정렬 | front/src/screens/RecommendationScreen.tsx, front/tests/unit/recommendationPreviewBuffer.test.ts | 새 목록 기준 offset 정렬과 재정렬·삭제·빈 목록 회귀 테스트 |
| 3 | 저장 API 무료·유료 FULL fixture 분리와 실패 정리 검증 | back/test/api/run.mjs, back/test/api/saved-videos.postman_collection.json, back/test/api/README.md | FULL 연결·가격 검증, 환경 계약, 실패 정리 확인 |

test-front.cjs는 첫 실행에서 생긴 수동 등록 코드만 제거하기 위해 task-1 범위에 남긴다. 최종적으로 기존 자동 탐색 동작을 사용한다. public.postman_collection.json은 삭제된 파일이므로 복원하지 않는다.

## 실행 순서와 검증

- task-1과 task-3은 파일·검증 대상이 겹치지 않아 병렬 실행한다.
- task-2의 depends_on: ["task-1"]을 유지한다. 검색 작업 정리와 검증이 완료된 뒤 추천 작업을 수행한다.
- 정확한 files·depends_on·checks·실행 상태는 이 폴더 index.json을 기준으로 한다. 읽기·검증 전용 파일을 files에 추가하지 않는다.

task-1:

~~~text
npm --prefix front run test -- tests/unit/searchScreen.test.ts tests/unit/sessionExpiredDialog.test.ts tests/unit/testFrontRunner.test.ts
npm --prefix front run test
~~~

검색·세션 만료 UI와 실행기 소비 테스트를 선택한다. 실행기 수동 등록 제거의 회귀 검증을 위해 이 task만 무인자 전체 탐색 실행도 포함한다.

task-2:

~~~text
npm --prefix front run test -- tests/unit/recommendationPreviewBuffer.test.ts tests/unit/savedVideoScreens.test.ts
~~~

추천 스크롤·플레이어 수명과 저장 상태 동기화 소비 테스트를 선택한다.

task-3:

~~~text
npm --prefix back run test:unit -- test/unit/api/fixtureIsolation.spec.ts test/unit/api/suiteSelection.spec.ts test/unit/api/contentLock.spec.ts
npm --prefix back run test:api -- --suite saved-videos
npm --prefix back run test:api:parallel
~~~

saved-videos 전용 준비·정리 분기만 변경한다. 내부 소유권·선택·lock, 실제 저장 suite와 기존 parallel 명령의 watch-progress 격리·content reader/saved writer 소비 경계를 검증한다. task-3 문서의 잘못된 FULL 연결 실패, PUT 직후 통제된 실패, DB 정리 확인 및 정상 재실행도 필수다.

API 검증은 기존 http://localhost:3000 및 그 서버의 MySQL을 사용한다. 서버 연결·필수 데이터·정리 실패는 검증 실패다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 백엔드가 없으면 npm --prefix back run start:dev, 실제 프론트 서버가 필요한 확인에서 8081이 없으면 npm --prefix front run start -- --port 8081을 안내한다.

전체 프론트 typecheck·test·export와 백엔드 lint·test·build는 명시적인 $finish-plan에서 수행한다. $harness는 commit·push·finish를 수행하지 않는다.

## 실행 이력

- 최초 task-1은 검색 구현·회귀 테스트와 전체 typecheck/test(148개)/export를 통과했다. 오래된 계획의 수동 테스트 등록 지시까지 구현되어 정리 후 재검증하도록 다시 열었다.
- 최초 task-3은 선언된 public.postman_collection.json이 없고 실제 saved-videos 컬렉션이 범위 밖이어서 파일 변경 없이 세 번 실패해 blocked가 되었다. 당시 lint/test/build 및 API 시나리오는 실행하지 못했다.
- 사용자 승인으로 task-3의 파일 범위와 목표·검증을 갱신하고 task-1·3을 CLI reset으로 pending으로 되돌렸다. 이력은 보존하며 새 범위에서 재실행한다.
- plan-44의 자동 테스트 탐색·8개 suite·실행별 fixture·content lock을 기준으로 세 task 문서와 index.json을 갱신했다.

## 실행 결과

세 task가 모두 completed이며 Harness next 결과는 done이다.

| Task | 검증 결과 |
| --- | --- |
| 1 | 검색·만료 안내·실행기 선택 테스트 9/9, 무인자 프론트 전체 테스트 148/148 통과. 테스트 실행기 수동 등록 변경은 제거했다. |
| 2 | 추천 화면·저장 화면 선택 테스트 29/29 통과. 같은 길이 재정렬, 현재 작품 제거·빈 목록, 메타데이터만 갱신, 오래된 응답·모션을 확인했다. |
| 3 | 선택 단위 테스트 3개 파일 21/21, saved-videos suite 176 requests·89 assertions, 실제 parallel lock·격리 검증 통과. |

- task-3의 잘못된 유료 FULL 연결을 일시 재현했을 때 실제 DB JOIN 검증이 예상한 오류로 실패했다. 종료 후 해당 실행의 사용자·작품·회차·영상·이미지·저장 행·컬렉션 링크가 0개임을 확인했다.
- 무료 EPISODE PUT이 실제 204로 성공한 직후 예외를 주입해 후속 DELETE를 건너뛴 실행도 예상한 예외로 실패했고, 실행 소유 데이터는 남지 않았다. 기존 작품은 유지됐고 해당 작품의 기존 저장 행 snapshot은 전후 모두 0개였다. 비어 있지 않은 기존 저장 행 보존을 별도로 입증한 것으로 해석하지 않는다.
- 임시 예외·진단 출력 제거 후 정상 suite와 선언한 검증을 통과했다. 외부 fixture에서도 필수 UUID·회차 연결·가격 검증 실패가 EPISODE PUT 전에 실행을 중단하도록 확인 로직을 배치했다.
- 저장 카드 검사는 페이지 1에 남는 최신 PREVIEW를 사용한다. 기존 첫 PREVIEW의 오래된 저장 시각 때문에 페이지 2로 밀리는 영향을 피하면서 실제 카드 응답을 검사한다.
- git diff --check 통과. 최종 제품 전체 검증과 commit·push는 명시적인 $finish-plan 단계에 남겨 둔다.
