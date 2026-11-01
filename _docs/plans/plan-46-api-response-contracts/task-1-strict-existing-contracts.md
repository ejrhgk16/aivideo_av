# task-1-strict-existing-contracts

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/test/api/README.md`
- `back/test/api/suites.mjs`
- `back/test/api/run.mjs`
- `back/src/content/publicCatalogService.ts`
- `back/src/programming/publicCollectionService.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/identity/refreshCookie.ts`
- `back/src/economy/pointService.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/common/error/error.filter.ts`
- `_docs/api/00-overview/conventions.md`

## 작업

기존 제품 코드를 수정하지 않은 상태에서 HTTP 응답 보존 기준을 먼저 테스트로 고정한다. 단순한 성공 여부나 일부 필드 포함 검사를 모든 필드의 정확한 형태·의미 검사로 강화한다.

1. `http://localhost:3000`에 HTTP로 연결한다. 현재 서버가 변경 전 코드와 일치하는지 확인한다. 연결 실패·반영 여부 미확인·필수 데이터 부족이면 통과 처리하지 않는다. 서버 자동 실행/포트 우회/seed/reset 금지.
2. 8개 기존 컬렉션에 성공 응답의 정확한 schema/키 집합 검사를 추가한다. 모든 객체에 `additionalProperties: false`, 현재 항상 나오는 필드를 전부 `required`로 지정한다. nullable은 생략을 허용하지 않는다. 선택 필드가 실제로 존재하는 경우만 optional로 선언한다. 유니언 분기는 분기별 정확한 필드를 검사한다.
3. 기존 요청과 assertion은 유지한다. 동일 응답에 지나치게 큰 고정 snapshot을 추가하지 않는다. 실제 old serializer와 HTTP 응답에서 키를 조사한 뒤, `_docs/api/00-overview/response-compatibility.md`에 endpoint·suite·키/타입/nullable·동적 값 검사·기존 오류·의도된 향후 오류 변경을 표로 기록한다. 이 문서는 테스트 근거이며 제품 API의 성공 계약을 바꾸는 문서가 아니다.
4. fixture 로그인, `pm.sendRequest`의 내부 요청, 웹 로그인/refresh 같은 중첩 HTTP 응답도 assertion을 직접 호출해 검사한다. collection-level test event만 추가하면 내부 요청은 누락되므로 완료로 인정하지 않는다.
5. 다음 계약을 모두 고정한다.
   - Root: 상태 200, 본문 `Hello World!`, 기존 텍스트 Content-Type 유지. CORS preflight의 상태·허용 origin/headers·credentials·본문 없음 유지.
   - genres: 배열, 각 객체의 id/code/name/tileImage. catalog와 detail: 현재 모든 중첩 키, 이미지 5개 키, preview·episodes·watchProgress의 정확한 키/타입. catalog/detail productionCompany는 string|null, 홈 collection은 {uuid,name}|null이며 이름을 통일하지 않는다.
   - catalog episodeCount와 collection publishedEpisodeCount, 홈 4종 code/title/description/dramas 및 displayOrder를 보존한다.
   - episode playback: url/videoUuid/isSaved/title/episodeNumber/durationMs. preview playback: url/videoUuid/isSaved/durationMs. 공개 상태·가격·entitlement·UUID 연결·현재 정렬 검사를 유지한다.
   - native login/refresh: uuid/displayName/accountType/availablePoints/accessToken/refreshToken/expiresIn. web은 refreshToken 필드를 아예 포함하지 않으며 Set-Cookie에만 전달한다. token 내부 저장용 만료 시각/DB id/password가 새로 노출되면 실패시킨다. no-store·쿠키 속성·회전·익명204·logout204를 검사한다.
   - point increase: uuid/amount/balanceAfter. purchase: episodeUuid/entitlementUuid/chargedPoints/availablePoints. 멱등 요청 및 반복 구매도 정확한 필드·잔액/차감 의미를 유지한다.
   - saved page: items/page/hasNext, 각 item의 현재 모든 필드 및 PREVIEW의 episode 필드 null/EPISODE의 UUID·회차 번호 구분. 기존 0/30/31 경계·동률 정렬·플래그·사용자 격리·비공개 제거를 유지한다.
   - logout/watch-progress/saved PUT·DELETE 및 익명 cookie refresh: 204와 본문 길이 0. 내부 pm.sendRequest 응답에도 `response.text() === ''`를 검사한다.
