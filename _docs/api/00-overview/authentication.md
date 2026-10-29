# 전체 인증 방식

로그인부터 프론트 저장·복원, 토큰 갱신·폐기, API 접근 정책까지의 기준 문서다. 개별 요청·응답의 상세 필드는 [로그인](../01-identity/login.md), [갱신](../01-identity/refresh.md), [로그아웃](../01-identity/logout.md) 정의서를 따른다.

## 구현 상태

| 항목 | 상태 |
| --- | --- |
| 로그인 및 Access/Refresh JWT 발급 | 구현됨 |
| Refresh Token Rotation(RTR) 및 재사용 탐지 | 구현됨 |
| 로그아웃 시 해당 로그인 Refresh 폐기 | 구현됨 |
| 네이티브 보안 저장, 앱 시작 시 로그인 복원 | 구현됨. 실기기 검증은 미완료 |
| Access용 Passport Strategy 및 필수·선택 Guard | 구현됨 |
| 작품 상세·회차 재생의 선택 인증 | 구현됨. `Authorization`이 있으면 Access JWT 검증 |
| 포인트 지급·회차 구매의 필수 인증 | 구현됨. `/me` 경로에서 JWT 사용자 사용 |
| 앱 실행 중 Access 만료 시 동시 갱신 공유·원래 요청 1회 재시도 | 구현됨 |
| 공통 오류 코드 안내·세션 만료 모달 | 구현됨. 네이티브 실기기 동작은 미검증 |

## 토큰과 시크릿 키

| 구분 | Access Token | Refresh Token |
| --- | --- | --- |
| 용도 | API 요청의 사용자 인증 | 새 Access/Refresh 발급 |
| 만료 | 발급 시점부터 15분 | 발급 시점부터 14일. 갱신 시 새로 14일 |
| 서명 | HS256, `JWT_ACCESS_SECRET` | HS256, 별도 `JWT_REFRESH_SECRET` |
| payload | `sub`, `tokenType: "access"`, `iat`, `exp` | `sub`, `tokenType: "refresh"`, `jti`, `iat`, `exp` |
| 네이티브 저장 | 메모리 | Expo SecureStore, 키 `auth.refreshToken` |
| 웹 저장 | 메모리 | 서버가 설정하는 HttpOnly, SameSite=Lax, Path=/auth host-only 쿠키 |

`sub`는 사용자 UUID, `iat`는 발급 시각, `exp`는 만료 시각이다. Refresh의 `jti`는 발급마다 새로 생성하는 UUID로, 같은 초에 발급해도 토큰이 달라지게 한다. 별도 `sessionUuid`/`sid`, DB 내부 숫자 ID, 비밀번호·이름·포인트는 payload에 넣지 않는다. JWT payload는 암호화된 개인정보 저장소가 아니다.

두 시크릿 키는 백엔드의 Git-ignored 환경 파일에서 관리하고 ConfigService로 읽는다. 개발 파일은 `back/.env.development`이며, 키 누락·공백·동일 값은 시작 오류다. 프론트 환경 변수나 저장소에 키를 넣지 않는다. 키 교체 절차는 [백엔드 README](../../../back/README.md)를 따른다.

## 로그인

1. 네이티브 프론트는 `POST /auth/login`으로 `loginId`, `password`를 보낸다. 웹은 같은 body와 함께 `Origin` 및 `X-Auth-Transport: cookie`를 보낸다.
2. 서버가 DB의 활성 사용자와 자격 증명을 확인하고 `generateTokens(userUuid)`로 두 토큰을 생성한다.
3. `saveRefreshToken(userId, refreshToken, expiresAt)`이 로그인 기록과 첫 Refresh 해시를 트랜잭션으로 저장한다. 저장 실패 시 로그인 성공을 반환하지 않는다.
4. 서버는 사용자 UUID·표시 이름·계정 종류·현재 포인트와 Access, `expiresIn: 900`을 반환한다. 네이티브 JSON 응답에는 Refresh도 포함하고, 웹 응답은 Refresh를 제외해 HttpOnly 쿠키로 설정한다. 내부 숫자 ID는 응답하지 않는다.
5. 프론트는 Refresh 저장이 끝난 뒤 사용자·포인트·Access를 메모리에 반영한다. Refresh는 Context에 공개하지 않는다. 일반 API 함수는 공통 요청 client를 거치며 공개·선택·필수 인증 모드를 명시한다.

현재 프론트에는 입력 폼 대신 개발용 `/login` 경로가 있다. 해당 경로를 방문하면 복원을 기다리고, 이미 로그인돼 있으면 홈으로 이동한다. 미로그인일 때는 URL의 계정을 사용하며 생략 시 `admin/admin`으로 로그인한다. 앱 전체에서 실패를 숨기기 위해 이 계정으로 자동 재로그인하지 않는다.

## 앱 종료와 복원

