# task-1-backend-refresh-cookie

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `back/src/identity/loginController.ts`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/common/http/webCors.ts`
- `back/src/common/error/error.filter.ts`
- `back/test/unit/loginController.spec.ts`
- `back/test/api/README.md`
- `back/test/api/public.postman_collection.json`
- `_docs/api/00-overview/authentication.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/01-identity/login.md`
- `_docs/api/01-identity/refresh.md`
- `_docs/api/01-identity/logout.md`

## 작업

웹용 HttpOnly Refresh 쿠키 모드를 기존 인증 endpoint에 추가한다. 파일 소유권은 아래 목록에 한정한다. 다른 작업자가 함께 작업할 수 있으므로 기존 변경을 되돌리지 말고 현재 코드에 맞춰 적용한다. 제품 코드는 `apply_patch`로만 수정한다.

### 정확한 수정 파일

```text
back/src/identity/loginController.ts
back/src/identity/refreshCookie.ts
back/src/common/http/webCors.ts
back/test/unit/loginController.spec.ts
back/test/unit/refreshCookie.spec.ts
back/test/api/public.postman_collection.json
back/test/api/README.md
back/README.md
_docs/api/01-identity/login.md
_docs/api/01-identity/refresh.md
_docs/api/01-identity/logout.md
_docs/api/00-overview/authentication.md
_docs/api/00-overview/conventions.md
_docs/ARCHITECTURE.md
```

### 인증 전송 계약

- endpoint 경로는 유지한다. 웹은 세 요청 모두 `X-Auth-Transport: cookie`, `Content-Type: application/json`, 브라우저의 `Origin`을 사용한다. login body는 기존 계정 정보, refresh/logout body는 `{}`다.
- `Origin` 또는 `X-Auth-Transport`가 있는 요청은 쿠키 모드로 검증한다. 정확한 모드 헤더와 allowlist에 일치하는 Origin이 모두 있어야 한다. 미허용 Origin, `null` Origin, 헤더 누락·잘못된 값은 서비스 호출 전에 `ForbiddenException`(403)으로 거부한다. CORS만을 CSRF 방어로 간주하지 않는다. 로그인에도 동일한 검사를 적용한다.
- Origin과 모드 헤더가 모두 없는 요청은 기존 네이티브 body 방식이다. 쿠키를 인증 원천으로 사용하지 않는다. 기존 body 입력 검증·상태 코드·응답 필드와 재사용 탐지 테스트를 유지한다.
- 쿠키 모드에서는 body의 Refresh를 대체 인증 수단으로 사용하지 않는다. 쿠키는 서버가 직접 읽고 설정한다. 쿠키 모드 응답 JSON에는 `refreshToken`을 제외한 기존 사용자·포인트·Access·expiresIn만 반환한다.
- Refresh 쿠키가 전혀 없는 웹 refresh는 `204`로 응답한다. 이는 최초 방문/로그아웃 후 익명 복원이며 401과 구분한다. 웹 logout도 쿠키가 없으면 삭제 헤더와 함께 204다. 네이티브의 토큰 누락 400은 유지한다.
- 쿠키가 존재하지만 비어 있거나 잘못된 인코딩·형태이면 익명 204로 숨기지 말고 `AUTH_INVALID_TOKEN` 401로 처리하고 쿠키를 삭제한다. JWT 검증은 기존 TokenService에 위임한다.
- 웹 refresh 401은 쿠키를 삭제하고 기존 오류를 전파한다. 네트워크/DB 5xx를 401로 바꾸거나 쿠키를 삭제하지 않는다. 유효한 쿠키 모드 logout은 성공 여부와 무관하게 쿠키 삭제를 시도하며, 서버 폐기 실패는 성공으로 바꾸지 않는다.
- 모든 인증 응답에는 `Cache-Control: no-store`를 설정한다. 원문 토큰이나 Cookie 헤더를 로그에 기록하지 않는다.

### 쿠키와 CORS의 정확한 설정

- 쿠키 이름 `auth.refreshToken`, `HttpOnly: true`, `Path: /auth`, `SameSite: Lax`, host-only(Domain 미설정), `Max-Age: 1209600`초(Express `maxAge`는 `1209600000`ms).
- `Secure`는 `NODE_ENV === 'production'`일 때 true로 설정한다. 운영은 HTTPS로 제공한다. dev localhost HTTP는 false다. 쿠키 삭제는 같은 이름·Path·SameSite·Secure·Domain 조건을 사용하며 남은 수명을 제거한다.
- `WEB_CORS_ORIGINS`를 쉼표 구분 정확한 origin 목록으로 도입한다. 공백 제거·빈 항목 제외 후 검사하며 와일드카드/부분 문자열 비교를 사용하지 않는다. 미설정 개발 기본값은 기존 `http://localhost:8081`, 운영 미설정은 빈 allowlist로 브라우저 쿠키 인증을 거부한다. 운영에 localhost를 자동 허용하지 않는다.
- CORS와 컨트롤러의 Origin 검증은 같은 allowlist 함수를 사용한다. 함수 호출 시 설정을 읽어 기존 AppModule의 환경 로드와 일치시키고 import 시점의 미로딩 환경을 고정하지 않는다.
- 허용 Origin에만 정확한 `Access-Control-Allow-Origin`과 `Access-Control-Allow-Credentials: true`를 반환한다. OPTIONS에서 `content-type`, `authorization`, `x-auth-transport`를 허용한다. 현재 CORS 테스트도 갱신한다.
- 운영 가정은 `https://app.example.com`/`https://api.example.com` 같은 같은 사이트의 HTTPS 또는 동일 origin 프록시다. 다른 사이트 간 쿠키, 별개 `*.vercel.app` 프로젝트 간 쿠키 공유, `Domain=vercel.app`, 임의 Origin 반사는 지원으로 약속하지 않는다.
- 서버리스 인스턴스에 세션/토큰을 보관하지 않는다. 기존 TokenService/DB 트랜잭션과 JWT 시크릿 관리는 그대로 사용한다. 새 패키지나 DB 변경을 도입하지 않는다.

