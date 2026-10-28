# POST /auth/refresh

Refresh JWT를 한 번 사용해 새 Access/Refresh 쌍으로 회전한다.

## 요청

`Content-Type: application/json`

```json
{"refreshToken":"<signed-refresh-jwt>"}
```

비어 있지 않은 문자열이어야 한다. Refresh 키의 HS256 서명, 용도, 클레임을 검증하며, 토큰 만료와 DB 만료를 모두 확인한다. 성공 시 login 응답과 같은 사용자·포인트·토큰 필드를 HTTP 200으로 반환한다.

## 회전 및 재사용

성공한 회전은 이전 이력을 보존하고 `used_at`을 기록한 뒤 같은 로그인에 새 해시 행을 추가한다. 사용한 토큰을 다시 제출하면 해당 로그인 전체를 폐기하고 일반 `AUTH_INVALID_TOKEN` 401을 반환한다. 폐기는 오류 응답 전에 커밋되며, 이후 그 로그인에서 발급한 최신 Refresh도 거부된다. 다른 로그인은 영향을 받지 않는다.

동시에 같은 Refresh를 사용하면 한 요청만 200이고 다른 요청은 401이며 재사용 탐지로 로그인이 폐기된다. 따라서 응답을 받지 못한 뒤 같은 Refresh를 재시도해도 성공이 보장되지 않으며, 재로그인이 필요할 수 있다. 만료된 과거 토큰도 유효한 서명과 이력이 있으면 재사용 탐지에 쓰이지만 새 토큰 발급에는 사용할 수 없다. 모든 Refresh 해시 이력은 삭제·교체하지 않는다.

## 오류

| HTTP | errorCode | errorName | 조건 |
| --- | --- | --- | --- |
| 400 | `AUTH_INVALID_TOKEN_INPUT` | `InvalidTokenInput` | body 또는 refreshToken 누락·공백·비문자열 |
| 401 | `AUTH_INVALID_TOKEN` | `InvalidToken` | 서명·용도·만료·사용자·이력 검증 실패 또는 재사용 탐지 |

DB 장애는 인증 실패로 바꾸지 않고 서버 오류로 처리한다.
