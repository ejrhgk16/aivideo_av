# plan-33-jwt-auth-session

## 목표
로그인 시 Access Token과 Refresh Token을 발급하고 네이티브 앱에서 Refresh Token을 안전하게 보관해 앱 재실행 후 세션을 복원한다. Passport 기반 Access Token 인증 구성을 준비한다. 범위 승인과 Task 구성 승인을 모두 받았다.

## 범위와 계약
- POST /auth/login: 기존 uuid, displayName, accountType, availablePoints에 accessToken, refreshToken, expiresIn: 900을 추가한다.
- POST /auth/refresh: JSON { refreshToken }을 받고 로그인과 같은 응답을 반환하며 Refresh Token을 교체한다.
- POST /auth/logout: JSON { refreshToken }의 해시 이력에 연결된 로그인 전체를 폐기하고 204를 반환한다. 만료되지 않은 과거 교체 토큰으로도 해당 로그인을 폐기할 수 있다. 토큰 이력은 삭제하지 않는다.
- Access Token 15분, Refresh Token 14일. HS256과 서로 다른 비밀 키, sub 사용자 UUID, tokenType 구분. Refresh Token에는 매 발급마다 바뀌는 jti를 넣어 같은 초에 발급해도 다른 토큰을 생성한다.
- [RFC 9700 §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2)의 rotation + 재사용 탐지를 적용한다. 기존 로그인 API 구조와 커스텀 오류 형식은 유지하며 OAuth 서버 전체를 구현하지 않는다.
- auth_sessions는 DB 내부 정수 id, user_id, revoked_at으로 로그인별 폐기 상태를 관리한다. refresh_tokens는 고유 SHA-256 token_hash, auth_session_id, expires_at, used_at으로 모든 발급 이력을 보존한다. 로그인 UUID나 로그인 기록 ID를 JWT/API에 넣지 않는다.
- 정상 갱신은 이전 토큰 행의 used_at을 설정하고 같은 로그인에 새 토큰 행을 추가한다. 기존 해시를 덮어쓰거나 이력을 삭제하지 않는다. 로그인 기록 행 잠금으로 갱신·재사용 탐지·로그아웃을 직렬화한다.
- 사용한 과거 토큰의 재사용이 감지되면 해당 로그인 기록을 폐기한다. 최신 Refresh Token도 거부되며 다른 로그인은 유지된다. 폐기를 커밋한 후 AUTH_INVALID_TOKEN(401)을 반환한다.
- 정상 사용자와 공격자 중 누가 토큰을 사용했는지 구분할 수 없으므로 해당 로그인은 재로그인이 필요하다. 같은 토큰의 동시 요청이나 응답 유실 후 재시도도 재사용 탐지 대상이다. 별도 유예/자동 재시도는 두지 않는다.
- 과거 토큰은 로그인 기록이 유효한 동안 만료 후에도 이력을 보존한다. 서명·용도·소유자 검증을 통과한 과거 토큰의 재사용은 만료 후에도 탐지한다. 미사용 만료 토큰으로 새 토큰을 발급하지 않는다.
- JWT_ACCESS_SECRET, JWT_REFRESH_SECRET은 Git-ignored 환경 파일에서 관리하며 누락·동일 키는 시작 시 오류로 처리한다. 실제 비밀 값과 토큰은 문서·테스트·로그에 남기지 않는다.
- 실행 중 사용자 추가 승인에 따라 개발용 키 두 개를 생성해 back/.env.development에 설정한다. 로컬 전용이며 커밋하지 않고 사용자가 추후 교체한다.
- 로그인 컨트롤러의 admin/admin 강제 치환을 제거한다. 기존 /login 개발 경로의 기본 계정값은 유지한다.
- 네이티브: Access Token은 메모리, Refresh Token은 expo-secure-store. 웹: 두 토큰 모두 메모리로만 관리하며 새로고침 시 로그아웃된다.
- 앱 시작 시 갱신 API 응답으로 사용자·포인트·Access Token을 복원한다. 복원 중 로그인 요청과의 충돌을 막고 로그아웃/후속 로그인 뒤 이전 요청이 상태를 되살리지 않도록 한다.
- 로그아웃은 서버 세션 폐기를 시도하고 로컬 인증 상태를 정리한다. 서버 연결 실패 시 로컬 삭제와 서버 폐기 성공을 구분한다.
- 로그아웃으로 이미 발급된 Access Token은 즉시 무효화되지 않으며 만료까지 유효하다.

## 비목표
기존 userUuid 기반 API 전환, 기존 API에 Guard 일괄 적용, 공통 HTTP 자동 갱신/재시도, 웹 쿠키 로그인 유지, 회원가입·소셜 로그인, 비밀번호 저장 방식 변경, 새 로그아웃 화면 추가는 제외한다. 기존 UUID 기반 API의 사칭 문제는 후속 전환 전까지 남는다. web-prototype/은 대상이 아니다.

