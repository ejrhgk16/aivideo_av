# task-2-front-api-session-errors

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-34-jwt-api-client/plan.md
- .agents/skills/api-and-interface-design/SKILL.md
- front/src/features/user/login.ts, session.ts, UserProvider.tsx, useLogin.ts
- front/src/common/storage/refreshTokenStorage.ts, refreshTokenStorage.web.ts
- front/tests/unit/login.test.ts, session.test.ts
- front/scripts/test-front.cjs
- _docs/api/01-identity/login.md, refresh.md, logout.md
- 프론트 코드 작성 전 https://docs.expo.dev/versions/v57.0.0/ 공식 문서

## 작업

공통 API 요청/오류와 사용자 세션을 연결하고, 실행 중 Refresh 갱신과 경합 처리를 구현한다. task-1과 파일이 겹치지 않아 병렬 실행 가능하다. 다른 worker가 작업 중이므로 자신의 범위만 수정하고 다른 변경을 되돌리지 않는다.

### 정확한 수정 파일

```text
front/src/common/http/api.ts
front/src/common/http/errorMessages.ts
front/src/features/user/sessionClient.ts
front/src/features/user/session.ts
front/src/features/user/login.ts
front/src/features/user/UserProvider.tsx
front/tests/unit/api.test.ts
front/tests/unit/errorMessages.test.ts
front/tests/unit/session.test.ts
front/tests/unit/login.test.ts
front/scripts/test-front.cjs
```

### 구현 지시와 task-3 인계 계약

