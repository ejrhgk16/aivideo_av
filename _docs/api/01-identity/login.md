# POST /auth/login

`loginId`와 비밀번호를 확인하고 사용자 요약과 Access/Refresh 토큰 쌍을 반환한다.

## 요청

`Content-Type: application/json`

```json
{
  "loginId": "admin",
  "password": "admin"
}
```

두 필드는 공백뿐인 값을 허용하지 않는다. `loginId`는 100자 이하여야 한다. 제공된 자격 증명 자체를 확인하며, 개발 시드 계정은 admin/admin이다.

## 성공 응답 — 200

```json
{
  "uuid": "00000010-0000-4000-8000-000000000001",
  "displayName": "admin",
  "accountType": "OPERATOR",
  "availablePoints": 100,
  "accessToken": "<signed-jwt>",
  "refreshToken": "<signed-jwt>",
  "expiresIn": 900
}
```

사용자·지갑을 조회하며 지갑이 없으면 `availablePoints`는 `0`이다. 비밀번호, 내부 숫자 `id`, 사용자 상태는 응답하지 않는다. Access JWT는 HS256, `sub` 사용자 UUID, `tokenType: "access"`, 900초 만료다. Refresh JWT는 별도 HS256 키, `sub`, `tokenType: "refresh"`, 고유 `jti`, 1,209,600초(14일) 만료를 사용한다. `expiresIn`은 Access 만료 초다. 원문 토큰은 응답에만 반환되며 DB에는 SHA-256 해시만 저장한다. Refresh는 클라이언트가 안전한 로컬 저장소에 보관해야 한다.

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