### 주요 로직 코드 또는 변경 예시

아래는 기존 컨트롤러에 연결할 핵심 흐름이다. helper는 새 `refreshCookie.ts`에, allowlist 함수는 기존 `webCors.ts`에 둔다. 기존 body 검증과 서비스 주입을 유지하고 Express Request/Response를 type import한다. 실제 메서드에는 Nest `@Req()`, `@Res({ passthrough: true })`, 기존 `@Body()`를 연결한다.

```ts
// refreshCookie.ts: Origin 검사 자체는 CORS와 별도로 항상 수행한다.
export function usesRefreshCookie(request: Request): boolean {
  const origin = request.get('origin');
  const transport = request.get('x-auth-transport');
  if (origin === undefined && transport === undefined) return false;
  if (transport !== 'cookie' || origin === undefined ||
      !getWebCorsOrigins().includes(origin)) {
    throw new ForbiddenException();
  }
  return true;
}

// 쿠키 모드 성공 응답: 서버에만 Refresh 원문이 남고 JSON에는 제외한다.
function webSession<T extends { refreshToken: string }>(session: T, response: Response) {
  response.cookie('auth.refreshToken', session.refreshToken, refreshCookieOptions());
  const { refreshToken, ...publicSession } = session;
  return publicSession;
}

// LoginController.refresh의 핵심 흐름
async refresh(body: unknown, request: Request, response: Response) {
  response.setHeader('Cache-Control', 'no-store');
  const cookieMode = usesRefreshCookie(request);
  if (!cookieMode) return this.tokenService.refresh(this.readRefreshToken(body));
  try {
    const refreshToken = readRefreshCookie(request);
    if (refreshToken === null) {
      response.status(204);
      return;
    }
    const session = await this.tokenService.refresh(refreshToken);
    return webSession(session, response);
  } catch (error) {
    if (error instanceof InvalidTokenException) clearRefreshCookie(response);
    throw error;
  }
}

// LoginController.login: 기존 입력 검사 전에 전송 모드 검증, 성공 후 분기
const cookieMode = usesRefreshCookie(request);
const session = await this.loginService.login(validatedInput);
return cookieMode ? webSession(session, response) : session;

// LoginController.logout: 모드 검증은 finally 밖, 쿠키 삭제는 안쪽
const cookieMode = usesRefreshCookie(request);
if (!cookieMode) {
  await this.tokenService.logout(this.readRefreshToken(body));
  return;
}
try {
  const refreshToken = readRefreshCookie(request);
  if (refreshToken !== null) await this.tokenService.logout(refreshToken);
} finally {
  clearRefreshCookie(response);
}
```