1. common/http/api.ts는 React·사용자 feature를 import하지 않는 통신 계층이다. ApiError(status, errorCode), SessionChangedError, 공개/선택/필수 인증 모드와 의존성 주입 가능한 createApiClient를 제공한다. URL 조합, JSON body/header, 204의 빈 응답, 커스텀 오류 body와 일반 Nest 오류/비JSON 오류를 처리한다. 실패한 json 파싱이 원래 status를 잃게 해서는 안 된다. 서버의 errorName/문구를 판정 조건으로 사용하지 않는다.
2. features/user/sessionClient.ts가 저장소와 기존 session 흐름을 연결하는 앱용 요청 인스턴스를 소유한다. task-3이 feature 함수에서 import할 apiRequest<T>(path, options)를 제공한다. options는 auth: 'public' | 'optional' | 'required', method, json 및 필요한 기존 요청 옵션을 지원한다. 공개 요청에는 Access/Refresh를 보내지 않고 auth 요청에는 최신 Access만 보낸다. 임의 외부 URL이나 미디어 URL에 토큰을 전송하는 기능은 만들지 않는다.
3. UserProvider와 sessionClient 사이에 인증 상태의 단일 기준을 둔다. 공통 계층이 Context를 import하거나 모듈 사이에 순환 참조가 생기지 않게 factory/adapter로 연결한다. 클라이언트 초기화와 복원을 화면 effect보다 먼저 준비하고 optional/required 요청은 초기 복원을 기다린다. 공개 요청은 복원 때문에 지연하지 않는다. 기존 useLogin과 UserProvider의 사용자·포인트·재생 설정 계약은 유지한다.
4. 로그인·복원·갱신·로그아웃의 토큰 읽기/회전/저장/상태 반영은 기존 직렬 queue로 묶는다. 갱신 Promise는 queue에 넣기 전에 공유해서 동시 요청이 각각 갱신 작업을 예약하지 않게 한다. auth/login, refresh, logout은 저수준 공개 통신을 이용하고 자동 갱신 루프에 들어가지 않는다.
5. 요청을 시작한 세션 세대와 실제 사용 Access를 기록한다. getSessionState()는 현재 { version, accessToken }을 내부 상태 참조가 아닌 새 객체로 반환한다. sessionVersion은 로그인 교체/로그아웃/인증 무효화 때 변경하고 단순 Access 갱신 때는 유지한다. 늦은 이전 Access의 401이면 이미 갱신된 최신 Access로 한 번 재시도하며 추가 Refresh를 발급하지 않는다. 세션이 바뀌면 예전 요청/오류를 SessionChangedError로 종료한다. 오래된 요청이 새 계정으로 재시도되어서는 안 된다.
6. Refresh 401은 저장소 삭제를 시도하고 사용자·포인트·Access를 정리한 뒤 sessionExpired=true를 한 번만 알린다. 삭제 실패도 메모리 정리를 막지 않으며 저장소 오류를 숨기지 않는다. 삭제 실패가 원래 Refresh 401이었다는 분류까지 없애지 않도록 인증 정리와 저장소 오류 전파를 구분한다. 인증된 요청을 1회 재시도해도 같은 토큰 401이면 현재 세션을 종료한다. 최초 미로그인/필수 인증 누락은 만료 팝업을 띄우지 않는다.
7. Refresh 통신 실패·5xx·응답 유실 또는 회전 후 저장 실패에는 같은 Refresh를 후속 API 요청이 자동 재사용하지 않도록 automaticRefreshBlocked 상태를 둔다. 초기 복원의 Refresh 실패에도 같은 규칙을 적용한다. 저장된 토큰은 보존하되 해당 실패를 호출자에게 전달한다. 새 로그인 또는 다음 명시적 복원 흐름에서만 차단을 해제한다. 일반 API 네트워크/5xx와 업무 403은 갱신하지 않는다.
8. UserProvider는 task-3용 sessionExpired, dismissSessionExpired(), sessionVersion 및 isCurrentSession(version)를 제공한다. dismiss는 팝업만 닫으며 같은 종료 세션의 지연 오류로 다시 열지 않는다. 정상 로그인은 만료 안내를 초기화한다. 수동 logout은 만료 안내를 발생시키지 않는다. 본 task에서는 UI·라우팅·팝업을 만들지 않는다.
9. errorMessages.ts에 getErrorMessage(error: unknown): string을 제공한다. 실제 문자열 errorCode로 AUTH_INVALID_LOGIN_INPUT, AUTH_LOGIN_FAILED, AUTH_INVALID_TOKEN_INPUT, AUTH_INVALID_TOKEN, EPISODE_ACCESS_DENIED, POINT_INSUFFICIENT_BALANCE 및 기존 포인트 오류를 한국어 문구로 매핑한다. 알려지지 않은 코드·일반 HTTP 5xx·통신 오류는 적절한 기본 문구로 처리한다. 통신 오류의 임의 Error.message나 서버 내부 문자열을 그대로 노출하지 않는다. 상태만으로 미구매와 세션 만료를 혼동하지 않는다.
10. 변경으로 불필요해진 AuthRequestError 등은 호출부/기존 테스트와의 호환을 확인해 정리한다. 기존 feature·화면이 아직 이관되지 않은 중간 단계에서도 typecheck/test/export가 통과해야 한다. task-3에 사용법과 실제 export를 summary로 인계한다.

### 주요 로직 코드 또는 변경 예시

아래 코드의 핵심은 요청의 세대·사용 Access를 비교하고 갱신 후 단 한 번만 재전송하는 것이다. 함수 이름은 실제 factory 내부에 맞춰 정리하되 동작을 유지한다. JSON 전송과 오류 파싱은 send가 수행하고, 갱신 내부는 저수준 요청만 사용한다.

```ts
type AuthMode = 'public' | 'optional' | 'required';
type RequestOptions = { auth: AuthMode; method?: string; json?: unknown };
type SessionState = { version: number; accessToken: string | null };

async function apiRequest<T>(path: string, options: RequestOptions): Promise<T> {
  if (options.auth === 'public') return send<T>(path, options, null);
  await session.ready();
  const started: SessionState = session.getSessionState();
  if (options.auth === 'required' && started.accessToken === null) {
    throw new ApiError(401, 'AUTH_INVALID_TOKEN');
  }
  const assertCurrent = () => {
    if (session.getSessionState().version !== started.version) throw new SessionChangedError();
  };
  try {
    const value = await send<T>(path, options, started.accessToken);
    assertCurrent();
    return value;
  } catch (error) {
    assertCurrent();
    if (!(error instanceof ApiError) || error.status !== 401 ||
        error.errorCode !== 'AUTH_INVALID_TOKEN' || started.accessToken === null) throw error;
    if (session.getSessionState().accessToken === started.accessToken) {
      await session.refreshOnce(started.version, started.accessToken);
    }
    assertCurrent();
    try {
      const value = await send<T>(path, options, session.getSessionState().accessToken);
      assertCurrent();
      return value;
    } catch (retryError) {
      assertCurrent();
      if (retryError instanceof ApiError && retryError.status === 401 &&
          retryError.errorCode === 'AUTH_INVALID_TOKEN') await session.expire(started.version);
      throw retryError;
    }
  }
}
```

