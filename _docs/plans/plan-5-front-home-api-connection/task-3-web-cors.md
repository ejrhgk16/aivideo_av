# task-3-web-cors

## 목표

Expo 웹 개발 서버(`http://localhost:8081`)가 NestJS API(`http://localhost:3000`)의 홈 콘텐츠 endpoint를 브라우저에서 호출할 수 있게 한다.

## 대상 파일

- `back/src/main.ts`
- `back/src/common/http/webCors.ts`
- `back/test/unit/webCors.spec.ts`
- `_docs/api/00-overview/conventions.md`

## 구현

1. `http://localhost:8081` origin만 허용하는 CORS 설정 함수를 추가하고 Nest 애플리케이션에 적용한다.
2. 임시 Nest HTTP 서버에서 해당 설정을 적용한 뒤, `Origin: http://localhost:8081` 헤더를 포함한 `OPTIONS` preflight와 `GET` 요청을 보낸다.
3. 두 응답에서 허용 origin 헤더를 확인하고, 허용되지 않은 origin은 허용하지 않는 것을 테스트한다.
4. API endpoint나 요청·응답 JSON 계약은 변경하지 않는다.
5. 공통 API 규칙에 개발 웹 origin의 CORS 허용 범위를 기록한다.

## 비목표

- 와일드카드 origin을 허용하지 않는다.
- 운영 origin, 인증 쿠키, credentials, 프록시 설정을 추가하지 않는다.
- 프론트 화면이나 API 호출 코드를 변경하지 않는다.
- 실제 데이터베이스나 컬렉션 데이터를 이용하는 종단간 테스트를 추가하지 않는다.

## 검증

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
