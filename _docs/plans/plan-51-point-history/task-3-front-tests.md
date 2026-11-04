# task-3-front-tests

## 기본 입력

- 이 task 문서와 index.json의 task-3 항목
- 컨텍스트로 전달된 적용 지침. 선행 task 없음
- 역할은 테스트 작성이다. 제품 구현이나 테스트 실행기·공통 테스트 도구를 수정하지 않는다.

## 읽어야 할 파일

- `front/src/screens/PointsScreen.tsx`: 기존 탭·직접 history 진입·충전 예시 UI·잔액 표시
- `front/src/features/economy/episodePurchase.ts`, `economyResponses.ts`: 기존 economy 요청과 응답 파일 형식
- `front/src/features/playback/watchHistory.ts`: 인증된 page 조회 요청의 기존 진입 방식
- `front/src/features/user/UserProvider.tsx`: user/points/isRestoring/sessionVersion/isCurrentSession 반환 계약
- `front/tests/unit/watchHistory.test.ts`: configureSessionClient·fetch 대체·원상복구를 이용한 실제 apiRequest 검증 방식
- `front/tests/unit/libraryScreen.test.ts`: 기존 화면 VM/React hook/포커스/deferred promise 테스트 방식. 새로운 공통 harness를 만들지 않고 필요한 최소 패턴만 담당 파일 안에 사용한다.
- `front/src/components/ui.tsx`: Page/Button/EmptyState의 props 계약
- `_docs/api/00-overview/error-code.md`: 화면이 재사용해야 할 기존 오류/세션 만료 계약
- 신규 담당 테스트는 아래 승인된 진입점과 응답 타입을 대상으로 작성한다. 새 제품 구현 파일은 아직 존재하지 않을 수 있다.

## 필요 시 참고할 문서

- 전달되지 않았거나 변경된 적용 루트/`front/AGENTS.md`만 다시 확인한다. front/AGENTS.md의 정확한 Expo v57 문서 확인은 코드 작성 전에 따른다.
- `_docs/ARCHITECTURE.md`의 Frontend 및 Frontend global state: 화면 상태와 공통 세션의 소유 경계를 판단할 필요가 있을 때 참고한다.
- `plan.md`의 승인된 API 계약/프론트 계약: task에 없는 계약 충돌·누락을 발견했을 때만 참고한다.

## 실패 시 참고할 파일

- 이 task에서는 구현 전 기능 테스트를 실행하지 않는다. 정적 도구를 새로 만들거나 미구현 모듈을 로드하는 검사도 추가하지 않는다.
- 테스트 작성 자체의 인터페이스 불명확성은 해당 진입점 계약과 직접 참고 코드로 해결하고 불일치가 남으면 보고한다.

## 작업

### 역할과 완료 조건

정확한 수정 허용 파일:

```text
front/tests/unit/pointHistory.test.ts
front/tests/unit/pointsScreen.test.ts
```

checks는 `[]`다. 미구현 module을 로드하지 않으면서 의미 있게 검사할 기존 정적 명령이 없어 계약·시나리오 검토로 작성 완료를 판단한다. task-4가 구현 후 두 테스트와 구매 회귀를 실행한다. 본 task 완료는 테스트 통과가 아니다.

제품 코드·API·프론트 테스트 실행기·기존 다른 테스트 파일을 수정하지 않는다. 두 테스트 파일 안에서 필요한 로컬 helper만 작성하며 공통 abstraction을 만들지 않는다. 주요 동작을 실제 assertion으로 검증하고 소스 문자열 비교나 구현 자체를 복제한 테스트로 대신하지 않는다.

### 고정 요청/응답 계약

- 새 요청 진입점: `front/src/features/economy/pointHistory.ts`의 `getPointHistory(page = 1)`.
- `PointHistoryItem`, `PointHistoryPage`, `PointTransactionType`은 `front/src/features/economy/economyResponses.ts`에 두고 pointHistory.ts에서 필요한 타입을 re-export한다.
- GET `/me/points/transactions?page=N`, page는 encodeURIComponent로 직렬화한다. `apiRequest`와 auth: required를 사용한다.
- page 응답은 `{ items, page, hasNext }`. item은 `{ uuid, transactionType, amount, balanceAfter, createdAt, episode }`.
- 거래 유형은 PURCHASE, AD_REWARD, EPISODE_UNLOCK, ADMIN_ADJUSTMENT, REFUND. 금액/거래 직후 잔액은 숫자, 시간은 UTC ISO Z, episode는 `{ dramaTitle, episodeNumber } | null`이다.
- getPointHistory는 응답을 그대로 반환하고 현재 points나 DB 데이터를 변경하지 않는다. 권한 없는 호출은 기존 apiRequest/sessionClient 규칙대로 실패한다.

