# task-7-identity-response-types

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/test/api/README.md`
- `_docs/api/00-overview/response-compatibility.md`
- `_docs/plans/plan-46-api-response-contracts/task-2-backend-response-types.md`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/refreshCookie.ts`
- `back/test/unit/loginController.spec.ts`
- `back/test/unit/refreshCookie.spec.ts`
- `back/test/unit/identity/tokenService.spec.ts`

## 작업

- 새 `identityResponses.ts`에 SessionFields(uuid, displayName, accountType, availablePoints, accessToken, expiresIn), NativeSessionResponse, WebSessionResponse를 type으로 정의한다. displayName은 string|null, accountType은 현재 타입을 유지하며 임의 enum 강제/캐스팅은 하지 않는다.
- NativeSessionResponse는 refreshToken:string이 필수이며 WebSessionResponse는 `Omit<NativeSessionResponse,'refreshToken'>`이다. 공개 응답에 refreshExpiresAt, DB id, password를 넣지 않는다.
- LoginService.login, TokenService.refresh에 `Promise<NativeSessionResponse>`, LoginController.login에 `Promise<NativeSessionResponse | WebSessionResponse>`를 명시한다.
- LoginController.refresh는 쿠키 없는 204 분기에 맞춰 `Promise<NativeSessionResponse | WebSessionResponse | void>`다. logout의 `Promise<void>`는 그대로 유지한다.
- refreshCookie.ts의 webSession<T extends {refreshToken:string}> 반환을 `Omit<T,'refreshToken'>`으로 명시한다. 생성/갱신/쿠키 설정·삭제/캐시 제어/Refresh 회전과 strict replay 의미를 바꾸지 않는다.
- generateTokens의 내부 반환을 명시하려면 tokenService.ts 내부 GeneratedTokens type으로 두며 refreshExpiresAt:Date를 API 응답과 구분한다. 내부 RefreshClaims/LoginInput을 스타일 때문에 변환하지 않는다.
- 정확한 SessionFields 정의는 `{ uuid:string;displayName:string|null;accountType:string;availablePoints:number;accessToken:string;expiresIn:number }`다. 런타임 반환 객체는 기존 그대로다.

### 변경 성격과 경계

새 런타임 로직은 없다. 현재 응답의 type 선언 위치·이름·type import와 메서드 반환 annotation만 정리한다. 성공 JSON의 키·값·배열 순서·nullable/optional·HTTP 상태를 바꾸지 않고 data wrapper를 추가하지 않는다.

동시에 다른 worker가 별도 도메인을 수정한다. 다른 worker의 변경을 되돌리지 않으며, 새로 생성 중인 다른 도메인의 Responses 파일을 import하지 않는다. Entity와 기존 공통 mediaUrl 등 변경하지 않는 파일은 읽을 수 있다. 도메인별 응답은 각 파일에서 독립 정의하고 신규 범용 응답 추상화를 만들지 않는다.

공통 `_docs/ARCHITECTURE.md`, API 문서·컬렉션은 수정하지 않는다. Architecture 갱신과 HTTP 보존 검증은 모든 도메인 작업 이후 task-2가 담당하고, 오류 API 문서·컬렉션 변경은 task-3이 담당한다. 이 task는 정확히 선언된 기존 단위 테스트를 `--no-cache`로 실행한다. 병렬 worker가 아직 파일을 편집하는 동안 back build/전체 tsc/실제 HTTP suite를 임의 실행하지 않는다. 컴파일과 HTTP 확인은 task-2의 의존성으로 보장하며, 이 task의 단위 테스트만으로 API 응답 보존을 통과했다고 보고하지 않는다.

### 수정 허용 파일

- `back/src/identity/identityResponses.ts`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/refreshCookie.ts`

### 검증과 영향 범위

~~~text
npm --prefix back run test:unit -- --no-cache test/unit/loginController.spec.ts test/unit/refreshCookie.spec.ts test/unit/identity/tokenService.spec.ts
~~~

선택 테스트는 이 task가 편집하는 컨트롤러·서비스 또는 공개/환경/응답 내부 경계의 기존 소비 테스트다. 테스트 파일은 읽기·실행만 하므로 files에 넣지 않는다. Vitest의 결과 캐시를 끄고 coverage/report/snapshot을 생성하지 않는다. 다른 worker와 테스트 파일·제품 편집 파일이 겹치지 않으며 DB fixture도 사용하지 않는다.

최종 HTTP 소비 검사: task-2의 `identity` suite. 모든 도메인 선언이 완성된 뒤 기존 3000 서버가 변경 코드를 반영한 것을 확인하고 task-1의 strict assertion을 그대로 실행한다.

### 의존성과 완료 조건

- depends_on: `["task-1"]`. task-1이 기존 API에서 strict baseline을 통과시키기 전 실행하지 않는다.
- task-5/6/7/8/9는 편집 파일이 겹치지 않아 병렬 후보이며 Harness는 최대 3개 worker씩 실행한다. 이 task에서 worker를 직접 생성하지 않는다.
- 현재 응답 구조를 바꾸지 않고 선언을 정리했으며 명시한 단위 테스트가 통과한다.
- 공통 빌드·HTTP 검증은 task-2에 남아 있음을 완료 요약에 명시한다. 컴파일을 통과시키려고 any/강제 캐스팅/필드 optional 처리로 숨기지 않는다.
