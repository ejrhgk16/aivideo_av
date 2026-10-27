# task-4-front-login-request

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/features/user/UserProvider.tsx`
- `front/src/features/drama/dramaContent.ts`
- `front/scripts/test-front.cjs`
- `front/tests/unit/homeContent.test.ts`
- `_docs/api/01-identity/login.md`
- Expo 57 문서: https://docs.expo.dev/versions/v57.0.0/ (제품 코드 작성 전 확인)

## 작업

task-1과 task-3 완료 후 실행한다. 변경 허용 파일은 다음 4개다. 다른 작업자의 변경을 되돌리지 않고 apply_patch로 수정한다.

- `front/src/features/user/login.ts`
- `front/src/features/user/useLogin.ts`
- `front/tests/unit/login.test.ts`
- `front/scripts/test-front.cjs`

login.ts는 `LoginInput = { loginId: string; password: string }`, `LoginResponse = User & { availablePoints: number }`와 `login(input): Promise<LoginResponse>`를 export한다. 사용자 타입은 UserProvider에서 type import로 재사용한다. EXPO_PUBLIC_API_BASE_URL을 확인한 뒤 끝 슬래시를 정리하고 JSON POST /auth/login을 요청한다. Content-Type은 application/json이며 입력값을 그대로 JSON 직렬화한다. 비밀번호를 trim하거나 로그에 출력하지 않는다. credentials·인증 헤더·임의 admin 응답을 추가하지 않는다. 환경값 누락, 네트워크 실패, non-2xx 응답은 오류로 전달한다.

useLogin.ts는 useUser를 호출하고 반환 함수에서 LoginInput을 받는다. 로그인 성공 후 응답에서 availablePoints를 분리하고 `setUser(user, availablePoints)`를 한 번 호출하여 사용자·로그인 초기 잔액을 함께 반영한다. 훅의 반환 함수는 전체 응답을 반환하며 실패는 호출자에게 전달한다. 실패 전에 사용자·포인트 상태를 지우지 않는다. 별도의 로그인 상태 저장소·복잡한 요청 추상화·자동 재시도는 추가하지 않는다.

스크린이나 버튼을 생성하지 않는다. 루트·기존 스크린에서 훅을 호출해 자동 로그인하지 않는다. API 요청 함수 안에서 useContext/useUser를 호출하지 않는다. setUser 다음에 이전 PointsScope의 setBalance를 호출하면 갱신이 유실되므로 그렇게 구현하지 않는다. task-1의 원자적 초기화 계약으로 새 Provider가 ready/실제 잔액을 받는다. 동일 admin 재로그인도 revision 변경으로 최신 잔액을 반영한다.

### 주요 로직 코드 또는 변경 예시

```ts
// login.ts
import type { User } from './UserProvider';

export interface LoginInput { loginId: string; password: string }
export type LoginResponse = User & { availablePoints: number };

export async function login(input: LoginInput): Promise<LoginResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to log in.');
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) throw new Error(`Failed to log in: ${response.status}`);
  return (await response.json()) as LoginResponse;
}
```

```ts
// useLogin.ts
import { useCallback } from 'react';
import { login, type LoginInput } from './login';
import { useUser } from './UserProvider';

export function useLogin() {
  const { setUser } = useUser();
  return useCallback(async (input: LoginInput) => {
    const response = await login(input);
    const { availablePoints, ...user } = response;
    setUser(user, availablePoints);
    return response;
  }, [setUser]);
}
```

이 예시는 UserProvider의 export 이름을 기준으로 한다. task-1 구현 이름이 다르면 해당 계약에 맞춘다. 외부 라이브러리나 런타임 validation 계층을 추가하지 않고 기존 내부 API 요청 스타일을 따른다.

테스트는 기존 node:test 방식으로 fetch와 환경값을 임시 교체하고 반드시 복원한다. URL 조합(끝 슬래시 포함), POST·JSON Content-Type·입력 본문 전달(비밀번호 공백 보존), 실제 잔액을 포함한 응답 반환(0 포함), 환경 누락 시 fetch 미호출, HTTP 400/401/404 및 네트워크 오류 전달을 검증한다. 실제 비밀 대신 테스트 문자열을 사용한다. test-front.cjs에 login.test.ts를 추가하되 task-1의 pointsState.test.ts와 기존 목록을 보존한다. 타입 import가 UserProvider.tsx로 이어지면 tsc 호출에 필요한 `--jsx react-jsx` 옵션만 추가한다. 타입 전용 import 때문에 테스트 런타임에 Expo/React Native를 로드하지 않게 한다.

훅은 성공 응답 이후에만 setUser가 실행되는지 코드 검토하고 typecheck로 계약을 확인한다. API 요청 단위 테스트만으로 훅의 실제 렌더·Context 갱신을 검증했다고 보고하지 않는다. 새 테스트 프레임워크·렌더러를 도입하지 않는다.

검증 명령:
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 호출자가 useLogin()의 반환 함수에 loginId/password를 전달해 실행하면 사용자와 실제 잔액이 함께 반영되는 경로가 준비된다. 초기 로그인·동일 admin 재로그인 시 포인트가 유실되지 않는지 코드 검토하고 순수 초기화 테스트로 0/일반 잔액을 확인한다. 요청 테스트와 타입 검사·export가 통과하고 기존 테스트가 유지된다. 화면·자동 로그인·영구 저장·별도 포인트 조회 API는 추가하지 않는다.
