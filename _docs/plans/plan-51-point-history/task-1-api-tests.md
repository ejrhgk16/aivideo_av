# task-1-api-tests

## 기본 입력

- 이 task 문서와 index.json의 task-1 항목
- 컨텍스트로 전달된 적용 지침. 선행 task 없음
- 역할은 테스트 작성이다. 현재 제품 구현은 수정하지 않는다.

## 읽어야 할 파일

- `back/test/api/suites.mjs`: suite 등록 순서·lock과 선택 파싱
- `back/test/api/run.mjs`: 기존 서버 연결, managed/external 분기, fixtureContext 생성, 단일 suite 조기 분기, 환경 파일 작성, finally 정리
- `back/test/api/fixtureContext.mjs`: createUser와 사용자 원장/권한/지갑 정리. 읽기 전용
- `back/test/api/watchHistoryFixtures.mjs`: 실행별 UUID 등록과 부분 준비 실패 정리 방식만 참고. 읽기 전용
- `back/test/api/economy.postman_collection.json`: Root, 두 fixture 로그인, JWT·공통 오류 assertion과 요청 작성 방식만 참고. 읽기 전용
- `back/test/api/README.md`: 실행 서버·DB·fixture/lock·외부 환경 계약
- `back/test/unit/api/suiteSelection.spec.ts`: 기본 suite 목록과 정적 컬렉션 규칙
- `back/src/economy/entities/pointTransaction.entity.ts`, `episodeEntitlement.entity.ts`: 원장/권한 필드와 고유 제약
- `back/src/content/entities/drama.entity.ts`, `episode.entity.ts`: 소유 콘텐츠 fixture에 필요한 필드·공개 조건
- `_docs/AI_DRAMA_data_model/05-economy/point_transactions.md`: 거래 유형·부호·변경 불가 원장 규칙
- 신규 담당 파일은 아래 승인된 계약으로 작성한다. 제품 service 구현 전체를 읽을 필요는 없다.

## 필요 시 참고할 문서

- 적용 지침이 전달되지 않았거나 변경된 경우에만 해당 `AGENTS.md`를 읽는다.
- `_docs/ARCHITECTURE.md`의 Backend, Documentation and tooling, 시간 저장·비교·표시 기준: 테스트와 제품 책임 또는 UTC 처리를 판단해야 할 때 참고한다.
- `plan.md`의 승인된 API 계약: 이 task에 없는 계약 누락·충돌이 발견됐을 때만 확인하며 추측해 확장하지 않는다.

## 실패 시 참고할 파일

- 정적 검사 실패 시 오류가 가리킨 담당 파일만 확인한다. 구현 전 HTTP/기능 검증 실패를 유도하지 않는다.

## 작업

### 역할과 완료 조건

테스트 작성 task로서 아래 정확한 파일만 수정한다.

```text
back/test/api/point-history.postman_collection.json
back/test/api/pointHistoryFixtures.mjs
back/test/api/run.mjs
back/test/api/suites.mjs
back/test/api/README.md
back/test/unit/api/suiteSelection.spec.ts
```

checks:

```text
node --check back/test/api/pointHistoryFixtures.mjs
node --check back/test/api/run.mjs
node --check back/test/api/suites.mjs
node -e "JSON.parse(require('node:fs').readFileSync('back/test/api/point-history.postman_collection.json','utf8'))"
```

기능 테스트와 suiteSelection 실행은 하지 않는다. task-2가 구현 후 실행한다. 완료 요약에는 정적 검사 결과와 아래 시나리오/계약 검토 결과를 기록한다. 작성 완료는 기능 통과가 아니다. 제품 코드·API 계약 문서·기존 테스트 assertion을 약화하지 않는다.

### 고정된 조회 계약

- GET /me/points/transactions?page=1, Access JWT 필수. JWT 사용자의 전체 원장만 조회한다. userUuid query는 사용자 선택에 쓰지 않는다. GET은 모든 환경에서 제공하고 기존 경제 POST는 개발 환경에 한정한다.
- 30개 고정, page 기본 1. `created_at DESC, id DESC`. 정확한 root 키는 items/page/hasNext.
- item의 정확한 키: uuid/transactionType/amount/balanceAfter/createdAt/episode.
- transactionType: PURCHASE, AD_REWARD, EPISODE_UNLOCK, ADMIN_ADJUSTMENT, REFUND. amount는 부호 있는 정수, balanceAfter는 거래 직후 정수, createdAt은 UTC ISO Z다.
- 공개된 EPISODE_UNLOCK의 동일 사용자 entitlement → episode → drama가 연결되면 episode는 정확한 두 키 dramaTitle/episodeNumber를 가진다.
- 연결 없음·비공개·미래 공개 작품/회차·다른 거래 유형은 episode: null이다. 원장 행은 제외하지 않는다. 내부 ID·지갑 ID·idempotencyKey·memo를 응답에 포함하지 않는다.
- 빈 목록과 범위를 벗어난 페이지는 200, 빈 items, hasNext: false다. page 생략은 1. 잘못된 page는 400 HTTP_BAD_REQUEST, 인증 누락/오류는 401 AUTH_INVALID_TOKEN. 기존 공통 오류 다섯 키를 검사한다.