## Task
| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | auth-session-storage | identity Entity, DB registry/migration, Entity 테스트, 데이터 모델 문서 (정확한 목록은 task-1 문서와 index.json) | 로그인 폐기 상태·Refresh Token 해시·사용 이력 저장 구조 |
| 2 | jwt-auth-api | identity 서비스·컨트롤러·Passport, 오류, 의존성, API 문서·Postman, 아키텍처 (정확한 목록은 task-2 문서와 index.json) | 로그인·갱신·폐기 및 검증 |
| 3 | front-auth-session | SecureStore, user 상태·로그인, 앱 로그인 경로, 테스트·의존성 (정확한 목록은 task-3 문서와 index.json) | 저장·복원·로그아웃 연결 |

## 실행 순서 및 병렬 작업
- task-1은 의존성이 없어 먼저 실행한다. task-2가 해당 저장 구조에 의존하고 task-3이 task-2에 의존하므로 다른 Task와 병렬 실행하지 않는다.
- task-2는 task-1 완료 후 실행한다. Entity와 테이블을 사용하는 발급·갱신·폐기 로직을 구현한다.
- task-3은 task-2 완료 후 실행한다. 확정된 인증 응답·오류 계약으로 저장·복원을 연결한다.
- 전체 순서는 task-1 → task-2 → task-3이다. 파일 범위는 서로 겹치지 않는다.
- 작업은 dev에서 수행한다. branch/worktree, 직접 commit/push는 하지 않는다.

## 검증
- task-1, task-2: npm --prefix back run lint / npm --prefix back run test / npm --prefix back run build.
- task-3: npm --prefix front run typecheck / npm --prefix front run test / npm --prefix front run export.
- API 검증은 현재 코드가 반영된 localhost:3000의 기존 개발 서버 및 실제 MySQL을 사용한다. 먼저 HTTP로 연결과 반영 여부를 확인한다. 서버가 없으면 검증 실패로 기록하고 사용자에게 npm --prefix back run start:dev 실행을 안내한다. 서버를 자동 실행하거나 다른 포트로 바꾸지 않는다.
- 프론트 서버가 필요한 확인은 기존 localhost:8081을 사용한다. 없으면 npm --prefix front run start -- --port 8081 실행을 안내하고 해당 검증 실패로 기록한다.
- 조회 검증을 위해 기존 콘텐츠·잔액·권한·시청 기록을 초기화하거나 시드하지 않는다. 인증 API 테스트는 자기 실행으로 생성한 로그인/토큰 이력만 생성·사용·폐기한다.
- HTTP 필수 시나리오: T0→T1→T2 이후 T0 재사용 시 T2도 401, 두 동시 갱신 중 하나 200/하나 401 후 승자 Refresh도 401, 별도 로그인 유지, 로그아웃 후 갱신 거부. 폐기 커밋이 후속 요청에 반영되는지 확인한다.
- 실제 iOS/Android SecureStore와 재실행 복원은 기기 확인 항목이다. 단위 테스트·export 통과를 기기 검증 성공으로 표시하지 않는다.

## 완료 조건
모든 Task checks 통과, 문서·API·DB 계약 일치, 로그인부터 갱신·폐기 및 프론트 저장·복원까지 검증. 기기 검증이 불가능하면 미검증 항목을 명시한다.

## 검증 결과
- 후속 요청에 따라 별도 로그인 UUID와 해당 JWT 클레임을 제거했다. 이후 OAuth 보안 권고 적용 요청을 반영해 단순 해시 덮어쓰기를 이력 보존과 로그인별 연쇄 폐기로 변경했다.
- 세 task 문서를 다시 열어 핵심 로직 코드, 정확한 files, checks, 완료 조건과 승인 범위의 일치를 검토했다.
- 이번 보완은 Task 1의 두 테이블/이력 구조, Task 2의 갱신·로그아웃·커밋 후 401과 HTTP 테스트, Task 3의 중복 갱신 방지/401 정리에 반영한다. Task 1에 refreshToken.entity.ts와 refresh_tokens.md를 추가해 파일 수는 13/22/13개다. 의존성·checks는 기존과 동일하다.
- 변경 후 전체 Task 본문과 index.json을 재검토했다. 파일 수 13/22/13, 검증 명령 각 3개, 의존성, pending 상태와 비중복 범위가 일치한다. 프론트 복원은 effect 재실행에서도 하나의 Promise를 공유해 응답 유실 뒤 자동 재사용하지 않도록 보완했다.
- node tools/harness/cli.mjs validate --plan plan-33-jwt-auth-session: 통과(valid: true, exit 0).
- 제품 구현 및 제품 검증은 아직 실행하지 않았다. 모든 Task는 pending이다.
