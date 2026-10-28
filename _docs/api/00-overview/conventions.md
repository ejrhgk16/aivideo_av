# API 공통 규칙

## 경로와 응답

- 현재 API에는 전역 URL prefix나 버전 prefix가 없다.
- 성공 응답은 공통 envelope 없이 endpoint가 정의한 JSON 값 자체를 반환한다.
- 필드명은 endpoint 정의서의 응답 예시를 기준으로 한다. 기존 구현의 대소문자는 임의로 통일하지 않는다.
- 작품, 회차, 제작사, 영상의 공개 식별자는 `uuid` 필드로 반환하며, 작품·회차·프리뷰 조회 경로에도 해당 UUID를 전달한다. 자동 증가 숫자 `id`는 DB 내부 관계와 조인에만 사용하고 API 응답에 노출하지 않는다. 장르 `id`는 숫자 식별자로 유지한다.
- 일반 endpoint 오류는 NestJS 기본 HTTP 오류 형식을 사용한다. 컨트롤러에 `AllExceptionFilter`를 지정한 포인트 API는 업무 오류에 `{ errorCode, errorName, statusCode, timestamp, path }` 형식을 사용하고, 해당 필터가 지정되지 않은 endpoint의 오류 응답은 바뀌지 않는다.
- `AllExceptionFilter`를 지정한 로그인 API도 업무 오류에 `{ errorCode, errorName, statusCode, timestamp, path }` 형식을 사용한다. 잘못된 로그인 입력은 `AUTH_INVALID_LOGIN_INPUT`(400), 로그인 불가는 `AUTH_LOGIN_FAILED`(401)다. Refresh/logout 입력 오류는 `AUTH_INVALID_TOKEN_INPUT`(400), JWT 인증 실패는 `AUTH_INVALID_TOKEN`(401)이다.

## 시간과 공개 콘텐츠

- 시간 값은 서버가 비교하며, API 계약의 시각 표현은 ISO 8601 UTC를 사용한다.
- 일반 공개 작품과 회차는 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 노출한다.
- 콘텐츠 컬렉션은 활성 상태여야 하며, 항목은 `starts_at`이 없거나 현재 시각 이하이고 `ends_at`이 없거나 현재 시각보다 이후일 때만 노출한다.

## 미디어와 인증

- 이미지와 영상의 `storageKey`는 저장소 내부 키다. `imageUrls`는 공개 이미지 키 패턴에 해당하는 S3 직접 URL을 제공하며, 개발용 로컬 이미지 API는 없다. FULL·PREVIEW 영상의 재생 API는 개발 환경에서만 S3 객체 GET 서명 URL을 발급하며 3600초 후 만료된다.
- 현재 정의된 홈 콘텐츠 API는 인증을 요구하지 않는다.
- `GET /dramas/:dramaId`는 선택 `userUuid`를 받아 회차별 `isUnlocked`를 표시할 수 있다. 로그인은 JWT를 발급하지만 이 endpoint는 아직 JWT 인증을 사용하지 않는다. `userUuid`는 사용자 식별 값이며 인증·권한 부여 수단이 아니다. 생략 시 무료 회차만 열림으로 표시한다.
- `GET /episodes/:episodeId/playback`는 선택 `userUuid`를 받아 유료 회차 entitlement를 확인한다. 사용자 UUID는 인증 수단이 아니다. 익명 요청은 무료 회차만 재생할 수 있고, 유료 회차는 해당 사용자와 회차가 일치하는 entitlement가 있어야 한다. 권한 거부는 `EPISODE_ACCESS_DENIED`(403)이며 회차 재생 endpoint에서 `{ errorCode, errorName, statusCode, timestamp, path }` 형식으로 반환한다.
- `POST /auth/login`은 제공된 loginId/password를 확인해 사용자 정보, 현재 포인트 잔액, 15분 Access JWT, 14일 Refresh JWT를 반환한다. Refresh는 매번 회전하며 해시 이력은 append-only다. 사용된 Refresh 재제출은 해당 로그인 전체를 폐기한다. 동시 갱신에서도 한 요청만 성공하고 후행 재사용은 로그인 전체를 폐기하므로 응답 유실 뒤 재시도는 재로그인을 요구할 수 있다. `POST /auth/logout`은 토큰 이력의 로그인만 폐기하며 반복 요청에도 204다. Access JWT는 로그아웃 후 최대 15분 유효할 수 있다.
- Passport JWT Strategy와 Guard는 Access 인증에 사용할 수 있지만 현재 UUID 기반 제품 API에는 적용하지 않았다. 기존 선택 `userUuid` 값은 여전히 인증 수단이 아니다.
- 로그인·토큰 저장·복원·갱신·폐기와 기능 API의 JWT 전환 예정 규칙은 [전체 인증 방식](authentication.md)을 기준으로 한다. 전환 예정 정책은 아직 구현되지 않았다.
- 개발 웹 클라이언트 `http://localhost:8081`만 CORS 요청 origin으로 허용한다.
- CORS는 와일드카드 origin을 사용하지 않으며, 운영 origin과 credentials는 별도 계약에서 정의한다.
- 회차 재생은 공개 콘텐츠 조건과 유료 회차의 사용자별 entitlement를 확인한다. 프리뷰 재생은 공개 작품과 해당 작품 소유의 프리뷰 영상 여부만 확인하며 회차 entitlement와 무관하다.