### 컬렉션과 suite 등록

- suites.mjs의 기존 9개 순서를 유지하고 마지막에 `{ id: 'point-history', collection: 'point-history.postman_collection.json', contentMode: 'exclusive' }`를 추가한다. 공개 fixture가 카탈로그 독자에게 영향을 줄 수 있어 exclusive다.
- suiteSelection.spec.ts는 기본 목록을 10개로 갱신하고 point-history 선택·중복 제거·정확한 collection/lock을 검증하도록 추가한다. 기존 미지 suite 거절·옵션 분리·다른 suite 검사 강도를 유지한다.
- 컬렉션은 실제 GET과 assertion을 소유한다. Root, Login as entitled fixture user, Login as unentitled fixture user라는 기존 정적 검사 요구 이름을 포함한다. 30개 경계 사용자를 위한 별도 로그인 요청도 둔다.
- Node runner에서 API 요청/응답 assertions를 대신 정의하지 않는다. runner는 연결·DB fixture 준비/스냅샷·환경 전달·정리만 수행한다.
- 동적 pm.sendRequest를 쓰면 해당 응답의 exact-key와 상태 assertion도 직접 수행한다. 토큰/비밀번호/DB 비밀 값은 로그나 저장된 collection에 넣지 않는다.
- 검사: 기본 page=1, 명시적 1, page=2와 끝 다음 페이지, 본인/다른 사용자 격리·userUuid spoof 무효, 누락/잘못된 JWT, 0/-1/1.5/공백/비숫자/중복/안전 범위를 넘는 page, 모든 거래 유형·부호·정수·UTC·필드 미노출.

### fixture와 실행기 통합

- run.mjs의 기존 fixtureContext 및 사용자 생성 흐름을 재사용하고 point-history 단일 suite 조기 분기를 기존 카탈로그/재생 fixture 생성 전에 추가한다. 무인자 실행은 기존처럼 suite별 자식 프로세스를 사용한다.
- entitled 사용자는 원장 31개, unentitled 사용자는 원장 0개, fixtureContext.createUser로 만든 별도 boundary 사용자는 원장 정확히 30개를 소유한다. 각 사용자 결과에 다른 사용자의 UUID가 없는지 검사한다.
- 첫 거래는 충분한 양수 충전으로 시작하고 이후 양수/음수 거래와 balance_after를 순서대로 계산한다. ADMIN_ADJUSTMENT는 음수 조정도 포함하고 잔액은 항상 0 이상으로 유지한다. fixture 지갑 최종 잔액은 소유 사용자에게만 설정한다.
- 두 종류 이상의 created_at과 동일 시각 묶음을 INSERT 시 명시한다. 삽입 순서와 시간 순서가 다른 행도 넣어 실제 두 정렬 기준을 구분한다. 기대 UUID 배열은 DB의 정해진 created_at DESC/id DESC 순서와 준비한 값으로 생성해 전달한다.
- 거래 유형별·연결 상태별 기대 항목은 UUID별 expectedItems로 전달한다. 모든 공개 숫자 필드/시간/episode의 정확한 값을 비교한다. 여러 페이지 합산이 전체 기대 UUID와 중복 없이 일치해야 한다.
- 기존 공개 작품 하나를 조회해 production_company_id를 읽기 전용으로 빌리고 실행별 UUID·slug의 작품/회차를 생성한다. 원본 row는 변경하지 않는다. 필요한 공개 원본이 없으면 필수 데이터 실패다.
- EPISODE_UNLOCK 사례: 공개 회차, 숨김 회차, 미래 회차, 숨김 작품의 회차, 미래 작품의 회차, 연결 권한 없음. 고유 제약을 지키도록 연결별로 서로 다른 소유 회차를 사용한다. 원장과 같은 사용자 entitlement만 만든다.
- 모든 날짜는 준비 시 명시적인 UTC 값으로 INSERT한다. 원장 정렬을 위해 기존 원장이나 소유 원장에 UPDATE를 실행하지 않는다.
- helper 객체는 prepare 전에 생성·보관하고 생성 UUID를 INSERT 전에 기록한다. 부분 준비 실패에서도 fixtureContext와 helper 정리가 실행돼야 한다.
- 컬렉션 시작 직전에 소유 사용자의 wallets, point_transactions 전체 필드, episode_entitlements를 정렬한 스냅샷을 보관한다. 컬렉션 종료 후 정리 전에 그대로인지 확인한다. 로그인으로 변하는 auth 테이블은 이 비교 대상이 아니다.
- run.mjs finally에서 fixtureContext.cleanup으로 소유 사용자 상태·권한·원장·지갑을 정리한 다음 helper가 소유 회차 → 작품을 제거한다. 잔존 row를 확인하고 준비/HTTP/assertion/정리 실패를 보존한다. 다른 사용자나 기존 콘텐츠를 지우지 않는다.
- 외부 API_TEST_ENVIRONMENT_FILE 모드는 DB 준비·수정을 하지 않는다. README에 새 환경 변수와 외부 fixture 책임을 기록하고, 필수 값이 없으면 collection이 명시적으로 실패하도록 한다.
- 환경 변수 계약: 기존 두 로그인 credential 쌍과 user UUID, pointHistoryBoundaryLoginId/pointHistoryBoundaryPassword, pointHistoryExpectedItems(31개), pointHistoryBoundaryExpectedItems(30개)를 사용한다. 기대 배열은 이미 최종 정렬된 공개 응답 객체 배열이다. tokens는 실행 중에만 collection 변수로 보관한다.
- helper 반환 환경 값은 run별 임시 환경 파일에만 저장한다. source task가 검사할 before/after의 불변성은 helper.verifyUnchanged가 책임진다.
- README에 새 suite·전체 순서·exclusive lock·0/30/31 fixture·공개 원본 전제·외부 모드·정리 계약을 정확히 반영한다. 자동 서버 실행을 안내하는 변경은 추가하지 않는다.

