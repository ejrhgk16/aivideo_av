# task-3-front-auth-session

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `front/AGENTS.md`
- `front/src/features/user/UserProvider.tsx`
- `front/src/features/user/useLogin.ts`
- `front/src/app/login.tsx`
- `front/src/app/_layout.tsx`
- `front/scripts/test-front.cjs`
- `_docs/api/01-identity/login.md`
- `_docs/api/01-identity/refresh.md`
- `_docs/api/01-identity/logout.md`

## 작업

task-2 인증 API를 기존 로그인과 UserProvider에 연결하고 Refresh Token의 저장·복원·삭제를 구현한다.

### 정확한 수정 파일 범위
- `front/package.json`
- `front/package-lock.json`
- `front/app.json`
- `front/src/common/storage/refreshTokenStorage.ts`
- `front/src/common/storage/refreshTokenStorage.web.ts`
- `front/src/features/user/login.ts`
- `front/src/features/user/session.ts`
- `front/src/features/user/UserProvider.tsx`
- `front/src/features/user/useLogin.ts`
- `front/src/app/login.tsx`
- `front/tests/unit/login.test.ts`
- `front/tests/unit/session.test.ts`
- `front/scripts/test-front.cjs`

### 검증 명령
```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

### 구현 전 확인
front/AGENTS.md에 따라 https://docs.expo.dev/versions/v57.0.0/ 의 버전별 문서에서 SecureStore 지원 플랫폼과 설정을 확인한다. Expo 57과 호환되는 expo-secure-store를 front에 추가하고 lockfile과 app.json의 plugins를 갱신한다.

### 구현 지시
- refreshTokenStorage.ts는 expo-secure-store의 setItemAsync/getItemAsync/deleteItemAsync를 사용하고 키를 auth.refreshToken으로 고정한다. Refresh Token만 저장한다.
- refreshTokenStorage.web.ts는 동일한 read/write/remove API를 메모리로 구현한다. localStorage/sessionStorage/AsyncStorage에 인증 정보를 저장하지 않는다. Expo platform resolution으로 웹에서 네이티브 SecureStore를 import하지 않게 한다.
- login.ts의 인증 응답 타입에 accessToken/refreshToken/expiresIn을 추가하고 기존 uuid/displayName/accountType/availablePoints를 유지한다. API URL 누락과 HTTP/network 오류 처리의 기존 방식을 따른다. refresh/logout 호출은 session.ts에 둔다.
- session.ts에 로그인 결과 저장, 저장된 Refresh Token을 이용한 복원, 로그아웃의 비UI 로직을 둔다. 범용 HTTP client, 자동 401 재시도, 타이머 갱신은 만들지 않는다. Storage/fetch를 사용하는 작은 함수와 테스트에 필요한 최소한의 의존성 전달만 사용한다.
- 갱신 성공 시 새 Refresh Token 저장이 완료된 후 메모리 세션을 공개한다. UserProvider는 User 필드를 명시적으로 추출해 토큰이 User 객체에 섞이지 않게 한다.
- UserProvider의 기존 user/points/재생 설정/setPoints 계약을 유지하고 accessToken, isRestoring, 복원 오류, login/logout 동작을 추가한다. Refresh Token은 Context에 공개하지 않는다.
- 초기 isRestoring=true로 시작하고 저장 없음/성공/실패 모두 복원 완료 시 false로 바꾼다. 갱신 401은 저장도 삭제하고 미로그인으로 처리한다. 통신 오류/5xx는 저장을 유지하고 미로그인 상태와 복원 오류를 표시한다.
- Context에서 logout을 제공하고 서버 세션 폐기를 시도한 뒤 로컬 User/points/Access와 Refresh 저장을 삭제한다. 서버 폐기 실패는 호출자에게 전달한다. 새 화면이나 로그아웃 버튼은 추가하지 않는다.
- useLogin은 기존 인터페이스를 유지하면서 Context의 로그인 동작을 호출한다. /login은 isRestoring 중 로그인/redirect하지 않는다. 기존 기본값 admin/admin, 파라미터 검증, 성공 시 redirect를 유지하며 복원 오류도 표시한다.
- 복원/로그인/로그아웃의 저장과 상태 반영을 직렬화해 늦은 응답이 이전 사용자를 복원하지 못하게 한다. unmount 이후 늦은 응답에 의한 state 갱신도 막는다.
- 백엔드는 사용된 Refresh Token이 다시 오면 같은 로그인의 최신 토큰까지 폐기한다. 따라서 refresh 실패·timeout·응답 유실 시 이전 토큰으로 자동 재시도하지 않는다. 복원 요청을 중복 실행하지 않으며 401이면 메모리 Access/user/points와 저장 Refresh를 모두 정리한다. 백그라운드 재로그인으로 401을 숨기지 않는다. 기존 개발용 /login은 명시적으로 해당 경로를 방문할 때만 사용한다.
- 저장 실패는 로그인/복원 성공으로 처리하지 않는다. 서버에서 이미 발급/교체되었더라도 로컬 저장이 실패한 상태를 구분해 오류로 보고한다.
- 앱 시작 시 복원 이외의 자동 갱신은 제외한다. 기존 API에 Access를 전송하거나 UUID 입력을 삭제하지 않는다.
- scripts/test-front.cjs의 고정 파일 목록에 session.test.ts를 추가한다. 무관한 기존 테스트 등록은 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시
Storage는 아래의 최소 API로 구현한다.
```ts
// refreshTokenStorage.ts (native)
import * as SecureStore from 'expo-secure-store';
const key = 'auth.refreshToken';
export const readRefreshToken = () => SecureStore.getItemAsync(key);
export const writeRefreshToken = (token: string) =>
  SecureStore.setItemAsync(key, token);
