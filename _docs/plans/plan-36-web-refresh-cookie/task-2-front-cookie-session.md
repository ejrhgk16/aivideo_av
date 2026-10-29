# task-2-front-cookie-session

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `.agents/skills/vercel-react-native-skills/SKILL.md`
- Expo 57 공식 문서 `https://docs.expo.dev/versions/v57.0.0/` (코드 작성 전에 읽는다)
- `_docs/plans/plan-36-web-refresh-cookie/task-1-backend-refresh-cookie.md`
- task-1이 갱신한 `_docs/api/01-identity/login.md`, `refresh.md`, `logout.md`와 `_docs/api/00-overview/authentication.md`
- `front/src/common/http/api.ts`
- `front/src/common/storage/refreshTokenStorage.ts`
- `front/src/common/storage/refreshTokenStorage.web.ts`
- `front/src/features/user/login.ts`
- `front/src/features/user/session.ts`
- `front/src/features/user/sessionClient.ts`
- `front/src/features/user/UserProvider.tsx`
- `front/src/app/login.tsx`
- `front/tests/unit/api.test.ts`
- `front/tests/unit/login.test.ts`
- `front/tests/unit/session.test.ts`
- `front/scripts/test-front.cjs`

## 작업

task-1 완료 후 웹 인증을 HttpOnly 쿠키 전송 모드에 연결한다. 다른 작업자가 함께 작업할 수 있으므로 기존 변경을 되돌리지 말고 현재 코드에 맞춰 적용한다. 아래 파일만 `apply_patch`로 수정한다. 플랫폼별 분기는 React Native를 순수 HTTP/세션 테스트 모듈에 새로 import하지 않고 `UserProvider`에서 명시적으로 전달한다.

### 정확한 수정 파일

```text
front/src/common/http/api.ts
front/src/common/storage/refreshTokenStorage.web.ts
front/src/features/user/login.ts
front/src/features/user/session.ts
front/src/features/user/sessionClient.ts
front/src/features/user/UserProvider.tsx
front/tests/unit/api.test.ts
front/tests/unit/login.test.ts
front/tests/unit/session.test.ts
front/README.md
```

### 주요 동작과 경계

- `UserProvider`에서 `Platform.OS === 'web'`이면 cookie, 나머지는 body 전송 모드를 세션 client에 전달한다. 기존 기본값은 body로 유지해 네이티브와 기존 순수 모듈 호출을 보존한다.
- 기존 로그인 요청 함수와 `publicApiRequest`에는 인증 요청에 필요한 `credentials`/헤더 전달을 최소한으로 추가한다. 웹 인증 3종만 `credentials: 'include'`, `X-Auth-Transport: cookie`를 사용한다. 일반 공개/선택/필수 제품 요청에 쿠키 전송·웹 인증 헤더를 무조건 추가하지 않는다. 기존 Bearer와 공개 요청의 Authorization 생략 정책을 유지한다.
- 웹 LoginResponse는 Refresh를 포함하지 않는다. 공통 응답 타입에서 이를 표현하고, body 모드에서는 Refresh 존재를 확인한 뒤 SecureStore에 쓴다. `undefined`를 저장하거나 Refresh가 없는 네이티브 응답을 성공으로 게시하지 않는다. 과도한 제네릭·새 추상화 계층은 만들지 않는다.
- 웹 login은 서버가 쿠키를 설정한 응답을 받은 뒤 사용자·포인트·Access를 게시한다. 웹 restore는 로컬 저장소의 read 결과와 무관하게 `/auth/refresh`를 호출한다. 204는 null, 200은 세션으로 변환한다. 웹에서는 Refresh를 읽거나 JS 저장소에 쓰지 않는다.
- 웹 저장 어댑터의 모듈 변수 Refresh를 제거한다. 기존 export 모양을 유지할 경우 read는 null, write/remove는 no-op으로 두되 cookie 경로가 해당 저장 API를 호출하지 않도록 테스트한다. 가짜 토큰 sentinel이나 document.cookie, localStorage, sessionStorage를 사용하지 않는다. 네이티브 어댑터 파일은 수정하지 않는다.
- 쿠키 없는 첫 방문/로그아웃 후 restore 204는 일반 미로그인이다. restoreError나 sessionExpired를 설정하지 않는다. 401은 기존 세션 만료 흐름을 사용한다. 네트워크/5xx는 오류를 유지하고 자동 Refresh 재시도를 하지 않는다. HttpOnly 쿠키 삭제는 서버만 할 수 있음을 전제로 한다.
- 로그인·복원·Refresh·logout의 기존 queue, 공유 초기화 Promise, 동시 401 Refresh 공유와 세션 version 검사를 유지한다. Fast Refresh/중복 초기화로 불필요한 Refresh 회전이 발생하지 않게 한다.
- 웹 logout은 메모리 인증 정보를 즉시 비운 뒤, 로컬 token 유무와 관계없이 서버에 쿠키 logout을 보낸다. 실패는 호출자에게 전파한다. 통신 실패 시 브라우저 쿠키/서버 세션이 삭제됐다고 보장하지 않는다.
- 최종 인증 실패로 client.expire가 실행될 때 웹도 서버 쿠키 정리 경로를 사용하도록 한다. queue 안에서 같은 queue를 다시 await하는 교착이나 종료 세션의 반복 logout/모달 재표시가 없게 한다. 서버가 401로 이미 삭제한 쿠키는 no-cookie logout 204로 정리할 수 있다. 오류를 처리하다 발생한 정리 오류는 기존 원인 보존 방식에 맞춘다.
- 네이티브의 읽기→본문 Refresh→회전 Refresh 저장→상태 반영과 logout finally remove 흐름을 유지한다. 이번 요청에 관계없는 화면·라우팅·구매·재생 코드는 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시