### 반복 작업 위임

불가. fixture 생명주기와 실제 HTTP 계약 설계가 필요해 동일 패턴의 반복 편집이 아니다. worker는 하위 에이전트를 만들지 않고 담당 파일을 통합해 정적 검사와 계약 검토를 수행한다.

### 주요 로직 코드 또는 변경 예시

아래는 새 collection의 핵심 assertion 예시다. 실제 collection 스크립트에서도 모든 항목을 정확하게 비교한다.

```javascript
const expected = JSON.parse(pm.environment.get('pointHistoryExpectedItems'));
const body = pm.response.json();
pm.test('first page has the exact public contract and all 30 expected rows', () => {
  pm.response.to.have.status(200);
  pm.expect(Object.keys(body).sort()).to.eql(['hasNext', 'items', 'page']);
  pm.expect(body).to.eql({ items: expected.slice(0, 30), page: 1, hasNext: true });
  body.items.forEach(item => {
    pm.expect(Object.keys(item).sort()).to.eql([
      'amount', 'balanceAfter', 'createdAt', 'episode', 'transactionType', 'uuid',
    ]);
    pm.expect(Number.isInteger(item.amount)).to.equal(true);
    pm.expect(Number.isInteger(item.balanceAfter)).to.equal(true);
    pm.expect(item.createdAt).to.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    if (item.episode !== null) {
      pm.expect(Object.keys(item.episode).sort()).to.eql(['dramaTitle', 'episodeNumber']);
    }
  });
});
```

fixture의 원장 입력과 expected item 축적 예시다. signed amount와 balance_after는 서로 일치해야 한다. 생성 UUID는 INSERT 전에 등록한다.

```javascript
async function addTransaction(db, owned, userId, input, balanceBefore) {
  const uuid = randomUUID();
  owned.transactionUuids.push(uuid);
  const balanceAfter = balanceBefore + input.amount;
  if (balanceAfter < 0) throw new Error('Invalid owned point-history balance');
  const [result] = await db.execute(
    `INSERT INTO point_transactions
      (uuid, wallet_user_id, transaction_type, amount, balance_after, idempotency_key, memo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [uuid, userId, input.transactionType, input.amount, balanceAfter,
      `api-point-history:${uuid}`, 'Private fixture memo', input.createdAt],
  );
  if (result.affectedRows !== 1) throw new Error('Owned point-history insert failed');
  return { id: result.insertId, balanceAfter, item: {
    uuid, transactionType: input.transactionType, amount: input.amount,
    balanceAfter, createdAt: input.createdAt.toISOString(), episode: input.episode ?? null,
  } };
}
```

helper/runner 호출 지점은 prepare 전에 helper를 보관하고, 정리 순서를 지키도록 구성한다. 실제 run.mjs에서는 기존 try/finally·attemptCleanup·임시 파일 소유 규칙 안에 통합하며 아래 흐름을 별도 runner로 복제하지 않는다.

```javascript
pointHistoryFixture = createPointHistoryFixtures({ db, runId: fixtureContext.runId });
const values = await pointHistoryFixture.prepare({
  fixtureContext, entitled, unentitled, sourceDramaId,
});
writeFileSync(environmentFile, JSON.stringify({ name: 'Point history API test', values:
  Object.entries(values).map(([key, value]) => ({ key, value, enabled: true, type: 'secret' })),
}), { mode: 0o600 });
await coordinate('prepared', { suite: ['point-history'], runId: fixtureContext.runId,
  userUuids: fixtureContext.userUuids, progressPairs: [] });
exitCode = await runSuites(['--environment', environmentFile], false);
if (exitCode !== 0) throw new Error('Postman point-history verification failed');
await pointHistoryFixture.verifyUnchanged();
await coordinate('verified', { suite: ['point-history'], runId: fixtureContext.runId,
  userUuids: fixtureContext.userUuids, progressPairs: [] });
```

완료 시 위 코드 예시와 고정 계약의 누락을 검토하고, 구현 전 테스트 실행 없이 task-2에 실행 준비 완료를 보고한다.
