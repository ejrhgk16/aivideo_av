# task-1-watch-history-tests

## 읽어야 할 파일

- AGENTS.md, _docs/ARCHITECTURE.md의 Harness·백엔드 검증 규칙
- 이 폴더의 plan.md의 승인된 범위·검증 매핑과 index.json의 task-1 항목
- back/test/api/README.md, suites.mjs, fixtureContext.mjs, contentLock.mjs
- back/test/api/run.mjs의 suite 선택·fixture 준비/검증/정리·content lock 분기
- back/test/api/watch-progress.postman_collection.json, saved-videos.postman_collection.json의 로그인·공통 assertion·소유 fixture 패턴
- back/test/unit/api/suiteSelection.spec.ts, fixtureIsolation.spec.ts의 관련 내부 규칙
- _docs/api/04-playback/watch-progress.md, saved-videos.md
- _docs/api/00-overview/conventions.md, authentication.md, error-code.md

## 필요 시 참고할 파일

- back/src/playback/entities/userWatchProgress.entity.ts, back/src/content/entities/contentVideo.entity.ts, contentImage.entity.ts, drama.entity.ts, episode.entity.ts의 fixture용 테이블·키 정의
- 기존 source 서비스 전체나 task-2의 조회 구현 예시는 필수 읽기 대상이 아니다.

## 작업

depends_on은 없다. task-3·task-5와 병렬 작성할 수 있다. 이 task는 테스트 작성 역할이다. 승인된 계약으로 테스트와 필요한 지원 코드만 작성한다. 제품 코드·제품 API 문서를 수정하지 않는다. 아래 checks는 파일 문법·JSON 파싱만 검사하며 모듈을 로드하거나 테스트·HTTP·DB fixture를 실행하지 않는다. 구현 전 동작 테스트 또는 예상 실패 확인을 하지 않는다. 작성 완료를 기능 검증 통과로 보고하지 않는다. 다른 작업자가 함께 작업하므로 타인의 변경을 되돌리지 않고 아래 파일만 apply_patch로 수정한다.

### 정확한 수정 허용 파일

~~~text
back/test/api/watch-history.postman_collection.json
back/test/api/watchHistoryFixtures.mjs
back/test/api/run.mjs
back/test/api/suites.mjs
back/test/api/README.md
back/test/unit/api/suiteSelection.spec.ts
back/test/unit/api/watchHistoryFixtures.spec.ts
~~~


### API·응답 계약

1. WatchHistoryController는 me/watch-history의 GET을 제공하고 JwtAuthGuard로 보호한다. 사용자 UUID는 request.user.uuid에서만 가져오며 query userUuid를 신뢰하지 않는다.
2. page는 기존 parsePage(rawPage, 30)를 사용한다. 생략 시 1, 양의 정수 문자열·안전한 offset/lookahead만 허용하고 중복 값·공백·선행 0·0·음수·소수·지수·안전 정수 초과는 HTTP_BAD_REQUEST 400이다. limit 선택 기능을 추가하지 않는다.
3. 응답은 items/page/hasNext다. item의 정확한 키는 videoUuid, contentType, lastPlayedAt, dramaUuid, dramaTitle, imageUrl, durationMs, episodeUuid, episodeNumber, episodeTitle이다. EPISODE는 회차 UUID/번호와 nullable 제목을, PREVIEW는 회차 세 필드 모두 null을 반환한다.
4. lastPlayedAt은 기존 DB Date를 toISOString()으로 UTC Z 문자열로 반환한다. savedAt, 내부 숫자 ID, 재생 URL, positionMs, isCompleted를 목록 응답에 추가하지 않는다.
5. user_watch_progress를 실제 video.id와 JOIN하고 JWT 사용자 조건을 DB에 적용한다. isCompleted/positionMs 조건은 넣지 않는다. 복합 키로 한 영상은 한 항목이며 FULL/PREVIEW·서로 다른 FULL 영상은 각각 독립 항목이다.
6. 허용 조합은 EPISODE/FULL과 DRAMA/PREVIEW다. 작품과 본편 회차는 PUBLISHED이고 publishedAt <= UTC_TIMESTAMP(3)여야 한다. 프리뷰는 회차가 필요 없다. 현재 비공개인 항목은 목록에서만 제외하며 저장 기록을 삭제하지 않는다. 필터 적용 후 정렬·offset·limit을 수행한다.
7. 정렬은 progress.lastPlayedAt DESC, progress.videoId DESC다. 이미지·회차 JOIN으로 행이 늘어나지 않도록 이미지는 단일 scalar subquery로 선택한다. 기존 저장 목록과 같은 POSTER_LANDSCAPE 우선/POSTER 대체 및 createDramaImageUrls를 사용한다.
8. 조회는 entitlement/지갑을 변경하거나 재생 URL을 생성하지 않는다. 목록 자체에서는 현재 구매 권한으로 기록을 제외하지 않는다. 무료/유료 재생 권한은 기존 재생 endpoint가 검사한다.


