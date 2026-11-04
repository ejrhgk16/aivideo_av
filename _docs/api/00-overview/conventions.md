# API 공통 규칙

## 경로와 응답

- 현재 API에는 전역 URL prefix나 버전 prefix가 없다.
- 성공 응답은 공통 envelope 없이 endpoint가 정의한 JSON 값 자체를 반환한다.
- 필드명은 endpoint 정의서의 응답 예시를 기준으로 한다. 기존 구현의 대소문자는 임의로 통일하지 않는다.
- 백엔드 controller/service는 `Promise<ResponseType>` 반환 타입을 명시한다. 본문 없는 204 응답은 `Promise<void>`를 사용한다.
- 작품, 회차, 제작사, 영상의 공개 식별자는 `uuid` 필드로 반환하며, 작품·회차·프리뷰 조회 경로에도 해당 UUID를 전달한다. 자동 증가 숫자 `id`는 DB 내부 관계와 조인에만 사용하고 API 응답에 노출하지 않는다. 장르 `id`는 숫자 식별자로 유지한다.
- 모든 HTTP 오류는 `{ errorCode, errorName, statusCode, timestamp, path }`의 다섯 필드로 반환한다. 업무 예외는 기존 업무 코드·이름·상태를 유지하고, 일반 HTTP 예외는 `HTTP_<HTTP_STATUS_NAME>` 코드와 HTTP 상태 이름을 사용한다. 예상하지 못한 오류는 500 `INTERNAL_SERVER_ERROR` / `InternalServerError`로 반환한다.
- 일반 4xx/5xx 오류의 응답 본문에는 예외 message, stack trace, SQL 또는 요청 비밀 값을 넣지 않는다. HTTP 상태에 대응하는 오류 예시는 각 endpoint 문서의 오류 표를 따른다.
- 인증 응답은 성공·오류와 관계없이 `Cache-Control: no-store`를 설정한다. 웹 쿠키 인증은 allowlist Origin과 `X-Auth-Transport: cookie`가 모두 필요하며, 이 계약이 누락되거나 어긋나면 공통 403 오류 응답을 반환한다. 전송 모드 헤더와 Origin이 모두 없는 인증 요청은 네이티브 JSON 모드로 처리한다.

## 시간과 공개 콘텐츠

- 시간 값은 서버가 비교하며, API 계약의 시각 표현은 ISO 8601 UTC(`Z`)를 사용한다.
- 한국 시각 표시는 클라이언트에서 Asia/Seoul로 변환한다. 표시 목적으로 DB 값에 9시간을 더하지 않는다.
- DB 저장·비교는 UTC를 기준으로 한다. DB 세션 시간대와 드라이버 설정의 차이 및 기존 기본값의 적용 범위는 [DB 공통 규칙](../../AI_DRAMA_data_model/00-overview/common-rules.md#시간-저장비교-기준)을 따른다.
- 일반 공개 작품과 회차는 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 노출한다.
- 콘텐츠 컬렉션은 활성 상태여야 하며, 항목은 `starts_at`이 없거나 현재 시각 이하이고 `ends_at`이 없거나 현재 시각보다 이후일 때만 노출한다.

## 미디어와 인증

- 이미지와 영상의 `storageKey`는 저장소 내부 키다. `imageUrls`는 공개 이미지 키 패턴에 해당하는 S3 직접 URL을 제공하며, 개발용 로컬 이미지 API는 없다. FULL·PREVIEW 영상의 재생 API는 개발 환경에서만 S3 객체 GET 서명 URL을 발급하며 3600초 후 만료된다.
- 현재 정의된 홈 콘텐츠 API는 인증을 요구하지 않는다.
- `GET /dramas/:dramaId`와 `GET /episodes/:episodeId/playback`는 선택 JWT 인증을 사용한다. 헤더가 없으면 익명이며, 헤더가 있으면 유효한 Access JWT가 필요하다. `userUuid` query는 사용자 선택에 사용하지 않는다.
- 익명 작품 상세에는 무료 회차만 잠금 해제되고 시청기록은 `null`이다. 회차 재생은 익명 무료 회차를 허용하고 유료 익명 요청은 `AUTH_INVALID_TOKEN`(401), 인증된 미구매 요청은 `EPISODE_ACCESS_DENIED`(403)다.
- `POST /auth/login`은 제공된 loginId/password를 확인해 사용자 정보, 현재 포인트 잔액, 15분 Access JWT, 14일 Refresh JWT를 반환한다. Refresh는 매번 회전하며 해시 이력은 append-only다. 사용된 Refresh 재제출은 해당 로그인 전체를 폐기한다. 동시 갱신에서도 한 요청만 성공하고 후행 재사용은 로그인 전체를 폐기하므로 응답 유실 뒤 재시도는 재로그인을 요구할 수 있다. `POST /auth/logout`은 토큰 이력의 로그인만 폐기하며 반복 요청에도 204다. Access JWT는 로그아웃 후 최대 15분 유효할 수 있다.
- Passport JWT Strategy와 필수·선택 Guard는 제품 API에 적용한다. 사용자 귀속 API는 검증된 payload UUID만 사용한다.
- `POST /me/points/increase`와 `POST /me/episodes/:episodeUuid/purchaseSingle`은 Access JWT 필수다. 개발 환경 제한은 인증 통과 뒤 적용된다.
- 로그인·토큰 저장·복원·갱신·폐기 및 프론트 공통 요청의 인증 규칙은 [전체 인증 방식](authentication.md)을 기준으로 한다.
- `WEB_CORS_ORIGINS`의 정확한 origin만 CORS 요청과 웹 인증에 허용한다. 미설정 개발 기본값은 `http://localhost:8081`, 운영 기본값은 빈 목록이다.
- 허용된 Origin만 정확히 반사하고 credentials를 허용한다. OPTIONS 허용 헤더는 `content-type`, `authorization`, `x-auth-transport`다. 와일드카드·임의 Origin 반사는 사용하지 않는다. Origin 검증은 CSRF 방어의 일부로 endpoint에서도 수행한다.
- 웹 Refresh 쿠키는 HttpOnly·SameSite=Lax·Path=/auth·host-only이며 14일 후 만료한다. 운영 Secure 속성은 HTTPS를 전제로 한다. 서로 다른 사이트 간 쿠키는 보장하지 않는다.
- 회차 재생은 공개 콘텐츠 조건과 유료 회차의 사용자별 entitlement를 확인한다. 프리뷰 재생은 공개 작품과 해당 작품 소유의 프리뷰 영상 여부만 확인하며 회차 entitlement와 무관하다.
