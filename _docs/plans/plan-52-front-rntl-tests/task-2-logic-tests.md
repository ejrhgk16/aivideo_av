# task-2-logic-tests

## 기본 입력

- 이 task 문서와 index.json의 task-2 항목.
- 컨텍스트로 전달된 루트·front 적용 지침과 필요한 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- 수정 허용 목록의 기존 13개 테스트 파일: 테스트 이름·하위 t.test·입력/기대값·환경변수 및 singleton 정리 구간.
- front/src/common/http/api.ts 및 errorMessages.ts의 공개 함수/오류 타입.
- front/src/features/user/login.ts, session.ts, sessionClient.ts의 테스트가 호출하는 공개 입력·출력과 초기화 계약.
- front/src/features/drama/dramaContent.ts, home/homeContent.ts, economy/episodePurchase.ts, economy/pointHistory.ts의 공개 함수·응답 타입.
- front/src/features/playback/episodePlayback.ts, previewPlayback.ts, savedVideos.ts, watchHistory.ts, watchProgress.ts의 공개 함수·응답 타입.
- task-1의 설정·전역 mock/정리 계약과 media.test.ts 이전 결과. 실행기 전체 내부를 읽을 필요는 없다.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트 지원 코드와 제품 코드의 책임 경계가 불명확할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries를 확인한다.
- 이 task 계약에 누락·충돌이 있을 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인하고 보고한다. 전체 plan 재독을 요구하지 않는다.

## 실패 시 참고할 파일

- 작성 단계에서는 실행 실패 분석을 요구하지 않는다. task-7이 실패를 전달하면 해당 테스트와 직접 대상 공개 함수 구간만 추가 확인한다.

## 작업

13개 로직 테스트를 node:test/node:assert에서 Jest test/expect로 이전한다. 제품 함수를 일반 import로 불러오고 watchProgress의 VM 가로채기를 Jest의 sessionClient 경계 mock으로 바꾼다.

### 파일별 보존 계약

| 파일 | 보존할 시나리오 |
| --- | --- |
| api | public/optional/required 헤더, 로컬 401, JSON/204/오류 파싱, refresh 공유·1회 재시도·세션 교체 차단 |
| dramaContent, homeContent | baseUrl/경로/응답/선택 인증, caller UUID 위조 방지, 오류 전파 |
| episodePlayback, previewPlayback | UUID 인코딩·URL 보존/해결·익명/선택 인증·오류 |
| episodePurchase | body 없는 POST·포인트 부족·HTTP/비JSON/네트워크 오류 |
| errorMessages | 코드별 한국어 문구와 공통 fallback, 403/401 구분 |
| login, session | cookie/body transport·저장 완료 순서·복구/회전/삭제 오류·로그아웃 경합·계정 교체 차단·refresh 401 |
| savedVideos, watchHistory, pointHistory | 인증·페이지/요청 계약·공개 응답 필드·영상 라우트·오류 |
| watchProgress | required PUT·video UUID, STARTED/COMPLETED 순서/중복, 2초 1회 재시도·4xx 중단·dispose/구세션/잘못된 길이 |

### 구현 지시

- async t.test와 loop별 하위 케이스는 Jest test.each 또는 개별 test로 이전하며 async 작업을 모두 await한다. 상위 테스트 안에 Jest test를 등록하지 않는다.
- expect(...).rejects와 toMatchObject 등으로 기존 오류 타입·status·errorCode를 그대로 검증한다. fetch mock은 요청/응답 계약을 드러내고 반환값을 직접 검증한다.
- 테스트 간 process.env/global.fetch/configureSessionClient 값·모듈 singleton 오염을 막는다. setup 경계와 호환되게 afterEach/finally로 복구하고 매 시나리오 필요한 session client를 새로 구성한다.
- watchProgress는 saveWatchProgress의 apiRequest만 jest.mock으로 가로채고 createWatchProgressTracker는 실제 import한다. 기존 주입 timer 또는 Jest fake timer로 2000ms/최대 두 번/해제 동작을 결정적으로 검증한다. VM 때문에 필요했던 JSON stringify/realm 변환 helper는 제거한다.
- node:test·node:assert import, 제품 소스 파일 읽기/컴파일·vm 실행을 제거한다. 순수 함수에 RNTL render를 넣지 않는다.