- 앱 프로세스가 종료되면 Access·사용자·포인트 메모리는 사라진다. 네이티브 Refresh는 SecureStore에 남는다.
- 앱 시작 시 네이티브는 SecureStore에서 읽은 Refresh를 `POST /auth/refresh` body로 보낸다. 웹은 빈 JSON body와 함께 `Origin`, `X-Auth-Transport: cookie`를 보내고 브라우저가 쿠키를 자동 전송한다. 웹 첫 방문처럼 쿠키가 없으면 204로 미로그인 상태가 된다.
- 성공하면 새 Refresh를 저장한 뒤 Access·사용자·최신 포인트를 메모리에 반영한다. 복원 중에는 `/login`의 로그인 요청이나 redirect를 보류한다.
- 갱신 401이면 Refresh와 메모리 인증 상태를 정리한다. 통신 오류·5xx는 Refresh를 유지하되 미로그인 상태와 복원 오류를 표시한다. 저장 실패도 복원 성공으로 처리하지 않는다.
- 복원 Promise는 중복 effect 실행에서도 공유한다. 복원·로그인·갱신·로그아웃은 저장과 상태 반영까지 직렬화한다. 사용자별 화면 요청은 복원이 끝날 때까지 기다리고, 계정 세대가 바뀐 뒤 도착한 응답을 무시한다.

## 갱신과 재사용 탐지

`POST /auth/refresh`는 네이티브 JSON body 또는 웹 HttpOnly 쿠키에서 Refresh Token을 받는다. 웹 모드는 `WEB_CORS_ORIGINS`에 정확히 포함된 Origin과 `X-Auth-Transport: cookie`를 요구한다. 웹 요청의 body Refresh는 무시한다. 쿠키가 없는 웹 refresh는 204이며, 쿠키가 유효하지 않으면 401과 삭제 헤더다. 성공 응답의 Refresh는 웹에서는 쿠키로만 전달된다. Refresh 전용 키의 서명·알고리즘·용도·클레임, 사용자와 DB 이력을 검증하며 Access Token은 갱신에 사용할 수 없다.

DB의 `auth_sessions`는 로그인별 사용자와 폐기 시각을 관리한다. `refresh_tokens`는 해당 로그인 내부 ID에 연결된 SHA-256 해시·만료·사용 시각을 저장한다. 원문 토큰은 DB나 로그에 남기지 않는다. 이 내부 연결 ID는 JWT에 포함하지 않는다.

- 정상 갱신: 이전 해시 행의 `used_at`을 기록하고 같은 로그인에 새 해시 행을 추가한다. 기존 해시를 덮어쓰거나 삭제하지 않는다.
- 사용된 토큰 재사용: 해당 로그인 전체를 폐기하고 401을 반환한다. 그 로그인에서 발급한 최신 Refresh도 거부하고, 같은 사용자의 다른 로그인은 유지한다.
- 만료된 사용 토큰도 서명·소유자·이력이 맞으면 재사용을 탐지한다. 만료된 미사용 토큰으로 새 토큰을 발급하지 않는다.
- 갱신과 로그아웃은 로그인 행을 먼저 잠그고 토큰 행을 잠근다. 재사용 폐기는 트랜잭션을 커밋한 뒤 401을 반환한다.
- 동시 갱신은 한 요청만 성공하고 후행 요청이 재사용을 탐지한다. 따라서 먼저 성공한 요청의 새 Refresh도 이후 거부된다.

응답 유실·timeout 뒤 이전 Refresh를 자동 재시도하지 않는다. 통신 실패 시 로컬 토큰을 유지하더라도 서버에서는 이미 사용됐을 수 있으므로, 다음 명시적 복원 또는 로그인이 필요할 수 있다. 실행 중 인증 API에서 받은 `401 AUTH_INVALID_TOKEN`은 동시에 한 번만 Refresh를 실행하고 원 요청을 한 차례 다시 보낸다. 공개 요청, 익명 선택 요청, 403, 네트워크 오류, 5xx는 자동 갱신하지 않는다. Refresh 요청 자체는 공통 자동 재시도에 들어가지 않는다.

이 방식은 OAuth 보안 권고의 RTR·재사용 탐지를 적용한 것으로 전체 OAuth 서버 구현은 아니다. 과거 토큰 재사용이 일어나기 전에는 공격자의 최초 사용을 식별할 수 없다.

## 로그아웃

- 프론트가 저장된 Refresh로 `POST /auth/logout`을 호출한다. 서버는 그 토큰에 연결된 로그인만 폐기하며 해시 이력은 보존한다.
- 만료되지 않은 사용 전·사용 후 Refresh 모두 해당 로그인 폐기에 사용할 수 있다. 이미 폐기됐거나 유효하게 서명된 토큰의 이력이 없으면 204, 잘못된/만료된 토큰은 401이다.
- 프론트는 서버 호출 성공 여부와 관계없이 로컬 Refresh 삭제를 시도하고 사용자·포인트·Access를 정리한다. 서버 호출이나 저장소 삭제 실패는 호출자에게 알린다.
- 웹 로그아웃은 쿠키 모드로 서버 요청을 보내고 응답에서 쿠키를 만료한다. 쿠키가 없으면 204로 처리한다. 네트워크 실패 시 브라우저 쿠키 삭제를 보장하지 않는다.
- 서버에서 폐기하는 것은 Refresh다. 이미 발급된 Access는 별도 폐기 목록을 조회하지 않으므로 최대 15분 더 유효할 수 있다. 서버 통신 실패 시 서버 로그인까지 폐기됐다고 보장하지 않는다.

