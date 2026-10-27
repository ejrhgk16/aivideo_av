# POST /auth/login

사용자의 loginId와 비밀번호를 확인하고 사용자 식별 정보 및 포인트 잔액을 반환한다.

## 요청

`Content-Type: application/json`

```json
{
  "loginId": "admin",
  "password": "admin"
}
```

두 필드는 공백뿐인 값을 허용하지 않는다. `loginId`는 100자 이하여야 한다.

## 성공 응답 — 200

```json
{
  "uuid": "00000010-0000-4000-8000-000000000001",
  "displayName": "admin",
  "accountType": "OPERATOR",
  "availablePoints": 100
}
```

사용자·지갑을 한 번의 DB 조회로 읽는다. 지갑이 없으면 `availablePoints`는 `0`이다. 비밀번호, 내부 숫자 `id`, 사용자 상태는 응답하지 않는다. 토큰이나 세션 쿠키는 발급하지 않는다.

현재 개발 단계에서는 컨트롤러가 요청 형식을 검증한 뒤 서비스 입력을 `admin` / `admin`으로 치환한다. 따라서 형식이 유효한 요청은 개발 시드 admin 계정으로 처리된다. 이 두 임시 대입문을 제거하면 요청의 loginId와 password로 사용자를 확인한다.

## 오류

오류 응답은 `{ errorCode, errorName, statusCode, timestamp, path }` 형식이다.

| HTTP | errorCode | errorName | 조건 |
| --- | --- | --- | --- |
| 400 | `AUTH_INVALID_LOGIN_INPUT` | `InvalidLoginInput` | 필드 누락, 공백 값, 문자열이 아닌 값, 100자를 넘는 loginId |
| 401 | `AUTH_LOGIN_FAILED` | `LoginFailed` | DB에서 일치하는 활성 사용자를 찾지 못함 |

예시:

```json
{
  "errorCode": "AUTH_INVALID_LOGIN_INPUT",
  "errorName": "InvalidLoginInput",
  "statusCode": 400,
  "timestamp": "2026-10-27T00:00:00.000Z",
  "path": "/auth/login"
}
```