### 요청 테스트 매핑

- 실제 configureSessionClient를 사용하되 네트워크 fetch만 대체한다. 익명 요청 차단, 로그인 후 기본 page=1과 page=2의 정확한 URL/GET/Bearer 헤더를 검사한다.
- 다섯 유형, 부호·잔액·UTC·episode/null이 손실되지 않고 응답 그대로 전달되는지 검사한다.
- API 오류가 기존 ApiError로 전달되는지 검사한다. 토큰 자동 갱신 구현을 중복 테스트하거나 공통 모듈을 변경하지 않는다.
- GET 외 write 요청을 만들지 않는지 확인한다. 테스트 종료 시 fetch/env/session 설정을 기존 패턴대로 정리해 다른 테스트를 오염시키지 않는다.

### 화면 테스트 매핑

`PointsScreen`의 실제 render와 handler를 로컬 VM/hook harness로 실행하고 getPointHistory만 deferred 응답으로 대체한다. FlatList를 사용할 경우 renderItem·footer의 사용자 표시와 이벤트를 테스트 harness에서 실행한다. 원하는 상태를 만들려고 제품 함수를 새로 export하도록 요구하지 않는다.

- 기본 charge 탭에서는 history API를 호출하지 않고 예시 상품/가격, 준비 중 버튼이 유지된다. history 탭 클릭 및 tab=history 직접 진입 시 첫 페이지를 요청한다.
- 복원 중/익명 상태에서 요청하지 않으며 복원 안내/로그인 안내를 보인다. 로그인 버튼은 /login으로 이동한다. 로그인 복원 완료 후 첫 페이지를 조회한다.
- 첫 요청 중 로딩, 빈 응답 안내, 실패 안내와 재시도 성공을 검증한다. 오류 표시는 공통 getErrorMessage의 결과를 사용한다.
- 충전/광고 보상/회차 구매/관리자 조정/환불의 정확한 한글 유형, +1,000 P/-30 P, 거래 직후 잔액, 작품명·N화 또는 null일 때 일반 유형을 검사한다. 음수 ADMIN_ADJUSTMENT도 부호대로 표시해야 한다.
- `2026-11-03T18:04:00.000Z`가 `2026.11.04 03:04`로 표시되는지 검사한다. 장치 기본 시간대에 의존하는 local Date getter로 통과시키지 않는다. 자정은 24시가 아닌 00시로 표시한다.
- hasNext=true일 때 더 보기로 마지막 성공 page+1을 요청한다. 연속 클릭 중복 요청을 막고 uuid가 중복된 다음 페이지 결과는 하나만 표시한다. hasNext=false면 추가 호출하지 않는다.
- 다음 페이지 실패는 기존 목록을 유지하고 같은 다음 page를 재시도한다. 첫 페이지 재시도와 구분한다.
- history → charge 변경 후 도착한 성공/오류, blur/unmount 후 응답, 계정/세션 버전 변경 후 응답은 현재 화면을 덮지 않는다.
- 계정이 바뀐 직후 응답을 기다리는 렌더에서도 이전 계정 행이 보이지 않아야 한다. 새 계정 요청이 이전 계정의 pending 요청 때문에 차단되지 않는다.
- history 재진입/재포커스에서 page=1을 새로 조회하고 이전 페이지 결과를 누적하지 않는다.
- balanceAfter가 현재 points와 달라도 UserProvider.setPoints를 호출하지 않으며 상단 현재 points 표시는 보존한다.

### 반복 작업 위임

불가. 요청/상태/화면별 비동기 시나리오 설계가 필요하므로 반복 편집이 아니다. worker가 두 파일을 직접 작성하고 하위 에이전트를 만들지 않는다. task-1과는 수정 파일·출력·DB 사용이 독립적이어서 병렬 가능하다.

### 주요 로직 코드 또는 변경 예시

요청 테스트의 주요 흐름이다. fixture 로그인/fetch 구성·finally 복원은 기존 watchHistory.test.ts의 패턴을 사용한다.