## 인증 오류

오류 형식은 `{ errorCode, errorName, statusCode, timestamp, path }`이며 프로젝트의 커스텀 예외와 `AllExceptionFilter`를 사용한다.

| HTTP | 코드 | 의미 |
| --- | --- | --- |
| 400 | `AUTH_INVALID_LOGIN_INPUT` | 로그인 입력 오류 |
| 401 | `AUTH_LOGIN_FAILED` | 로그인 계정 확인 실패 |
| 400 | `AUTH_INVALID_TOKEN_INPUT` | 갱신·로그아웃 입력 오류 |
| 401 | `AUTH_INVALID_TOKEN` | JWT 또는 Refresh 이력 검증 실패, 재사용 탐지 |

재사용 여부는 외부에 별도 오류로 공개하지 않는다. 일반 DB 장애는 인증 실패 401로 바꾸지 않는다. Access 인증은 Passport의 Bearer 추출·서명·만료 검사 후 용도·사용자 UUID·활성 사용자를 확인하고 Guard가 인증 실패를 프로젝트 오류로 변환한다.

## 제품 API 인증

공개 목록·홈·프리뷰는 인증 없이 사용할 수 있다. 작품 상세와 회차 재생은 선택 인증이다. `Authorization` 헤더가 없으면 익명으로 처리하고, 헤더가 있으면 `Bearer <accessToken>`을 검증한다. 빈 값·잘못된 스킴·만료·변조·Refresh 토큰은 `AUTH_INVALID_TOKEN`(401)이며 익명으로 재처리하지 않는다.

작품 상세는 검증된 Access의 사용자 entitlement와 시청기록만 보여준다. 익명 응답에서는 무료 회차만 `isUnlocked: true`이며 모든 시청기록은 `null`이다. 전달된 `userUuid` query는 사용자를 선택하지 않는다.

회차 재생은 공개 리소스를 확인한 뒤 무료 회차를 익명·인증 사용자 모두 허용한다. 유료 회차의 익명 요청은 `AUTH_INVALID_TOKEN`(401), 인증된 미구매 사용자는 `EPISODE_ACCESS_DENIED`(403), 구매 사용자는 200이다. 잔존 `userUuid` query는 사용자 선택에 사용하지 않는다.

`POST /me/points/increase`와 `POST /me/episodes/:episodeUuid/purchaseSingle`은 필수 Access JWT를 요구하며 payload의 `sub`로 사용자를 결정한다. 인증이 성공한 요청에만 기존 개발 환경 제한과 업무 처리를 적용한다. 비개발 환경의 404 보장은 인증을 통과한 요청에 적용된다.

프론트의 공통 요청 함수는 endpoint가 공개·선택·필수 인증 중 하나를 지정한다. 실행 중 Refresh는 동시 401 요청 사이에서 한 번만 수행하고 각 원 요청은 새 Access로 최대 한 차례 재시도한다. 최종 Refresh 401은 사용자·포인트·Access를 정리하고 루트의 세션 만료 모달을 표시한다. 모달을 닫으면 같은 종료 세션의 늦은 오류로 다시 열리지 않으며 로그인 화면은 사용자가 모달의 로그인 버튼을 누른 경우에만 열린다. 미로그인 유료 재생은 화면에서 로그인 안내를, 구매 권한 거부는 회차/구매 안내를 표시한다.

네이티브 실기기에서는 SecureStore와 시스템 Modal을 아직 검증하지 않았다. 웹은 HttpOnly Refresh 쿠키로 페이지 새로고침 뒤 세션을 복원한다. Refresh 통신 오류·5xx 또는 저장 실패는 기존 Refresh를 자동 재사용하지 않도록 막으며 새 로그인이나 명시적 복원이 필요하다.

인증 API의 웹 응답은 `Cache-Control: no-store`다. 운영 쿠키는 HTTPS의 Secure 속성을 사용한다. 프론트와 API가 `app.example.com` 및 `api.example.com`처럼 같은 사이트에 있거나 동일 origin 프록시를 사용해야 한다. 각 서버리스 인스턴스는 같은 JWT 시크릿과 기존 공유 MySQL을 사용하며 인스턴스 메모리에 Refresh 상태를 보관하지 않는다. `*.vercel.app` 프로젝트 간 도메인 쿠키 공유나 별도 사이트의 third-party cookie는 지원하지 않는다.