`readRefreshCookie`는 `request.headers.cookie`에서 정확한 쿠키 이름만 읽는다. cookie-parser 미들웨어가 있다고 가정하지 않는다. absent와 invalid를 구분하며 decode 실패는 InvalidTokenException으로 변환한다. `response.cookie`/`clearCookie`는 현재 Express 어댑터를 사용한다. 코드 예시는 전체 파일 복사 지시가 아니며 기존 검사/장식자/반환 타입에 맞게 최소한으로 통합한다.

### 테스트와 문서

- Postman 실제 POST로 웹 login → Cookie로 refresh → 회전 쿠키로 logout → cookie 없는 refresh 204를 검증한다. `Set-Cookie`의 HttpOnly·SameSite·Path·Max-Age, no-store, JSON Refresh 비노출, 회전, 로그아웃 후 이전 쿠키 거부도 확인한다.
- 미허용 Origin, 모드 헤더/Origin 누락·불일치, body Refresh로 쿠키 인증을 우회하는 요청, 위조/빈 쿠키 401, refresh 요청에 Access를 쿠키로 넣는 경우를 검사한다. 미허용 요청 이후 정상 Refresh가 여전히 동작하는지 확인해 세션이 회전·폐기되지 않았음을 검증한다.
- 기존 네이티브 JSON 시나리오와 CORS preflight를 유지한다. Postman cookie jar가 네이티브/웹 테스트를 오염시키지 않도록 모드별 cookie 사용을 명시하고 생성한 세션을 정리한다. 브라우저 HttpOnly/전송 차단까지 Postman으로 입증했다고 쓰지 않는다.
- `loginController.spec.ts`는 변경된 메서드 매개변수와 async 형태에 맞게 기존 테스트를 수정한다. HTTP 동작의 새로운 주 검증은 Postman에 둔다.
- `refreshCookie.spec.ts`는 운영/개발 옵션·환경 기본값, 쿠키 파싱의 absent/invalid, 운영 allowlist 미설정처럼 환경 변경이 필요한 내부 경계를 최소한으로 검증한다. 변경한 환경 변수를 원복한다.
- 인증 문서 3종과 전체 인증/공통 규칙에 요청 모드·응답 필드·204/400/401/403·403의 Nest 기본 오류 형식·캐시·CORS·노출 규칙을 정확히 기록한다. 기존 커스텀 인증 오류 형식은 유지한다.
- `_docs/ARCHITECTURE.md`의 웹 메모리 전용 Refresh 설명을 쿠키 전송·저장·복원 구조로 갱신한다. task-2가 뒤따라 구현할 계약임을 task 결과에서 명시한다.
- `back/README.md`에 `WEB_CORS_ORIGINS` 설정, Secure/SameSite/도메인 전제와 Vercel에서도 공유 DB·동일 시크릿을 사용한다는 운영 조건을 기록한다. 실제 .env는 수정하거나 출력하지 않는다. `back/test/api/README.md`에는 웹 쿠키 테스트와 한계를 추가한다.
- 유효한 Refresh의 동시 사용과 응답 유실은 기존 정책에 따라 재로그인을 요구할 수 있음을 유지한다. 이번 작업에서 TokenService를 수정하거나 재사용 탐지를 완화하지 않는다.

### 검증 명령 및 완료 조건

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

기존 `http://localhost:3000`에 HTTP로 연결하고 변경 코드 반영을 확인한 뒤 전체 테스트를 실행한다. 테스트는 `back/test/api/README.md`의 기존 MySQL 데이터와 기본 fixture 준비·정리 절차를 사용한다. DB reset/seed를 실행하지 않는다. 서버가 없으면 검증 실패와 `npm --prefix back run start:dev` 실행 안내를 출력한다. 현재 코드 반영 확인이 불가능하면 사용자에게 확인한다. 서버를 추가로 띄우거나 포트를 바꾸지 않는다.

완료 조건: 세 checks가 모두 통과하고 웹 쿠키 수명주기·CSRF·CORS·네이티브 회귀의 실제 HTTP 증거와 일치하는 문서를 남긴다. 운영 Secure 옵션은 단위 테스트로 확인하며 로컬 HTTP 테스트를 HTTPS 배포 검증이라고 보고하지 않는다.
