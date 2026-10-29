# POST /auth/login

`loginId`와 비밀번호를 확인하고 사용자 요약과 Access/Refresh 토큰 쌍을 반환한다. 웹 쿠키 모드에서는 Refresh 원문을 JSON에 넣지 않고 HttpOnly 쿠키로 설정한다.

## 요청

`Content-Type: application/json`

```json
{
  "loginId": "admin",
  "password": "admin"
}
```

두 필드는 공백뿐인 값을 허용하지 않는다. `loginId`는 100자 이하여야 한다. 제공된 자격 증명 자체를 확인하며, 개발 시드 계정은 admin/admin이다.

네이티브 요청은 전송 헤더 없이 기존 JSON 계약을 사용한다. 웹 요청은 다음 헤더와 함께 기존 credentials JSON을 보낸다.

```http
Origin: http://localhost:8081
X-Auth-Transport: cookie
Content-Type: application/json
```

Origin은 `WEB_CORS_ORIGINS`의 정확한 항목이어야 한다. 쿠키 모드에서는 `auth.refreshToken`을 HttpOnly·SameSite=Lax·Path=/auth·14일로 설정한다. `Secure`는 production에서만 설정하며 Domain은 지정하지 않는다.

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

사용자·지갑을 조회하며 지갑이 없으면 `availablePoints`는 `0`이다. 비밀번호, 내부 숫자 `id`, 사용자 상태는 응답하지 않는다. Access JWT는 HS256, `sub` 사용자 UUID, `tokenType: "access"`, 900초 만료다. Refresh JWT는 별도 HS256 키, `sub`, `tokenType: "refresh"`, 고유 `jti`, 1,209,600초(14일) 만료를 사용한다. `expiresIn`은 Access 만료 초다. DB에는 SHA-256 해시만 저장한다. 네이티브 JSON 모드는 두 토큰을 응답하며, 웹 쿠키 모드는 응답에서 `refreshToken`을 제외하고 쿠키로 전달한다. 두 모드 모두 `Cache-Control: no-store`를 반환한다.

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

전송 모드 헤더 또는 Origin이 있는 요청은 웹 쿠키 모드로 검증한다. 둘 중 하나라도 누락되거나 Origin이 allowlist와 일치하지 않으면 서비스 호출 전에 NestJS 기본 `ForbiddenException` 형식의 403을 반환한다. 두 헤더가 모두 없으면 기존 네이티브 모드다.
