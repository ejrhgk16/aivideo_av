# plan-36-web-refresh-cookie

## 목표

웹 Refresh Token을 서버가 설정하는 HttpOnly 쿠키에 보관해 로그인 후 페이지를 새로고침해도 세션을 복원한다. Access Token은 메모리에 유지하며, 웹 시작 시 쿠키를 사용한 갱신으로 사용자·포인트·Access를 다시 받는다.

## 승인된 범위와 전제

- 사용자에게 범위와 정확한 파일·의존성·검증 명령을 각각 제시했고 두 단계 승인을 받았다.
- 웹 로그인·갱신·로그아웃은 기존 `/auth/login`, `/auth/refresh`, `/auth/logout`에서 명시적인 쿠키 전송 모드를 사용한다. 웹 응답 JSON에는 Refresh 원문을 포함하지 않는다.
- 네이티브는 기존 JSON Refresh 요청·응답과 Expo SecureStore를 유지한다. 제품 API의 Bearer Access 인증도 유지한다.
- 서버는 쿠키의 설정·회전·삭제, 허용 Origin 검사와 CSRF 방어, credentials CORS를 담당한다. 프론트는 쿠키를 읽거나 직접 수정하지 않는다.
- 개발은 `http://localhost:8081`과 `http://localhost:3000`을 사용한다. 운영은 HTTPS이며 프론트와 API를 같은 사이트에 배치하는 구성을 전제로 한다. 같은 사이트의 다른 origin이면 credentials CORS를 설정한다. 서로 다른 사이트 간 서드파티 쿠키를 보장하거나 Vercel 배포를 수행하는 작업은 포함하지 않는다.
- Vercel 등 서버리스에서도 쿠키는 브라우저에, Refresh 이력은 기존 MySQL에 보관한다. 인스턴스 메모리에 인증 상태를 추가하지 않는다.
- DB 구조·초기화·시드, 토큰 수명(Access 15분/Refresh 14일), 회전·엄격한 재사용 탐지, 로그인 UI와 다른 기능은 변경하지 않는다.
- 탭 간 동시 갱신의 조정 기능은 추가하지 않는다. 기존 엄격한 재사용 탐지에 따라 동시 갱신·응답 유실 후 재시도가 재로그인을 요구할 수 있다는 한계를 문서에 유지한다.

## 성공 기준

1. 웹 로그인 응답이 Refresh 원문 없이 HttpOnly 쿠키를 설정한다.
2. 새로고침으로 Access와 사용자 메모리가 사라져도 쿠키 갱신으로 로그인과 최신 포인트를 복원한다.
3. 로그아웃은 서버 로그인 폐기와 쿠키 삭제를 수행하고, 다시 새로고침해도 미로그인을 유지한다.
4. 쿠키 없는 첫 방문은 세션 만료 모달이나 복원 오류 없이 미로그인으로 종료한다. 만료·위조 Refresh와 네트워크·5xx 오류는 구분한다.
5. 허용하지 않은 Origin이나 웹 모드 헤더가 없는 브라우저 인증 요청은 세션을 생성·회전·폐기하지 못한다. 기존 네이티브 body 방식과 제품 Bearer 인증은 회귀 테스트를 통과한다.
6. 다른 탭의 계정 변경으로 Refresh 응답 사용자 UUID가 현재 사용자와 달라지면 해당 탭의 세션 세대를 무효화하고, 이전 계정에서 시작한 요청을 새 계정으로 재시도하지 않는다. 새 계정의 공유 쿠키와 서버 로그인은 폐기하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | backend-refresh-cookie | `back/src/identity/loginController.ts`, `back/src/identity/refreshCookie.ts`, `back/src/common/http/webCors.ts`, 백엔드 테스트·README, 인증 API 문서, `_docs/ARCHITECTURE.md` | 쿠키 인증 계약, Origin·CSRF·CORS, 서버 쿠키 처리, Postman 실제 HTTP 검증과 문서 반영 |
| 2 | front-cookie-session | `front/src/common/http/api.ts`, 웹 저장 어댑터, `front/src/features/user/`의 로그인·세션 파일, 기존 프론트 테스트·README | 웹 쿠키 전송, 메모리 토큰 소실 후 복원, 네이티브 보존, 새로고침·로그아웃 검증 |
| 3 | reject-refresh-account-switch | `front/src/features/user/sessionClient.ts`, `front/tests/unit/session.test.ts`, `front/README.md` | 리뷰 P1 대응: Refresh 계정 변경 시 세션 세대 무효화와 원 요청 재시도 차단 |