### 역할과 완료 조건

테스트 작성 역할이다. 제품 src와 다른 task의 파일은 수정하지 않는다. 기존 파일의 모든 최상위·하위 시나리오를 새 테스트에 대응시키고, 이름 또는 이름 변경 사유를 완료 요약에 기록한다. 테스트 환경 때문에 관찰 방식을 바꾸더라도 동작 계약·경계값·오류 조건을 약화하지 않는다. 담당 .test.ts 경로를 유지하여 내용만 변경한다. 파일을 삭제하거나 이름을 바꾸지 않는다. 테스트 작성 완료는 기능 통과가 아니다. 실제 선택·전체 테스트는 task-7이 실행한다. 실패 분석으로 테스트 결함이 밝혀지면 해당 작성 task가 근거에 맞춰 범위 안에서 수정하고 task-7이 다시 검증한다. 공통 지원 코드 결함은 task-1 소유자에게 보고한다.

### 수정 허용 파일

- `front/tests/unit/api.test.ts`
- `front/tests/unit/dramaContent.test.ts`
- `front/tests/unit/episodePlayback.test.ts`
- `front/tests/unit/episodePurchase.test.ts`
- `front/tests/unit/errorMessages.test.ts`
- `front/tests/unit/homeContent.test.ts`
- `front/tests/unit/login.test.ts`
- `front/tests/unit/pointHistory.test.ts`
- `front/tests/unit/previewPlayback.test.ts`
- `front/tests/unit/savedVideos.test.ts`
- `front/tests/unit/session.test.ts`
- `front/tests/unit/watchHistory.test.ts`
- `front/tests/unit/watchProgress.test.ts`

### 의존성과 checks

- depends_on: task-1.
- checks: []. 독립적인 정적 TS 검사 명령이 없으므로 작성 단계에서 기능 테스트를 실행하지 않는다. 계약·시나리오 대응 관계 검토 결과를 완료 요약에 기록한다.

### 반복 작업 위임

불가. Node 하위 테스트·시간·네트워크·모듈 상태 격리 방식이 파일별로 달라 단일 치환 패턴으로 맡기지 않는다. 하위 에이전트를 생성하지 않는다. task-2~6은 최대 5개 부모 worker로 병렬 실행한다. 공통 지원 파일은 읽기 전용이다.

### 주요 로직 코드 또는 변경 예시

기존 URL/인증 계약을 Jest로 옮기는 대표 예시다. 각 파일의 기존 fixture와 타입은 유지한다.

```ts
import { saveWatchProgress, createWatchProgressTracker } from '../../src/features/playback/watchProgress';
import { apiRequest } from '../../src/features/user/sessionClient';

jest.mock('../../src/features/user/sessionClient', () => ({
  apiRequest: jest.fn(),
}));

test('saveWatchProgress uses required PUT and encodes the video UUID', async () => {
  jest.mocked(apiRequest).mockResolvedValue(undefined);
  await saveWatchProgress('video/1', { event: 'STARTED', positionMs: 0 });
  expect(apiRequest).toHaveBeenCalledWith(
    '/me/videos/video%2F1/watch-progress',
    { auth: 'required', method: 'PUT', json: { event: 'STARTED', positionMs: 0 } },
  );
});
```

Promise 큐와 경계값은 실제 tracker를 호출한다. send 완료를 제어하는 기존 deferred fixture는 유지할 수 있다.

```ts
test('progress events are consumed once and sent in order', async () => {
  const calls: Array<{ event: string; positionMs: number }> = [];
  const tracker = createWatchProgressTracker(async (value) => {
    calls.push(value);
  }, () => true);
  tracker.onProgress(1000, 3000);
  tracker.onProgress(2000, 3000);
  tracker.onProgress(2500, 3000);
  await new Promise<void>((resolve) => setImmediate(resolve));
  expect(calls).toEqual([
    { event: 'STARTED', positionMs: 0 },
    { event: 'COMPLETED', positionMs: 2000 },
  ]);
  tracker.dispose();
});
```

