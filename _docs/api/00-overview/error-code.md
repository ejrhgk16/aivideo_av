# 프론트 API 오류 처리

프론트에서 API 오류를 처리하거나 코드를 추가할 때 이 문서를 먼저 읽는다. 서버 응답 계약은 [공통 규칙](conventions.md), 인증 계약은 [인증 방식](authentication.md)을 따른다.

## 코드 책임

| 파일 | 책임 |
| --- | --- |
| [api.ts](../../../front/src/common/http/api.ts) | `readApiError`로 오류 파싱, API 요청의 자동 갱신·재시도 조건 검사 |
| [errorMessages.ts](../../../front/src/common/http/errorMessages.ts) | `getErrorMessage`로 사용자 안내 선택 |
| [session.ts](../../../front/src/features/user/session.ts) | 같은 파서를 사용하는 Refresh·로그아웃 요청과 네이티브 저장 토큰 정리 |
| [sessionClient.ts](../../../front/src/features/user/sessionClient.ts) | 동시 갱신 공유, 세션 만료, 계정 전환 제어 |

`readApiError`는 실제 HTTP 상태와 문자열 `errorCode`만 `ApiError`에 담는다. 본문의 `statusCode`가 달라도 HTTP 상태를 우선한다. 본문이 없거나 JSON이 잘못됐거나 문자열 코드가 없으면 코드는 `null`이다. 서버의 message·stack을 안내로 노출하지 않는다.

## 업무 코드별 안내

알려진 업무 코드가 HTTP 상태별 안내보다 우선한다.

| errorCode | 안내 문구 |
| --- | --- |
| `AUTH_INVALID_LOGIN_INPUT` | 로그인 정보를 확인해 주세요. |
| `AUTH_LOGIN_FAILED` | 아이디 또는 비밀번호를 확인해 주세요. |
| `AUTH_INVALID_TOKEN_INPUT` | 인증 요청을 확인해 주세요. |
| `AUTH_INVALID_TOKEN` | 로그인이 만료됐어요. 다시 로그인해 주세요. |
| `EPISODE_ACCESS_DENIED` | 이 회차를 이용할 권한이 없습니다. |
| `POINT_INSUFFICIENT_BALANCE` | 보유 포인트가 부족합니다. |
| `POINT_USER_NOT_FOUND` | 사용자 정보를 찾을 수 없습니다. |
| `POINT_WALLET_NOT_FOUND` | 포인트 지갑을 찾을 수 없습니다. |
| `POINT_EPISODE_NOT_FOUND` | 회차 정보를 찾을 수 없습니다. |
| `POINT_INVALID_INCREASE` | 포인트 지급 값을 확인해 주세요. |
| `POINT_BALANCE_OVERFLOW` | 포인트 한도를 초과했습니다. |
| `POINT_IDEMPOTENCY_CONFLICT` | 요청이 이미 처리 중입니다. 잠시 후 다시 시도해 주세요. |

## 코드가 없거나 모르는 경우

| HTTP 상태 / 공통 코드 예시 | 안내 문구 |
| --- | --- |
| 400 / `HTTP_BAD_REQUEST` | 요청 정보를 확인해 주세요. |
| 401 / `HTTP_UNAUTHORIZED` | 로그인이 필요합니다. |
| 403 / `HTTP_FORBIDDEN` | 이 요청을 수행할 권한이 없습니다. |
| 404 / `HTTP_NOT_FOUND` | 요청한 정보를 찾을 수 없습니다. |
| 409 / `HTTP_CONFLICT` | 요청 상태가 변경됐습니다. 다시 확인해 주세요. |
| 5xx / `INTERNAL_SERVER_ERROR`, `HTTP_SERVICE_UNAVAILABLE` | 서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요. |
| 그 외 HTTP 상태 | 요청을 처리하지 못했습니다. 다시 시도해 주세요. |
| `ApiError`가 아닌 오류 | 네트워크 연결을 확인하고 다시 시도해 주세요. |

## 갱신·세션 정리

- Access를 보낸 요청의 **401 + `AUTH_INVALID_TOKEN`**만 자동 Refresh한다. 동시 요청은 갱신을 공유하고 각 원 요청을 한 번 재시도한다. 같은 인증 오류가 반복되면 세션 만료를 알린다.
- 공개·익명 요청, 일반 401, `AUTH_LOGIN_FAILED`, 403, 5xx, 비JSON 오류, 네트워크 오류에는 자동 Refresh하지 않는다. Refresh 자체도 자동 재시도하지 않는다.
- 자동 갱신이 네트워크·서버 오류 등으로 실패하면 저장 토큰을 유지하고 새 로그인 또는 명시적 복원까지 자동 갱신을 막는다. 계정·세션 버전이 바뀌면 요청을 중단한다.
- 네이티브 `restoreSession`은 Refresh의 HTTP 401이면 저장 토큰을 삭제한다. 세션 만료 신호의 `401 AUTH_INVALID_TOKEN` 조건과 구분한다. 웹 HttpOnly 쿠키는 서버와 브라우저가 관리한다.
- 화면은 공통 안내와 자신의 재시도·구매 설명을 조합한다. 세션 만료 모달은 로그인 버튼을 눌렀을 때만 `/login`으로 이동한다.

## 변경 시 확인

오류 파싱·안내·갱신 규칙을 바꾸면 이 문서와 [api.test.ts](../../../front/tests/unit/api.test.ts), [errorMessages.test.ts](../../../front/tests/unit/errorMessages.test.ts), [session.test.ts](../../../front/tests/unit/session.test.ts)를 함께 맞춘다.
