# plan-26-front-global-data

## 목표

Context API로 현재 사용자, 사용자별 포인트 잔액, 재생 설정을 공유하고 기존 포인트 표시를 같은 상태에 연결한다. 사용자 정보·포인트·재생 설정은 별도 Context로 구성한다. 범위와 task 구성이 사용자에게 각각 승인되었다.

초기 사용자는 null, 포인트는 미조회(null)로 시작한다. 사용자 변경 시 포인트를 초기화하고 이전 사용자 작업 결과가 현재 잔액에 반영되지 않게 한다. 자막 기본값은 true, 다음 화 자동 재생 기본값은 false다.

추가 승인 범위: users에 로그인용 loginId(물리 컬럼 login_id)와 password(현재는 원문 저장)를 추가하고 개발 시드 계정을 admin/admin으로 준비한다. POST /auth/login은 { loginId, password }를 받아 loginId/password와 ACTIVE 상태를 WHERE에서 함께 비교하고 사용자·지갑을 LEFT JOIN 한 번으로 조회한다. 해시 생성·검증·암복호화는 이번 단계에서 제외한다. 컨트롤러는 요청값 검증 후 서비스 입력을 admin/admin으로 임시 치환한다. 이 두 대입문만 제거하면 요청값으로 로그인된다. 서비스에는 admin UUID/displayName 고정 조회나 하드코딩 분기를 두지 않는다. 성공 시 { uuid, displayName, accountType, availablePoints }를 반환하고 useLogin(input)이 사용자와 잔액을 함께 Context에 반영한다. 로그인 화면·자동 호출·토큰·서버 세션은 추가하지 않는다.

비목표: Redux·캐시 라이브러리 도입, 실제 구매·충전 연동, 별도 잔액 조회 API, 소셜 로그인·토큰·서버 세션, 저장 목록·구매 권한·시청 기록 관리, 실제 자막·자동 재생 구현, 영구 저장, 헤더·하단 탭 구조 변경. 현재 재생 설정 UI의 준비 중 표시는 유지한다. 로그인 요청 중 admin·지갑 자동 생성이나 포인트 지급은 하지 않는다. 별도 명시적 시드 실행에서는 admin/admin 자격 증명만 준비하고 기존 최초 포인트 지급의 중복 방지 규칙을 유지한다.

영향 레이어는 front/src/features의 상태·로그인 요청과 훅, app의 Provider 조합, components/screens의 상태 소비, back/src/identity의 사용자 컬럼·비밀번호 비교·로그인 API, DB 마이그레이션·시드와 AppModule 등록, 제품 테스트 및 API·아키텍처 문서다. 공통 환경 설정이나 기존 요청 모듈 리팩토링은 하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | Context와 전역 상태 구성 | `front/src/features/user/UserProvider.tsx`, `front/src/features/points/PointsProvider.tsx`, `front/src/features/points/pointsState.ts`, `front/src/features/playback/PlaybackSettingsProvider.tsx`, `front/src/app/_layout.tsx`, `front/tests/unit/pointsState.test.ts`, `front/scripts/test-front.cjs`, `_docs/ARCHITECTURE.md` | 상태·갱신 훅, 사용자별 초기화, 루트 연결과 상태 테스트 |
| 2 | 공통 포인트 데이터 화면 연결 | `front/src/components/AppTopBar.tsx`, `front/src/components/EpisodeUnlockDialog.tsx`, `front/src/screens/AccountScreen.tsx`, `front/src/screens/PointsScreen.tsx` | 공통 잔액·상태 소비와 내 정보 사용자 표시 |
| 3 | 사용자 로그인 컬럼·admin 시드·로그인 API | `back/src/identity/identity.module.ts`, `back/src/identity/loginController.ts`, `back/src/identity/loginService.ts`, `back/src/common/error/error.enum.ts`, `back/src/common/error/error.customExceptions.ts`, `back/src/app.module.ts`, `back/test/unit/loginController.spec.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/01-identity/login.md`, `_docs/api/00-overview/conventions.md`, `_docs/api/01-identity/README.md`, `_docs/api/README.md`, `_docs/ARCHITECTURE.md`, `back/src/identity/entities/user.entity.ts`, `back/src/common/database/migrations/20261027000000AddUserLoginCredentials.ts`, `back/src/common/database/seed.ts`, `back/src/common/database/seed/initialData.ts`, `back/test/unit/database/seed.spec.ts`, `back/test/unit/database/initialData.spec.ts`, `back/test/unit/entities/entities.spec.ts`, `_docs/AI_DRAMA_data_model/01-identity/users.md` | loginId/password 컬럼, admin/admin 원문 시드, WHERE 자격 증명 비교·단일 JOIN, custom 오류와 테스트 |
| 4 | 프론트 로그인 요청과 Context 연결 훅 | `front/src/features/user/login.ts`, `front/src/features/user/useLogin.ts`, `front/tests/unit/login.test.ts`, `front/scripts/test-front.cjs` | login(input) 요청, 사용자·포인트 동시 반영, 요청 테스트 |

## 실행 순서 및 병렬 작업

