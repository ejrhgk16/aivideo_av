# API 공통 규칙

## 경로와 응답

- 현재 API에는 전역 URL prefix나 버전 prefix가 없다.
- 성공 응답은 공통 envelope 없이 endpoint가 정의한 JSON 값 자체를 반환한다.
- 필드명은 endpoint 정의서의 응답 예시를 기준으로 한다. 기존 구현의 대소문자는 임의로 통일하지 않는다.
- 작품, 회차, 제작사, 영상의 공개 식별자는 `uuid` 필드로 반환하며, 작품·회차·프리뷰 조회 경로에도 해당 UUID를 전달한다. 자동 증가 숫자 `id`는 DB 내부 관계와 조인에만 사용하고 API 응답에 노출하지 않는다. 장르 `id`는 숫자 식별자로 유지한다.
- 일반 endpoint 오류는 NestJS 기본 HTTP 오류 형식을 사용한다. 컨트롤러에 `AllExceptionFilter`를 지정한 포인트 API는 업무 오류에 `{ errorCode, errorName, statusCode, timestamp, path }` 형식을 사용하고, 해당 필터가 지정되지 않은 endpoint의 오류 응답은 바뀌지 않는다.
- `AllExceptionFilter`를 지정한 로그인 API도 업무 오류에 `{ errorCode, errorName, statusCode, timestamp, path }` 형식을 사용한다. 잘못된 로그인 입력은 `AUTH_INVALID_LOGIN_INPUT`(400), 로그인 불가는 `AUTH_LOGIN_FAILED`(401)다.

## 시간과 공개 콘텐츠

- 시간 값은 서버가 비교하며, API 계약의 시각 표현은 ISO 8601 UTC를 사용한다.
- 일반 공개 작품과 회차는 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 노출한다.
- 콘텐츠 컬렉션은 활성 상태여야 하며, 항목은 `starts_at`이 없거나 현재 시각 이하이고 `ends_at`이 없거나 현재 시각보다 이후일 때만 노출한다.

## 미디어와 인증

- 이미지와 영상의 `storageKey`는 저장소 내부 키다. `imageUrls`는 공개 이미지 키 패턴에 해당하는 S3 직접 URL을 제공하며, 개발용 로컬 이미지 API는 없다. FULL·PREVIEW 영상의 재생 API는 개발 환경에서만 S3 객체 GET 서명 URL을 발급하며 3600초 후 만료된다.
- 현재 정의된 홈 콘텐츠 API는 인증을 요구하지 않는다.
- `GET /dramas/:dramaId`는 선택 `userUuid`를 받아 회차별 `isUnlocked`를 표시할 수 있다. 현재 로그인은 토큰이나 세션을 발급하지 않으므로 이 값은 사용자 식별 값이며 인증·권한 부여 수단이 아니다. 생략 시 무료 회차만 열림으로 표시한다.
- `POST /auth/login`은 loginId/password를 확인해 사용자 정보와 현재 포인트 잔액을 반환한다. 현재 개발 시드는 admin/admin이며 로그인 응답은 토큰이나 세션 쿠키를 발급하지 않는다.
- 개발 웹 클라이언트 `http://localhost:8081`만 CORS 요청 origin으로 허용한다.
- CORS는 와일드카드 origin을 사용하지 않으며, 운영 origin과 credentials는 별도 계약에서 정의한다.
- 회차와 프리뷰 재생 URL은 공개 콘텐츠 조건을 확인하지만 사용자별 구매·해제 상태는 확인하지 않는다. 가격과 무관하게 공개 회차의 본편 영상 URL을 제공한다. 사용자별 접근 제어는 별도 인증 API 계약에서 정의한다.