6. 기존 BaseException 응답은 정확히 다섯 키, errorCode/errorName/statusCode/path 정확 일치, timestamp 유효 UTC를 검사한다. 일반 Nest 오류는 이 task에서 old 응답으로 통과시킨다. 최종 공통 오류를 미리 적용하지 않는다. task-3만 일반 오류 기대값을 허용된 새 계약으로 전환한다.
7. `back/test/api/README.md`에 강화된 baseline→타입 변경 후 재실행→전역 오류 변경 후 재실행 순서와 민감한 원문을 남기지 않는 방법을 적는다. fixture 생성/정리, lock, 실행기 파일은 수정하지 않는다.
8. 로컬 응답 복사본으로 주요 strict validator에 잘못된 추가 키, 필수 필드 누락, 숫자의 문자열화, null 필드 생략, data wrapper 추가, 잘못된 유니언 값 및 순서 역전 입력을 넣어 실제 거부를 확인한다. 부정 검증은 collection test 안의 순수 응답 객체에 한정한다. 실제 DB/서버를 수정하거나 오류 유도용 endpoint를 만들지 않는다.

### 주요 로직 코드 또는 변경 예시

현재 재생 응답의 정확한 키를 고정하는 Postman assertion 예시다. 동일 원리를 다른 모든 중첩 응답에 적용한다.

~~~js
function assertEpisodePlayback(value) {
  pm.expect(value).to.be.an('object');
  pm.expect(Object.keys(value).sort()).to.eql([
    'durationMs', 'episodeNumber', 'isSaved', 'title', 'url', 'videoUuid'
  ]);
  pm.expect(typeof value.url).to.equal('string');
  pm.expect(typeof value.videoUuid).to.equal('string');
  pm.expect(typeof value.isSaved).to.equal('boolean');
  pm.expect(value.title === null || typeof value.title === 'string').to.equal(true);
  pm.expect(Number.isInteger(value.episodeNumber)).to.equal(true);
  pm.expect(Number.isInteger(value.durationMs)).to.equal(true);
}

pm.test('Playback preserves the existing exact contract', () => {
  pm.response.to.have.status(200);
  const body = pm.response.json();
  assertEpisodePlayback(body);
  pm.expect(body.videoUuid).to.equal(pm.collectionVariables.get('episodeVideoUuid'));
});

pm.test('Exact contract rejects additions, omissions and type changes', () => {
  const body = pm.response.json();
  pm.expect(() => assertEpisodePlayback({ ...body, data: body })).to.throw();
  const missing = { ...body };
  delete missing.title;
  pm.expect(() => assertEpisodePlayback(missing)).to.throw();
  pm.expect(() => assertEpisodePlayback({ ...body, durationMs: String(body.durationMs) })).to.throw();
});
~~~

`episodeVideoUuid`은 예시 이름이다. 실제 컬렉션이 detail에서 얻는 기존 video UUID 변수명을 사용하며, 새 fixture나 임의 기대 UUID를 만들지 않는다. schema를 쓰는 경우 위 수동 검사와 같은 강도를 모든 키에 적용한다. 본문 없는 응답은 다음과 같이 검사한다.

~~~js
pm.test('204 preserves the empty response body', () => {
  pm.response.to.have.status(204);
  pm.expect(pm.response.text()).to.equal('');
});
~~~

### 완료 조건

- 제품 코드는 변경하지 않고 강화된 8개 suite가 실제 API에서 모두 통과한다.
- 키·타입 검증뿐 아니라 기존 값·연결·정렬·잔액·권한·회전·저장 검사가 유지된다. 동적 값은 규칙을 문서화하고 의미를 검증한다.
- compatibility 문서에 모든 제품 endpoint/내부 요청/204/기존 업무 오류가 매핑되어 있다. 기존 컬렉션에 재현되지 않는 경계는 누락으로 숨기지 않고 명시한다.
- 변조한 응답 복사본의 부정 검증으로 assertion의 엄격함을 확인한다. 실패 시 기대값을 새 제품에 맞춰 느슨하게 바꾸지 않는다.
- 이후 worker가 사용할 baseline 통과 결과를 완료 요약에 기록한다. task-1 완료 전 제품 변경 task를 실행하지 않는다.

### 수정 허용 파일

- `back/test/api/http.postman_collection.json`
- `back/test/api/identity.postman_collection.json`
- `back/test/api/content.postman_collection.json`
- `back/test/api/programming.postman_collection.json`
- `back/test/api/playback.postman_collection.json`
- `back/test/api/economy.postman_collection.json`
- `back/test/api/watch-progress.postman_collection.json`
- `back/test/api/saved-videos.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/00-overview/response-compatibility.md`

### 의존성과 검증 명령

선행 task: 없음. 제품 변경 전 단독 실행.

~~~text
npm --prefix back run test:api -- --suite http --suite identity --suite content --suite programming --suite playback --suite economy --suite watch-progress --suite saved-videos
~~~
