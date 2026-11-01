# task-3-saved-fixture-cleanup

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-45-saved-video-review-fixes/plan.md
- back/test/api/README.md
- back/test/api/run.mjs
- back/test/api/saved-videos.postman_collection.json
- back/test/api/fixtureContext.mjs
- back/test/api/suites.mjs
- back/test/api/verifyParallel.mjs
- back/test/unit/api/fixtureIsolation.spec.ts
- back/test/unit/api/suiteSelection.spec.ts
- back/test/unit/api/contentLock.spec.ts

## 작업

### 파일 범위

- back/test/api/run.mjs
- back/test/api/saved-videos.postman_collection.json
- back/test/api/README.md

선언된 파일만 apply_patch로 수정한다. 다른 작업의 변경을 되돌리지 않는다. dev에서만 작업하고 branch·worktree·commit·push·계획 상태 직접 변경은 하지 않는다. public.postman_collection.json은 plan-44에서 삭제되었으므로 복원하지 않는다. 위 목록의 나머지 파일은 읽기·검증 전용이다.

### 의존성과 검증

- depends_on: []

~~~text
npm --prefix back run test:unit -- test/unit/api/fixtureIsolation.spec.ts test/unit/api/suiteSelection.spec.ts test/unit/api/contentLock.spec.ts
npm --prefix back run test:api -- --suite saved-videos
npm --prefix back run test:api:parallel
~~~

수정은 runner의 saved-videos 전용 fixture 준비·정리와 해당 컬렉션에 한정한다. 내부 소유권·suite 선택·lock 테스트와 실제 saved-videos suite를 실행하고, 공유 runner의 소비 경계는 기존 parallel 명령의 watch-progress 격리 및 content reader/saved-videos writer 대기로 확인한다. 전체 lint·test·build는 최종 $finish-plan에서 수행한다.

### 현재 구조와 완료 목표

plan-44 이후 각 suite는 실행별 사용자·환경·컬렉션 복사본을 사용한다. saved-videos는 독점 content lock 안에서 전용 작품, 무료·유료 회차, PREVIEW/FULL 영상을 생성한다. 생성 영상은 ownedSavedPairs와 generated 목록에 등록하고 finally에서 정리하며, fixtureContext.cleanup은 실행 소유 사용자와 그 저장 행도 제거한다. 기존 무료 영상의 저장 행이 다음 실행 사용자에게 남는다는 최초 계획의 전제는 더 이상 적용되지 않는다.

현재 paidVideo는 savedPaidEpisodeId를 메타데이터에 가지지만 실제 INSERT는 무료 회차 savedEpisodeId에 연결한다. 따라서 savedPaidVideoUuid로 수행하는 유료 저장 검증이 무료 FULL로 통과하고, 무료 조회 시나리오도 같은 영상을 선택한다. 무료·유료 FULL을 서로 다른 전용 영상으로 만들고 DB와 실제 API 모두에서 연결·가격을 확인한다. 저장 직후 실패해도 실행 소유 데이터가 정리되는 기존 보장도 실제 실패 경로로 검증한다.

### 구현 지시