아래는 추가할 흐름의 예시다. 기존 함수의 매개변수와 호출부는 이전 호출이 body 모드로 동작하도록 마지막 선택 인수 또는 options를 최소한으로 추가한다. 실제 프로젝트의 공통 에러 파싱과 queue를 재사용한다.

```ts
type RefreshTransport = 'body' | 'cookie';

// UserProvider의 client 설정에서만 플랫폼을 판별한다.
const refreshTransport: RefreshTransport = Platform.OS === 'web' ? 'cookie' : 'body';
const sessionClient = configureSessionClient({
  baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '',
  storage: { read: readRefreshToken, write: writeRefreshToken, remove: removeRefreshToken },
  refreshTransport,
});

// login.ts: publicApiRequest가 명시적으로 받은 옵션만 fetch로 전달한다.
function login(input: LoginInput, fetcher?: typeof fetch, mode: RefreshTransport = 'body') {
  return publicApiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    json: input,
    ...(mode === 'cookie' ? {
      credentials: 'include' as const,
      headers: { 'X-Auth-Transport': 'cookie' },
    } : {}),
  }, fetcher);
}

// session.ts의 기존 post 함수에 전달할 fetch 옵션 분기
const requestInit: RequestInit = {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(mode === 'cookie' ? { 'X-Auth-Transport': 'cookie' } : {}),
  },
  body: JSON.stringify(body),
  ...(mode === 'cookie' ? { credentials: 'include' as const } : {}),
};

// restoreSession 내부의 핵심 분기. post는 기존 ApiError 처리를 유지한다.
if (mode === 'cookie') {
  const response = await post('refresh', {}, fetcher, baseUrl, mode);
  if (response.status === 204) return null;
  return await response.json() as LoginResponse;
}
const refreshToken = await storage.read();
if (refreshToken === null) return null;
// 이후 기존 body 모드의 post/401 삭제/회전 저장을 유지한다.

// 로그인·복원 응답의 저장은 body 모드에서만 수행한다.
if (mode === 'body') {
  if (typeof response.refreshToken !== 'string' || !response.refreshToken.trim()) {
    throw new Error('Refresh token is missing from the native session response.');
  }
  await storage.write(response.refreshToken);
}

// logoutSession: cookie는 브라우저가 보내며 저장소 유무에 의존하지 않는다.
if (mode === 'cookie') {
  await post('logout', {}, fetcher, baseUrl, mode);
  return;
}
// body는 기존 try/finally read/post/remove를 유지한다.

// client.expire의 기존 직렬화된 정리 구간에 연결한다.
await queue.enqueue(() => mode === 'cookie'
  ? logoutSession(storage, fetcher, baseUrl, mode)
  : storage.remove());
```

`LoginResponse`와 `loginRequest` 주입 타입도 선택 모드를 전달할 수 있도록 맞춘다. 기존 초기화/Refresh/login 호출 세 곳 모두 같은 전송 모드를 사용해야 한다. 위 조각은 전체 구현을 대체하지 않으며 네이티브 catch/finally나 기존 오류 전파를 생략하는 지시가 아니다.

### 회귀 테스트

