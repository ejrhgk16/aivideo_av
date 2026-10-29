# POST /auth/logout

Refresh JWT 이력이 연결된 로그인 전체를 폐기한다.

네이티브는 Refresh를 JSON body로 전달한다. 웹은 `Origin`과 `X-Auth-Transport: cookie` 헤더를 보내고 서버가 HttpOnly `auth.refreshToken` 쿠키를 읽는다. 웹 body는 `{}`이며 body Refresh로 쿠키를 대체하지 않는다. 모든 응답은 `Cache-Control: no-store`다.

## 요청

`Content-Type: application/json`

```json
{"refreshToken":"<signed-refresh-jwt>"}
```

만료되지 않았고 서명과 용도가 유효한 Refresh JWT가 필요하다. 이미 사용된 이력 토큰으로도 해당 로그인을 폐기할 수 있다. 같은 사용자의 다른 로그인은 유지된다.

## 성공 응답 — 204

본문이 없다. 이미 폐기된 로그인이나 유효한 토큰 이력이 없는 경우에도 204로 응답해 로그아웃을 멱등하게 처리한다. 만료 토큰은 401이다.

웹에서 쿠키가 없으면 익명 로그아웃으로 204와 쿠키 삭제 헤더를 반환한다. 쿠키가 있으면 서버 폐기 시도 후 성공 여부와 관계없이 같은 이름·Path·SameSite·Secure 속성으로 쿠키를 만료한다. 서버 폐기 오류는 성공으로 숨기지 않는다. 웹 요청의 모드 헤더 또는 Origin이 누락·잘못됐으면 서비스 호출 전에 403이다. 네이티브의 토큰 누락은 기존 400이다.

로그아웃은 Refresh만 막는다. 이미 발급한 Access JWT는 별도 폐기 목록을 조회하지 않으므로 최대 15분 더 유효할 수 있다. 과거 Refresh를 재사용하기 전에는 공격자의 최초 사용을 식별할 수 없다.

## 오류

| HTTP | errorCode | errorName | 조건 |
| --- | --- | --- | --- |
| 400 | `AUTH_INVALID_TOKEN_INPUT` | `InvalidTokenInput` | body 또는 refreshToken 누락·공백·비문자열 |
| 401 | `AUTH_INVALID_TOKEN` | `InvalidToken` | 서명·용도·만료·소유자 검증 실패 |