### fixture·Postman·실행기

- suites.mjs의 기존 8개 순서를 유지하고 watch-history를 마지막 9번째 suite로 추가한다. collection은 watch-history.postman_collection.json, contentMode는 exclusive다. 선택/중복 제거/미등록 suite 오류 규칙을 유지한다.
- run.mjs에 새 suite의 준비·검증·정리 분기를 추가하고 새 watchHistoryFixtures.mjs로 자신의 콘텐츠를 관리한다. 기존 saved-videos 전용 분기를 새 suite에 그대로 적용해 불필요한 저장 API 호출이나 저장 완료 assertion을 수행하지 않는다. 관리형 lock 결정은 선택 suite의 contentMode에 근거해 watch-history도 fixture 생성 전부터 정리 완료까지 exclusive lock을 갖게 한다.
- 기존 fixtureContext로 새 사용자 2명과 필요한 entitlement를 만들고 trackProgressPair로 실제 HTTP 쓰기의 사용자/영상 쌍을 등록한다. 새 helper는 기존 공개 콘텐츠를 읽어 템플릿으로 쓸 수 있지만 새 UUID의 작품·회차·영상·이미지만 삽입/수정/삭제한다. 기존 작품의 공개 상태나 시청기록은 변경하지 않는다.
- 최소 31개 공개 기록을 만들 수 있는 영상 fixture와 무료 FULL, 구매 가능한/권한 있는 유료 FULL, PREVIEW, 다른 FULL, 비공개 작품·회차, 미래 공개 시점, 허용되지 않는 종류 fixture를 준비한다. 모든 영상 길이는 fixture 변수에서 명시한다. 이미지 우선순위와 이미지가 없는 경우도 자신의 콘텐츠로 검사한다.
- 시청기록은 기존 PUT을 호출해 0→30→31개를 구성하며 STARTED만 보낸 영상도 GET에 포함되는지 검사한다. 타인의 행·서로 다른 FULL·프리뷰를 섞어 합산·노출 오류를 검출한다. COMPLETED 이후 STARTED 재호출도 한 항목이고 최근 시청 시각이 갱신되는지 검사한다.
- 동률 정렬은 실행별 생성한 기록의 last_played_at만 같은 과거 UTC 시각으로 맞춰 video_id DESC 예상 UUID 순서를 환경에 제공한다. 최근 시청 재정렬은 이 소유 기록에 실제 PUT STARTED를 호출해 검사한다. reset/seed 명령을 실행하지 않는다.
- 비공개 기록의 제외를 검증할 때 공개 상태 변경은 run 소유 콘텐츠에만 적용한다. 비공개·미래·종류 불일치 데이터도 반드시 run 소유 행만 사용한다. 각 시나리오의 예상 목록을 명확히 격리해 30/31개 검사가 부수 기록에 영향받지 않게 한다.
- UUID를 INSERT 전에 소유 목록에 등록하고 삽입 실패·Postman 실패·정리 실패에서도 나머지 정리를 시도한다. progress와 entitlement 등 사용자 상태를 정리한 후 소유 영상/회차/이미지/작품을 제거하고 사용자/세션 정리를 마친다. 일부 실패 때문에 미정리 콘텐츠를 숨기거나 성공 처리하지 않는다.
- watchHistoryFixtures.spec.ts는 실제 HTTP 규칙 대신 내부 소유권·부분 준비 실패·cleanup 오류 전파/나머지 정리 시도를 검증한다. suiteSelection.spec.ts는 기본 9개 순서, 새 선택/중복 제거, collection 정적 파싱과 기존 공통 Root 및 두 로그인 요청을 검증한다. fixtureIsolation.spec.ts는 읽기 전용 회귀 대상으로 task-2가 실행한다.
- 컬렉션은 기본 Root와 두 fixture 로그인 요청을 유지하고 성공/오류의 정확한 key와 중첩 응답을 검사한다. pm.sendRequest를 쓰면 그 응답에도 명시적으로 공통 assertion을 호출한다. 임의 토큰·비밀·서명 URL을 파일이나 로그에 남기지 않는다.
- API_TEST_ENVIRONMENT_FILE 경로에서는 기존처럼 caller 소유 fixture를 사용하며 DB 준비/정리를 수행하지 않는다. 필요한 영상 UUID/예상 정렬/로그인 환경 변수와 fixture 조건을 README에 기록한다.
- back/test/api/README.md의 suite 표·기본 순서·lock·fixture 요구/정리·선택 실행 예시를 갱신한다. 제품 API 문서와 ARCHITECTURE.md 작성은 task-2가 맡는다.