- 기존 savedEpisodeUuid/savedEpisodeId는 무료 회차로, savedPaidEpisodeUuid/savedPaidEpisodeId는 유료 회차로 유지한다. 두 영상의 UUID와 회차 연결은 서로 달라야 한다.
- paidVideo의 FULL INSERT는 savedPaidEpisodeId에 연결한다. 무료 회차에는 별도의 FULL을 생성한다. 기존 addVideo 및 trackSavedPairs를 재사용하고 새 범용 fixture 프레임워크를 만들지 않는다.
- 무료 FULL UUID는 삽입 전에 기존 stateFixtures.videos에 기록하고, 삽입 후 trackSavedPairs로 두 실행 소유 사용자의 저장 키를 등록한다. paidVideo도 기존 정리·등록 경로를 유지한다. generated 영상이므로 정상·실패 종료 시 두 FULL 원본도 함께 제거한다.
- Postman 시작 전에 content_videos와 episodes를 JOIN해 두 UUID가 각각 EPISODE/FULL이고 같은 실행 소유 작품의 해당 무료/유료 회차에 연결됐는지 확인한다. 무료 price_points === 0, 유료 price_points > 0, 서로 다른 회차·영상, 테스트 사용자에게 유료 권한이 없음을 검증한다. 메타데이터에 적힌 episodeId만 검사해서 실제 연결 오류를 놓치지 않는다.
- 기존 detail/freeEpisode는 다른 suite와 시청기록의 기존 콘텐츠 조회 책임이므로 바꾸지 않는다. 저장 조회용 무료 FULL은 기존 개발 작품에서 선택하지 않는다.
- Postman values에 savedLookupEpisodeUuid, savedLookupEpisodeVideoUuid, savedPaidEpisodeUuid를 추가하고 기존 savedPaidVideoUuid는 유료 FULL UUID로 유지한다. 무료 FULL은 pagination의 기존 30 PREVIEW + 1 paid 기대 목록에는 추가하지 않는다.
- 컬렉션은 세 새 UUID와 savedPaidVideoUuid를 필수로 읽는다. savedOtherUserVideoUuid로 찾은 실행 전용 작품 detail에서 무료·유료 회차의 UUID, videoUuid, 가격을 명시적으로 대조한 뒤 저장한다. 변수 누락 시 임의 회차 선택이나 fallback을 하지 않는다.
- 무료 조회 시나리오의 실제 PUT·GET·DELETE와 저장 플래그 false 검증을 유지한다. 유료 저장·해제 시나리오도 실제 유료 FULL을 쓰게 하고 사용자 격리·지갑·권한 보존 assertion을 유지한다. 컬렉션의 assertion은 관리형/외부 환경 모두에서 수행된다.
- exclusive content lock, 임시 환경/컬렉션, finally 순서, 오류 전파와 fixtureContext.cleanup을 유지한다. 기존 데이터 reset/seed·기존 사용자 저장 삭제·기존 영상 원본 삭제를 하지 않는다.
- API_TEST_ENVIRONMENT_FILE은 외부 fixture를 그대로 전달하며 DB 연결·자동 준비·정리를 하지 않는다. README에 외부 환경의 세 새 필수 식별자, 기존 paid UUID와의 관계, 실패 시 호출자의 정리 책임을 기록한다.
- 서버 제품 코드·API 계약·DB 스키마·디렉터리 책임은 바꾸지 않는다.

### 회귀 검증과 완료 조건

1. 기존 http://localhost:3000의 HTTP 응답을 확인한다. 이번 변경은 테스트 파일만이므로 변경한 runner/컬렉션을 직접 실행한다. 서버가 없으면 실패로 보고 npm --prefix back run start:dev를 안내한다. 서버를 시작하거나 포트를 바꾸지 않는다.
2. 현재 무료 회차에 연결된 paid FULL을 DB/API 연결·가격 검증이 거부하는 실패를 먼저 재현한다. 수정 후 같은 검증이 무료·유료 각각에 대해 통과해야 한다. 잘못 연결된 FULL이 메타데이터의 유료 회차 검사만으로 통과하면 안 된다.
3. 정상 saved-videos suite에서 pagination 0/30/31, 실제 무료 조회 및 유료 저장, 사용자 격리, 지갑·권한 보존 assertion을 확인한다.
4. 통제된 실패: 소유 컬렉션의 무료 EPISODE PUT 성공 직후 일시적으로 예외를 넣어 후속 DELETE를 건너뛰고 npm --prefix back run test:api -- --suite saved-videos를 실행한다. 실제 PUT 204와 주입 예외로 인한 실패를 확인한다. 연결 오류·데이터 부족·다른 assertion 실패를 기대한 실패로 취급하지 않는다.
5. 이 실행의 사용자·저장 키·무료/유료 FULL·회차·작품 UUID를 실행 중 기록하되 토큰·비밀 값은 출력하지 않는다. 실패 반환 후 DB에서 해당 실행 소유 데이터가 모두 없고, 실행 전 조회한 기존 콘텐츠 및 기존 사용자의 저장 키가 유지되는지 읽기 전용으로 확인한다. 새로 생성한 전용 FULL은 제거되는 것이 기대 결과다.
6. 주입 구문을 apply_patch로 제거하고 정상 suite를 다시 실행해 새 사용자·빈 목록으로 시작하는지 확인한다. 잘못된 연결을 일시 주입한 setup 실패 경로도 기존 데이터가 유지되고 실행 소유 데이터만 정리되는지 확인한다. 별도 범용 failure injection 기능을 제품/runner에 추가하지 않는다.
7. 선언한 내부 테스트·정상 saved-videos suite·parallel 검증을 최종 파일 상태에서 모두 통과시킨다. 임시 실패 구문·토큰·비밀 값이 최종 파일에 없어야 한다. 외부 모드의 자동 정리 없음과 README/컬렉션 식별자 계약이 일치해야 한다.

finally에 도달하는 요청 오류·script timeout의 소유 데이터 정리를 검증한다. 프로세스 강제 종료·OS 중단까지 정리를 보장한다고 주장하지 않는다. 확인하지 못한 조건이나 실행하지 못한 check가 있으면 완료로 보고하지 않는다.