- 새 테스트는 기존 `api.test.ts`, `login.test.ts`, `session.test.ts`에 추가해 현재 test runner가 실제로 실행하게 한다. src에 테스트를 만들지 않고 test runner 파일도 수정하지 않는다.
- 웹 인증 fetch의 URL·실제 POST·mode 헤더·credentials·body, Refresh 없는 성공 JSON, 204 null, 401 만료, 5xx/네트워크 비재시도, 저장소 메서드 미호출을 검사한다.
- 재현 테스트: 브라우저 쿠키를 서버 측 fetch fixture가 보관하는 상황을 모사한다. 첫 client의 cookie login 뒤 첫 client의 메모리를 사용하지 않는 두 번째 client를 생성하고 initialize해 user/points/Access가 복원되는지 확인한다. logout 후 생성한 세 번째 client는 204로 익명이 되어야 한다. 이 모사 테스트만으로 실제 브라우저의 쿠키 처리를 검증했다고 보고하지 않는다.
- 최초 방문은 sessionExpired=false, restoreError=null인지 검사한다. Access 만료 뒤 동시 요청의 단일 Refresh와 한 번 재시도, logout 대기 중 late response의 세션 version 보호, refresh/login/logout 직렬화를 cookie 모드에서도 검증한다.
- 네이티브 기존 저장소 테스트와 오류 정리 테스트를 유지한다. 일반 제품 요청이 credentials include 또는 웹 인증 헤더를 새로 받지 않는지, public 요청의 Authorization 생략과 authenticated 요청의 Bearer가 유지되는지 확인한다.
- `front/README.md`에 웹 쿠키 복원 방식·환경 URL·개발 서버 실행·배포 도메인 전제와 아래 수동 검증 절차를 기록한다. 예전의 웹 메모리 전용 설명이 있으면 이번 변경과 직접 관련된 문장만 수정한다.

### 실제 브라우저 검증

1. 실행 중인 프론트 `http://localhost:8081`과 API `http://localhost:3000`의 HTTP 응답 및 최신 코드 반영을 확인한다. 없으면 자동 시작하지 않고 실패로 보고하며 해당 실행 명령을 안내한다.
2. 브라우저 쿠키를 해당 개발 사이트에 한해 비운 상태에서 홈에 방문한다. refresh 204와 미로그인, 세션 만료 모달 없음, 무한 재시도 없음을 확인한다.
3. 기존 개발 로그인 경로로 로그인한다. Network에서 login에 credentials·전송 모드가 적용되고 Refresh 원문은 JSON에 없으며, 서버 응답 Set-Cookie와 브라우저 저장소에 HttpOnly·Path `/auth`·SameSite Lax 쿠키가 설정됐는지 확인한다. 토큰 값은 출력·스크린샷·결과 문서에 노출하지 않는다.
4. 사용자/포인트를 표시하는 화면에서 페이지를 새로고침한다. `/auth/refresh`가 쿠키로 200을 받고 로그인과 최신 포인트를 복원하는지 확인한다. 새 Refresh 쿠키가 설정되며 기존 Access 메모리를 재사용한 것으로 오판하지 않는다.
5. 기존 logout 기능을 실행해 서버 요청과 삭제 Set-Cookie를 확인한다. 새로고침한 뒤 refresh 204와 미로그인이 유지되어야 한다.
6. 개발 localhost HTTP의 Secure=false 확인과 운영 Secure 옵션 단위 테스트를 구분한다. 실제 Vercel/HTTPS 배포 검증은 수행했다고 주장하지 않는다.

현재 세션에 사용할 수 있는 브라우저 도구/설치된 검증 수단을 먼저 확인한다. 수단이 없으면 새 제품 의존성을 설치하거나 범위 밖 파일을 추가하지 말고, 수행하지 못한 브라우저 검증 항목과 수동 절차를 명시한다. 해당 항목을 통과 처리하거나 전체 성공 기준 달성으로 보고하지 않는다.

### 검증 명령 및 완료 조건

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

서버가 없으면 필요한 명령을 안내한다: `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`. 다른 포트나 추가 서버로 우회하지 않는다. 코드 반영 여부가 불명확하면 사용자에게 확인한다.

완료 조건: 세 checks 통과, 웹 로그인/새로고침 복원/로그아웃/익명 최초 방문의 회귀 테스트 통과, 네이티브 기존 검증 유지, 실제 브라우저 결과와 검증 한계를 분명히 기록한다. 사용자에게 실제 브라우저 성공 기준이 충족됐는지 별도로 보고한다.
