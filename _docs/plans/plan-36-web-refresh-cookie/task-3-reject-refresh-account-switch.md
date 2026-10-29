# task-3-reject-refresh-account-switch

## 목표와 재현

리뷰 P1을 해결한다. 탭 1은 A의 사용자·Access를 메모리에 유지하지만, 탭 2가 B로 로그인하면 공유 Refresh 쿠키는 B의 것으로 바뀐다. 탭 1의 요청이 401을 받아 Refresh할 때 B 응답을 그대로 게시하면 A에서 시작한 구매나 시청기록 저장을 B의 Access로 재시도할 수 있다.

현재 사용자와 갱신 응답의 UUID가 다르면 로컬 세션 세대를 무효화하고 원 요청을 중단한다. 공유 쿠키나 B의 서버 세션을 삭제하는 logout은 호출하지 않는다. Access 삭제와 새 로그인 시 교체는 이미 구현돼 있으며, 이번 수정은 갱신으로 계정이 바뀌는 경계에 한정한다.

## 읽어야 할 파일

- `AGENTS.md`, `front/AGENTS.md`, `_docs/ARCHITECTURE.md`
- Expo 57 공식 문서 `https://docs.expo.dev/versions/v57.0.0/` (제품 코드 작성 전에 읽는다)
- `front/src/features/user/sessionClient.ts`
- `front/src/features/user/session.ts`
- `front/src/common/http/api.ts`
- `front/tests/unit/session.test.ts`
- `front/README.md`
- 이 계획의 `plan.md`, `task-2-front-cookie-session.md`

## 정확한 수정 파일

```text
front/src/features/user/sessionClient.ts
front/tests/unit/session.test.ts
front/README.md
```

`depends_on: ["task-2"]`. 다른 작업자가 함께 작업할 수 있으므로 기존 변경을 되돌리지 않는다. 지정 파일만 `apply_patch`로 수정한다. 계획 상태·Git 상태·백엔드·공통 HTTP 파일은 수정하지 않는다.

## 구현 경계와 주요 코드 예시

- 갱신 응답을 게시하기 전에 기존 version 검사를 유지하고, cookie 모드에서 현재 사용자가 있으면 UUID를 비교한다. Access 문자열은 정상 회전 때도 바뀌므로 계정 식별에 사용하지 않는다.
- 불일치하면 `clearSession(true)`로 version을 증가시키고 사용자·포인트·Access를 비운 뒤 `SessionChangedError`를 던진다. B의 응답을 현재 상태에 게시하지 않는다. 기존 만료 안내 흐름을 재사용한다.
- `expire()`나 서버 logout을 이용해 정리하지 않는다. 공유 쿠키는 B의 것이므로 이를 삭제하거나 서버 로그인을 폐기하면 다른 탭까지 영향을 준다.
- 초기화의 명시적 복원도 기존 로그인 사용자 A를 유지한 상태에서 B 응답을 받으면 같은 검사를 적용한다. 초기 익명 복원(user=null)은 B의 세션을 정상 복원한다. 오류를 잡는 initialize 경로가 세대 변경을 되돌리거나 B 정보를 게시하지 않게 한다.
- 명시적인 login을 통해 A에서 B로 전환하는 기존 동작은 유지한다. body 모드, 동일 UUID의 정상 회전, queue·Refresh 공유·늦은 응답 version 보호도 유지한다.
- 탭 간 메시지·BroadcastChannel·스토리지 동기화·새 UI·자동 재로그인은 추가하지 않는다. 최소한의 비교 로직을 사용하고 불필요한 추상화를 만들지 않는다.

갱신 결과 적용 지점의 예시이며 실제 코드의 중복을 최소화한다:

```ts
if (state.version !== version) throw new SessionChangedError();
if (refreshTransport === 'cookie' && state.user !== null &&
    response.uuid !== state.user.uuid) {
  clearSession(true);
  throw new SessionChangedError();
}
currentUserSession(response);
```

공통 HTTP client는 Refresh Promise가 실패하면 원 요청을 재시도하지 않는다. 이 기존 동작을 활용하고, 계정 변경 오류를 자동 Refresh 재시도 대상으로 바꾸지 않는다.

## 회귀 테스트

기존 `front/tests/unit/session.test.ts`에 재현 테스트를 먼저 추가한다. 수정 전 실제로 실패하고 수정 후 통과하는지 확인한다. HTTP API 서버의 동작 변경이 없으므로 새 Postman 테스트는 필요하지 않다.

1. cookie client를 A로 로그인시킨 뒤 공유 쿠키 fixture를 B로 바꾼다. A의 Access로 구매 POST 또는 시청기록 PUT을 보내 401을 받고, Refresh는 B의 UUID·Access·포인트를 반환하도록 한다. 원 요청이 `SessionChangedError`로 종료되고 B의 Access로 요청이 한 번도 재시도되지 않는지 검사한다.
2. version 증가, user/points/accessToken=null, sessionExpired=true, B 정보 미게시를 검사한다. 서버 logout과 JS Refresh 저장소 호출이 없고 B의 공유 쿠키 fixture가 유지되는지 확인한다.
3. 동시 요청 두 개가 같은 계정 전환 Refresh를 공유할 때 Refresh는 한 번이며 두 원 요청 모두 재시도하지 않는지 검사한다. 이전 version의 늦은 응답도 새 상태에 반영되지 않아야 한다.
4. 로그인된 A에서 명시적 initialize가 B를 반환하는 경우도 세대가 바뀌고 기존 A 요청이 중단되는지 검사한다. user=null인 새 client의 첫 복원은 B로 성공해야 한다.
5. 동일 UUID의 Refresh는 정상적으로 새 Access를 적용하고 원 요청을 한 번 재시도한다. 기존 native SecureStore, 명시적 login 전환, logout과 204 익명 테스트는 유지한다.

`front/README.md`에 다른 탭의 계정 전환 감지 시 해당 탭 인증 상태와 진행 요청을 종료한다는 동작을 짧게 기록한다. 실제 브라우저 검증과 fixture 테스트를 구분한다.

## 검증 및 완료 조건

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

세 checks와 위 회귀 테스트가 통과해야 한다. 실제 브라우저 수단이 있으면 기존 localhost:8081/3000 서버에서 두 탭 A→B 계정 전환도 확인한다. 수단이 없으면 미검증으로 명시한다. 서버를 자동 시작하거나 다른 포트로 우회하지 않는다. 서버가 필요하지만 없으면 실패로 보고하고 `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`를 안내한다. 토큰 원문을 출력하지 않는다.