정확한 파일 목록과 checks는 이 폴더의 `index.json` 및 각 task 문서에 선언한다.

## 실행 순서 및 병렬 작업

- `task-1`은 의존성이 없어 먼저 실행한다. `task-2`와 병렬 실행하지 않는다.
- `task-2`는 `task-1` 완료 후 실행한다. 쿠키 모드 헤더, 본문, 익명 응답과 오류 계약을 소비하므로 선행 API 구현과 검증이 필요하다.
- 두 task의 수정 파일은 겹치지 않는다. 그럼에도 API 계약에 의존하므로 이번 계획에는 병렬 실행 가능한 task 쌍이 없다.
- `task-3`은 리뷰 후 사용자의 추가 task 작성 요청으로 등록했다. `task-2` 완료 후 실행하며 기존 프론트 파일을 수정하므로 선행 task와 병렬 실행하지 않는다. 최초 익명 복원과 명시적 로그인은 유지하고, 탭 간 동기화나 백엔드 계약 변경은 추가하지 않는다.
- 각 worker는 지정된 파일만 수정하고 다른 작업자의 변경을 되돌리지 않는다. 변경은 `apply_patch`로 수행한다. dev에서만 작업하며 branch/worktree 생성과 직접 commit/push를 하지 않는다.

## 검증

- task-1: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
- task-2: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
- task-3: 같은 프론트 검증 3종과 A 계정 요청 중 공유 쿠키가 B로 바뀌는 회귀 테스트. 자세한 완료 조건은 `task-3-reject-refresh-account-switch.md`를 따른다.
- 기존 개발 서버의 HTTP 응답과 현재 코드 반영을 확인한 뒤 검증한다. API 테스트는 기존 MySQL과 `back/test/api/README.md`의 fixture·정리 절차를 사용한다. 이번 기능 때문에 DB를 초기화하거나 시드를 실행하지 않는다.
- 브라우저에서 로그인 → 새로고침 → 로그인 유지 → 로그아웃 → 새로고침 → 미로그인 유지, 첫 방문, HttpOnly·쿠키 경로·웹 응답의 Refresh 비노출을 확인한다. 자세한 절차는 task-2에 둔다.
- 서버가 없으면 자동 실행하거나 포트를 바꾸지 않는다. 검증 실패로 보고하고 필요한 명령을 안내한다: 프론트 `npm --prefix front run start -- --port 8081`, 백엔드 `npm --prefix back run start:dev`.
- 서버의 현재 코드 반영을 확인할 수 없으면 사용자에게 확인한다. 서버·fixture·브라우저 검증 수단이 없다는 이유로 검증을 통과 처리하지 않는다.

## 검증 결과

- 계획 작성 단계: 제품 코드 변경과 제품 검증은 수행하지 않았다.
- 두 task 문서를 다시 열어 주요 로직 코드, 선언 파일 범위, 의존성, 검증 명령과 완료 조건의 일치를 검토했다.
- `node tools/harness/cli.mjs validate --plan plan-36-web-refresh-cookie` 통과 (`valid: true`).
- task-1/2 실행: 백엔드 lint·test(단위 98개, API 검증 274개)·build 및 프론트 typecheck·test(98개)·export 통과. 실제 브라우저 검증은 미수행이다.
- 리뷰 후 task-3을 pending으로 추가했다. 이 추가 task의 제품 수정과 회귀 테스트 실행은 아직 수행하지 않았다.
