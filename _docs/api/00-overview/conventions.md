# API 공통 규칙

## 경로와 응답

- 현재 API에는 전역 URL prefix나 버전 prefix가 없다.
- 성공 응답은 공통 envelope 없이 endpoint가 정의한 JSON 값 자체를 반환한다.
- 필드명은 endpoint 정의서의 응답 예시를 기준으로 한다. 기존 구현의 대소문자는 임의로 통일하지 않는다.
- 오류 응답은 NestJS 기본 HTTP 오류 형식을 사용한다.

## 시간과 공개 콘텐츠

- 시간 값은 서버가 비교하며, API 계약의 시각 표현은 ISO 8601 UTC를 사용한다.
- 일반 공개 작품과 회차는 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 노출한다.
- 콘텐츠 컬렉션은 활성 상태여야 하며, 항목은 `starts_at`이 없거나 현재 시각 이하이고 `ends_at`이 없거나 현재 시각보다 이후일 때만 노출한다.

## 미디어와 인증

- 이미지의 `storageKey`는 객체 스토리지 내부 키이며, 접근 가능한 URL이 아니다.
- 현재 정의된 홈 콘텐츠 API는 인증을 요구하지 않는다.
- 개발 웹 클라이언트 `http://localhost:8081`만 CORS 요청 origin으로 허용한다.
- CORS는 와일드카드 origin을 사용하지 않으며, 운영 origin과 credentials는 별도 계약에서 정의한다.
- 미디어 URL 발급은 별도 API 계약이 확정될 때 정의한다.