refreshOnce는 공유 Promise를 먼저 등록하고, queue 안에서도 세션과 Access를 다시 확인한다. 아래는 공유 Promise와 자동 갱신 차단의 핵심 흐름이며 기존 코드 스타일에 맞춰 구현한다.

```ts
let refreshing: Promise<void> | null = null;
let automaticRefreshBlocked = false;

function refreshOnce(version: number, failedAccess: string): Promise<void> {
  if (refreshing !== null) return refreshing;
  refreshing = queue.enqueue(async () => {
    if (getSessionState().version !== version) throw new SessionChangedError();
    if (getSessionState().accessToken !== failedAccess) return;
    if (automaticRefreshBlocked) throw new Error('Automatic refresh requires explicit recovery');
    try {
      const response = await restoreSession(storage, lowLevelFetch);
      if (response === null) {
        await expire(version);
        throw new ApiError(401, 'AUTH_INVALID_TOKEN');
      }
      if (getSessionState().version !== version) throw new SessionChangedError();
      publishSession(response);
    } catch (error) {
      automaticRefreshBlocked = true;
      if (error instanceof ApiError && error.status === 401 &&
          error.errorCode === 'AUTH_INVALID_TOKEN') await expire(version);
      throw error;
    }
  }).finally(() => { refreshing = null; });
  return refreshing;
}
```

로그아웃/계정 교체 의도가 생기면 요청 세대를 즉시 무효화하고, 저장소 회전·폐기는 queue 안에서 순서대로 끝낸다. in-flight Refresh가 성공했다면 새 Refresh를 안전하게 저장/폐기에 사용하되 로그아웃된 UI를 되살리지 않는다. expire는 queue 안팎에서 재진입 가능한 내부 처리로 구성해 같은 queue를 await하며 교착시키지 않는다. 위 예시의 expire 이중 호출은 실제 구현에서 세대/종료 플래그로 멱등 처리한다.

### 테스트와 완료 조건

- fake fetch/storage와 제어 가능한 Promise로 실제 공통 client를 테스트한다. 구현을 복사한 가짜 세션 함수만 테스트하지 않는다.
- public/optional/required 헤더, JSON/204, 커스텀·일반/비JSON 오류, 필수 인증 누락, 오류 코드별 문구와 fallback을 검증한다.
- 동시 401, 첫 갱신 완료 후 늦은 이전 401, 최대 재시도 1회, auth endpoint 비재귀, 403·5xx 비갱신을 검증한다.
- Refresh 401에서 동시 소비자 모두 실패해도 만료 신호 1회, dismiss 이후 지연 401 재표시 없음, 새 로그인 후 새 만료 가능, 수동 로그아웃/최초 익명은 팝업 신호 없음, 통신·저장 실패 후 자동 Refresh 재사용 없음을 검증한다.
- 복원/로그인/로그아웃 경합, 이전 계정 응답/401이 새 계정에 반영되지 않음, 회전 중 로그아웃에서 세션 부활 없음, SecureStore 실패 시 메모리 정리·오류 전파를 검증한다. 저장 정책과 재생 설정은 보존한다.
- test-front.cjs의 기존 목록에 api.test.ts와 errorMessages.test.ts를 추가한다. task-3이 해당 파일에 이어서 테스트를 등록한다.

### 검증 명령

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

모든 checks가 통과하고 task-3이 사용할 apiRequest, ApiError, SessionChangedError, getErrorMessage 및 Context의 세션 만료/세대 계약이 구현되어 있어야 한다. 네이티브 실기기 검증을 export로 대체해 통과했다고 보고하지 않는다.
