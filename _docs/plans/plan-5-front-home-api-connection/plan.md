# front-home-api-connection

## 목표

Expo 홈 화면이 환경 변수로 설정한 백엔드 URL에서 `GET /collections/:code`를 호출하고, `HOME_FEATURED`와 `EDITORIAL_TOP_3` 응답을 개발 콘솔에 출력한다.

## 범위

- `front/.env`에 `EXPO_PUBLIC_API_BASE_URL`을 설정한다.
- 홈 콘텐츠 API의 응답 타입과 호출 함수를 프론트 공용 서비스로 추가한다.
- 홈 화면 마운트 시 두 컬렉션을 병렬 요청하고 결과를 로그로 확인한다.
- API 서비스의 요청 경로와 응답 처리를 단위 테스트한다.
- 개발 웹 앱 origin에서 백엔드 홈 콘텐츠 API를 호출할 수 있도록 CORS를 설정한다.
- 임시 Nest HTTP 서버에 실제 preflight와 `GET` 요청을 보내 CORS 동작을 검증한다.

## 비목표

- 기존 로컬 목 데이터 기반 홈 UI를 API 응답으로 교체하지 않는다.
- 로딩·오류 UI, 재시도, 캐시, 상태 관리, API endpoint·응답 계약 변경을 추가하지 않는다.
- 운영 origin 설정이나 환경별 CORS 정책을 추가하지 않는다.
- `web-prototype/`은 변경하거나 검증하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | home-api-client | `front/.env`, `front/src/services/homeContent.ts`, `front/tests/unit/homeContent.test.ts`, `front/scripts/test-experience.cjs` | API 기본 URL, 컬렉션 응답 타입·호출 함수, 요청 단위 테스트를 추가한다. |
| 2 | home-api-logging | `front/src/screens/HomeScreen.tsx` | 홈 화면에서 두 컬렉션 API를 병렬 호출해 콘솔에 출력한다. |
| 3 | web-cors | `back/src/main.ts`, `back/src/common/http/webCors.ts`, `back/test/unit/webCors.spec.ts`, `_docs/api/00-overview/conventions.md` | 개발 웹 origin의 API 요청을 허용하는 CORS를 설정하고 실제 HTTP 요청으로 검증한다. |

## 실행 순서 및 병렬 작업

- `task-1`은 독립적으로 먼저 실행한다. API 기본 URL과 호출 함수·테스트를 제공한다.
- `task-2`는 `task-1` 완료 후 실행한다. `task-1`이 만든 API 호출 함수를 import하므로 순차 의존성이 있다.
- `task-3`는 `task-2` 완료 후 실행한다. 웹 앱의 실제 API 요청이 CORS 허용 설정을 필요로 한다.
- 세 task는 병렬 실행하지 않는다. 후속 task의 구현과 검증이 이전 task의 공개 계약 또는 실행 환경에 의존한다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