```typescript
import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError } from '../../src/common/http/api';
import { getPointHistory, type PointHistoryItem } from '../../src/features/economy/pointHistory';
import { configureSessionClient } from '../../src/features/user/sessionClient';

test('point history uses required auth and preserves signed transactions', async () => {
  const originalBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const item: PointHistoryItem = {
    uuid: 'transaction-1', transactionType: 'EPISODE_UNLOCK', amount: -30,
    balanceAfter: 970, createdAt: '2026-11-03T18:04:00.000Z',
    episode: { dramaTitle: '테스트 작품', episodeNumber: 2 },
  };
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  const client = configureSessionClient({
    baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL,
    storage: { read: async () => null, write: async () => {}, remove: async () => {} },
    fetcher: (async (input, init) => {
      requests.push({ url: String(input), init });
      return { ok: true, status: 200, json: async () => ({
        items: [item], page: requests.length, hasNext: requests.length === 1,
      }) } as Response;
    }) as typeof fetch,
    loginRequest: async () => ({ uuid: 'user-1', displayName: null, accountType: 'MEMBER',
      availablePoints: 1000, accessToken: 'access', refreshToken: 'refresh', expiresIn: 900 }),
  });
  try {
    await assert.rejects(getPointHistory(), error => error instanceof ApiError && error.status === 401);
    await client.login({ loginId: 'fixture', password: 'fixture' });
    assert.deepEqual(await getPointHistory(), { items: [item], page: 1, hasNext: true });
    assert.deepEqual(await getPointHistory(2), { items: [item], page: 2, hasNext: false });
    assert.deepEqual(requests.map(request => request.url), [
      'http://localhost:3000/me/points/transactions?page=1',
      'http://localhost:3000/me/points/transactions?page=2',
    ]);
    assert.equal((requests[0].init?.headers as Record<string, string>).Authorization, 'Bearer access');
    assert.equal(requests.every(request => (request.init?.method ?? 'GET') === 'GET'), true);
    assert.equal(client.getUserSessionState().points, 1000);
  } finally {
    client.setUser(null);
    if (originalBaseUrl === undefined) delete process.env.EXPO_PUBLIC_API_BASE_URL;
    else process.env.EXPO_PUBLIC_API_BASE_URL = originalBaseUrl;
  }
});
```

화면 테스트의 private harness는 createPointsScreen/requestPages/resolveRequest/rejectRequest/pressTab/pressButton/setUser/refocus/settle/text 메서드처럼 실제 화면 이벤트를 제어한다. 아래는 그 harness를 담당 테스트 파일 안에 구현한 뒤 작성할 핵심 사용자 시나리오 예시다. 공유 모듈이나 제품 export로 만들지 않는다.

```typescript
test('history shows signed amounts and retries the failed next page', async () => {
  const screen = createPointsScreen({ tab: 'history', userUuid: 'user-a', points: 2000 });
  const first = { uuid: 'tx-1', transactionType: 'EPISODE_UNLOCK', amount: -30,
    balanceAfter: 970, createdAt: '2026-11-03T18:04:00.000Z',
    episode: { dramaTitle: '테스트 작품', episodeNumber: 2 } };
  screen.resolveRequest(0, { items: [first], page: 1, hasNext: true });
  await screen.settle();
  assert.match(screen.text(), /회차 구매/);
  assert.match(screen.text(), /테스트 작품/);
  assert.match(screen.text(), /2화/);
  assert.match(screen.text(), /-30 P/);
  assert.match(screen.text(), /970 P/);
  assert.match(screen.text(), /2026\.11\.04 03:04/);
  screen.pressButton('더 보기');
  screen.rejectRequest(1, new Error('network'));
  await screen.settle();
  assert.match(screen.text(), /테스트 작품/);
  screen.pressButton('다시 시도');
  assert.deepEqual(screen.requestPages, [1, 2, 2]);
  screen.resolveRequest(2, { items: [first, { ...first, uuid: 'tx-2' }], page: 2, hasNext: false });
  await screen.settle();
  assert.deepEqual(screen.visibleTransactionUuids(), ['tx-1', 'tx-2']);
  assert.equal(screen.setPointsCalls.length, 0);
});

test('an old account response cannot replace the new account history', async () => {
  const screen = createPointsScreen({ tab: 'history', userUuid: 'user-a', points: 100 });
  screen.setUser('user-b', 200);
  await screen.settle();
  screen.resolveRequest(1, { items: [{ uuid: 'b-1', transactionType: 'AD_REWARD',
    amount: 10, balanceAfter: 200, createdAt: '2026-11-03T18:04:00.000Z', episode: null }],
    page: 1, hasNext: false });
  await screen.settle();
  screen.resolveRequest(0, { items: [{ uuid: 'a-1', transactionType: 'PURCHASE',
    amount: 100, balanceAfter: 100, createdAt: '2026-11-03T18:04:00.000Z', episode: null }],
    page: 1, hasNext: false });
  await screen.settle();
  assert.deepEqual(screen.visibleTransactionUuids(), ['b-1']);
});
```