- task-1은 선행 의존성이 없으며 먼저 실행한다. 다른 task는 직접 또는 간접적으로 task-1에 의존한다.
- task-2는 task-1 완료 후 실행한다. Context 계약이 필요하다.
- task-3은 task-1 완료 후 실행한다. `_docs/ARCHITECTURE.md`를 함께 수정하므로 순차 처리한다.
- task-2와 task-3은 task-1 완료 후 병렬 실행 가능하다. 변경 파일이 겹치지 않는다.
- task-4는 task-1과 task-3 완료 후 실행한다. 사용자 Context 및 API 계약이 필요하고 test-front.cjs는 task-1 수정 이후에 편집해야 한다. task-3이 task-1에 의존하지만 직접 의존성도 명시해 계약 관계를 드러낸다.
- task-2가 아직 진행 중이면 task-4와 병렬 실행 가능하다. 변경 파일이 겹치지 않는다. 단, 다른 task가 파일을 편집 중일 때 최종 통합 검증을 확정하지 않는다.

## 검증 및 완료 조건

- 로그인은 HTTP 요청 한 번과 사용자·지갑 LEFT JOIN DB 조회 한 번으로 처리한다. 결과 행이 없으면 로그인 실패이며, 자격 증명이 일치하는 행의 availablePoints가 null이면 0으로 응답한다. 실제 0 잔액과 양수 잔액도 그대로 유지한다. 지갑 누락 예외나 지갑 자동 생성은 추가하지 않는다.
- 로그인 업무 오류는 기존 BaseException/AllExceptionFilter로 통일한다. 입력 오류는 AUTH_INVALID_LOGIN_INPUT(400), 자격 증명 불일치·사용자 로그인 불가는 AUTH_LOGIN_FAILED(401)이다. task-3의 추가 변경 파일은 `back/src/common/error/error.enum.ts`, `back/src/common/error/error.customExceptions.ts`, `_docs/api/00-overview/conventions.md`이며 정확한 전체 목록은 plan index와 task 문서를 따른다. 컨트롤러의 임시 admin/admin 치환 이후에도 서비스는 실제 DB 자격 증명을 검사한다. 환경별 로그인 차단은 두지 않는다. DB 내부 오류를 로그인 실패로 변환하지 않는다.

- 프론트 task-1·2·4에서 `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`를 모두 실행한다.
- 백엔드 task-3에서 `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`를 모두 실행한다. test에는 실제 MySQL과 기존 개발 API를 사용하는 Postman 테스트가 포함된다. 실행 전 back/test/api/README.md를 읽고 localhost:3000 HTTP 연결과 현재 코드 반영 여부를 확인한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 서버가 없으면 실패와 `npm --prefix back run start:dev` 실행 안내를 기록한다.
- 로그인 HTTP 검증은 loginId/password JSON 본문으로 실제 POST를 호출하고 필수 입력 400, admin 공개 필드와 포인트, 유효 입력의 admin 임시 치환, 내부 ID·토큰·세션 미노출을 확인한다. 이번 변경에 필요한 스키마 적용과 명시적 admin 시드 보완을 허용하되 DB reset과 기존 사용자·지갑·원장 삭제는 하지 않는다. synchronize 상태를 확인해 중복 DDL을 피한다. 서비스의 잘못된 자격 증명 custom 401 및 사용자/비밀번호/지갑 경계는 최소 단위 테스트로 검증한다.
- 프론트 로그인 테스트는 POST URL·JSON 입력·응답 잔액(0 포함)·실패 전달을 검증한다. 훅은 성공 후에만 사용자와 초기 잔액을 함께 전달하며 자동 로그인 호출점은 없다. 비밀번호를 수정하거나 로그에 출력하지 않는다.
- 상태 테스트로 미조회와 0 잔액 구분, 로그인 초기 잔액, 서버 잔액으로 교체, 초기화, 다른 사용자 결과 무시를 검증한다. 로그인 시 setUser 다음에 이전 PointsScope로 잔액을 보내는 갱신 유실을 피하고 초기화 스냅샷으로 전달한다.
- 네 표시 위치가 같은 포인트 훅을 사용하고 사용자 전환 시 이전 잔액을 노출하지 않는지 코드와 상태 테스트로 확인한다. 화면 통합 동작 검증과 순수 상태 테스트의 범위를 구분해 보고한다.
- 실행 중인 앱을 추가 확인한다면 localhost:8081을 사용한다. 서버가 없으면 자동 실행하거나 다른 포트를 사용하지 말고 실패와 `npm --prefix front run start -- --port 8081` 안내를 기록한다.
- 제품 코드는 계획 생성 단계에서 변경하지 않는다. 실행 검증 결과는 harness 실행 시 기록한다.

## 검증 결과

- 계획 생성 시: 모든 task 문서를 다시 열어 주요 로직 예시·파일 범위·완료 조건을 검토했다. `node tools/harness/cli.mjs validate --plan plan-26-front-global-data` 통과(`valid: true`).
- 제품 검증: 미실행(계획 단계).
- 로그인 계약 재검토: loginId/password 입력, WHERE 자격 증명 비교, 단일 LEFT JOIN, 실제 잔액 반환, custom 오류와 프론트 요청 타입을 대조했다. 시드의 select:false 비밀번호 명시 조회와 컨트롤러 입력 검증 예시를 보완했다. 실제 로그인 API·프론트 요청 모듈·신규 컬럼은 아직 구현되지 않았다.