export const removeRefreshToken = () => SecureStore.deleteItemAsync(key);

// refreshTokenStorage.web.ts
let refreshToken: string | null = null;
export const readRefreshToken = async () => refreshToken;
export const writeRefreshToken = async (token: string) => { refreshToken = token; };
export const removeRefreshToken = async () => { refreshToken = null; };
```

복원의 핵심 로직은 session.ts에 둔다. refreshSession은 POST /auth/refresh로 JSON을 전송하고 HTTP 오류에 status를 넣는 작은 함수로 같은 파일에 구현한다. 저장 후 반환한 응답을 UserProvider가 상태에 반영한다.
```ts
export async function restoreSession(): Promise<LoginResponse | null> {
  const token = await readRefreshToken();
  if (token === null) return null;

  let response: LoginResponse;
  try {
    response = await refreshSession(token);
  } catch (error) {
    if (error instanceof AuthRequestError && error.status === 401) {
      await removeRefreshToken();
      return null;
    }
    throw error;
  }

  await writeRefreshToken(response.refreshToken);
  return response;
}
```

세션 동작은 UserProvider의 동일 queue를 사용해 복원·로그인·로그아웃의 저장과 state 반영까지 직렬화한다.
```ts
const operationQueue = useRef<Promise<unknown>>(Promise.resolve());
const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
  const next = operationQueue.current.then(operation, operation);
  operationQueue.current = next.catch(() => undefined);
  return next;
}, []);

// Provider 로그인 동작 내부. 저장 후 상태에 반영하고 useLogin에서 호출한다.
return enqueue(async () => {
  const response = await login(input);
  await writeRefreshToken(response.refreshToken);
  setSession({
    user: {
      uuid: response.uuid,
      displayName: response.displayName,
      accountType: response.accountType,
    },
    points: response.availablePoints,
    accessToken: response.accessToken,
  });
  return response;
});
```

복원은 Provider 마운트마다 하나의 Promise를 보관하고 effect 재실행에서도 같은 결과를 구독한다. 단순히 복원 요청 두 개를 queue에 넣으면 첫 요청의 응답 유실 뒤 두 번째 요청이 이전 토큰을 자동 재사용할 수 있으므로 그렇게 구현하지 않는다. User/points/Access는 함께 갱신하고 재생 설정은 유지한다.
```ts
const restoration = useRef<Promise<LoginResponse | null> | null>(null);
useEffect(() => {
  let active = true;
  restoration.current ??= enqueue(restoreSession);
  void restoration.current.then((response) => {
    if (!active) return;
    setSession(response === null ? {
      user: null, points: null, accessToken: null,
    } : {
      user: {
        uuid: response.uuid,
        displayName: response.displayName,
        accountType: response.accountType,
      },
      points: response.availablePoints,
      accessToken: response.accessToken,
    });
  }).catch((error: unknown) => {
    if (!active) return;
    setSession({ user: null, points: null, accessToken: null });
    setRestoreError(error instanceof Error ? error.message : '로그인을 복원하지 못했습니다.');
  }).finally(() => {
    if (active) setIsRestoring(false);
  });
  return () => { active = false; };
}, [enqueue]);
```

로그아웃은 동일 queue에서 저장된 토큰을 읽고 POST /auth/logout을 시도하며 finally로 Refresh 저장과 메모리 세션을 삭제한다. Storage 삭제 오류가 있어도 메모리를 지우고 호출자에게 오류를 알린다. 통신 실패를 서버 세션 폐기 성공으로 보고하지 않는다.

### 완료 조건과 검증
- login.test.ts에 새 토큰 응답을 반영하고 입력 계정/URL/HTTP·통신 오류의 기존 검증을 유지한다.
- 재사용 탐지에 따른 갱신 401도 동일한 로컬 정리 경로를 타고 새 갱신 요청이나 자동 로그인 요청을 발생시키지 않는지 검증한다. 중복 복원/React Strict Mode에서 동시에 같은 Refresh를 전송하지 않는지 확인한다. 통신 실패 후 저장 유지가 그 토큰의 재사용 안전성을 보장하는 것은 아니며 다음 명시적 복원 시 401로 재로그인이 필요할 수 있음을 검증 범위에 적는다.
- session.test.ts에서 저장 완료 전 성공 미반영, 저장 없음, 복원 성공 시 토큰 교체, 401 삭제, 통신/5xx 저장 유지, 로그아웃 성공/실패 시 로컬 삭제, 저장/삭제 실패를 검증한다. 불필요한 UI snapshot이나 구현 문자열 비교는 추가하지 않는다.
- UserProvider 복원 중 상태, 로그인 경쟁, 로그아웃 뒤 후착 응답 방지는 의미 있는 동작 테스트 또는 기존 서버/기기에서 확인한다. Node 테스트는 네이티브 SecureStore 직접 실행 대신 최소한의 fake storage/fetch를 사용한다.
- 전체 프론트 checks를 통과하고 web에서 네이티브 SecureStore를 호출하지 않으며 ios/android export도 성공해야 한다.
- 실기기/에뮬레이터에서 로그인→앱 종료→재실행→사용자/포인트 복원→로그아웃을 확인한다. 기기가 없으면 미검증으로 명시하고 export 통과를 기기 검증으로 보고하지 않는다.
- 서버가 필요한 확인은 기존 8081/3000을 사용한다. 없으면 실패와 실행 명령을 안내하고 자동 시작하지 않는다. 프론트: npm --prefix front run start -- --port 8081, 백엔드: npm --prefix back run start:dev.