### 주요 로직 코드 또는 변경 예시

31개 공개 시청기록을 만든 뒤 첫 페이지를 읽는 GET 요청의 Postman assertion 예시다. 요청은 GET {{baseUrl}}/me/watch-history?page=1이며 기존 entitledAccessToken을 Bearer로 전달한다. 자신의 fixture에서 계산한 예상 첫 페이지 UUID 배열을 historyExpectedPage1VideoUuids에 제공한다. 컬렉션에는 Root·두 로그인·실제 PUT 기록 저장 요청과 0/30/31개·빈 다음 페이지·오류/공개 조건 시나리오를 함께 작성한다. 아래 assertion을 포함해 실제 HTTP 실행은 task-2에서만 수행한다.

~~~js
pm.test('history returns the owned first page of 31 records', () => {
  pm.response.to.have.status(200);
  const body = pm.response.json();
  const expected = JSON.parse(pm.environment.get('historyExpectedPage1VideoUuids'));
  pm.expect(body).to.have.all.keys('items', 'page', 'hasNext');
  pm.expect(body.page).to.eql(1);
  pm.expect(body.hasNext).to.eql(true);
  pm.expect(body.items).to.have.lengthOf(30);
  pm.expect(body.items.map(item => item.videoUuid)).to.eql(expected);
  for (const item of body.items) {
    pm.expect(item).to.have.all.keys(
      'videoUuid', 'contentType', 'lastPlayedAt', 'dramaUuid', 'dramaTitle',
      'imageUrl', 'durationMs', 'episodeUuid', 'episodeNumber', 'episodeTitle',
    );
    pm.expect(item.lastPlayedAt).to.be.a('string');
    pm.expect(item.lastPlayedAt).to.match(/^\d{4}-\d{2}-\d{2}T.*Z$/);
    if (item.contentType === 'PREVIEW') {
      pm.expect(item.episodeUuid).to.eql(null);
      pm.expect(item.episodeNumber).to.eql(null);
      pm.expect(item.episodeTitle).to.eql(null);
    } else {
      pm.expect(item.contentType).to.eql('EPISODE');
      pm.expect(item.episodeUuid).to.be.a('string');
      pm.expect(item.episodeNumber).to.be.a('number');
    }
  }
});
~~~

예상 UUID/순서는 GET 응답에서 복사하지 않고 run 소유 fixture와 시나리오의 PUT 순서/동률 조건에서 계산한다. 비공개·미래 공개·종류 불일치 제외와 타인 격리의 예상 집합도 별도로 명시한다. 단위 테스트에는 부분 삽입 실패·Postman 실패·cleanup 오류 전파와 나머지 정리 시도를 재현하는 mock을 작성한다.

### 검증 명령

~~~text
node --check back/test/api/watchHistoryFixtures.mjs
node --check back/test/api/run.mjs
node --check back/test/api/suites.mjs
node --check back/test/unit/api/suiteSelection.spec.ts
node --check back/test/unit/api/watchHistoryFixtures.spec.ts
node -e "JSON.parse(require('node:fs').readFileSync('back/test/api/watch-history.postman_collection.json', 'utf8'))"
~~~


### 완료 조건

- 0/30/31개·빈 다음 페이지·동률/재시청 정렬·미완료 포함·본인 격리/query spoofing·입력/인증/공개 조건·이미지 우선순위 시나리오와 정확한 예상 결과를 계약과 대조해 검토한다.
- fixture 준비·소유권·실패 정리, 기본 9개 suite 등록과 선택/중복 제거에 대한 테스트를 작성하고 정적 checks를 모두 통과한다.
- 테스트/fixture 실행, API 호출, DB 준비·정리는 하지 않는다. 실제 단위/API 선택 및 전체 실행 담당은 task-2임을 완료 요약에 남긴다.
- 수정 파일·정적 검사 결과·계약/시나리오 검토 내용을 보고하며 기능 검증을 통과했다고 보고하지 않는다.

### 반복 작업 위임

불가. fixture 수명·실패 정리·HTTP 계약은 독립 파일에 같은 패턴을 적용하는 반복 작업이 아니다. 담당 worker가 작성·정적 검사·계약 검토를 맡으며 하위 슬롯은 0개다.
