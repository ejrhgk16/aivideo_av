# plan-34-jwt-api-client

## 목표

기능마다 직접 fetch를 호출하고 사용자 UUID를 보내던 흐름을 JWT 기반 공통 요청으로 전환한다. Access 자동 첨부, 실행 중 Refresh 회전과 원래 요청 1회 재시도, 문자열 errorCode 기반 오류 분류와 공통 한국어 안내를 구현한다. 세션 만료는 루트의 공통 팝업으로 한 번만 안내하고, 조회 실패와 구매 실패는 각각 화면과 기존 구매 팝업에서 표시한다.

사용자가 범위와 3-task 구성을 승인했고, 후속 대화에서 공통 오류 메시지와 세션 만료 팝업 추가를 승인했다. 이 문서는 실행 계획이며 제품 코드는 아직 변경하지 않았다.

## 범위와 계약

- 공개 목록·홈·프리뷰 요청에는 인증을 붙이지 않는다. 작품 상세·회차 재생은 선택 인증, 구매·개발 포인트 지급은 필수 인증으로 분류한다.
- 선택 인증은 Authorization이 없을 때만 익명이다. 헤더가 있으면 유효한 Access여야 한다. 무료 회차라도 잘못된 토큰은 401이다.
- 작품 상세와 회차 재생에서 userUuid 쿼리를 제거한다. 서버 내부 조회용 UUID와 응답의 공개 UUID는 유지한다. 잔존 쿼리는 사용자 선택에 사용하지 않는다.
- POST /me/episodes/:episodeUuid/purchaseSingle, POST /me/points/increase로 변경하고 이전 사용자 UUID 경로를 제거한다. 두 작업의 개발 환경 제한은 유지한다.
- 공개된 무료 회차는 익명/로그인 모두 허용. 공개된 유료 회차는 익명 401, 로그인한 미구매 사용자 EPISODE_ACCESS_DENIED 403, 구매 사용자 200이다. 공개 대상이 없으면 기존 404를 유지한다.
- 백엔드 AUTH_INVALID_TOKEN 통합 코드를 유지한다. 만료·변조·폐기·재사용을 클라이언트에서 추측하지 않는다. 일반 인증 요청과 Refresh 요청의 발생 단계로 처리한다.
- 인증된 일반 요청의 401 + AUTH_INVALID_TOKEN에 한해서 갱신 후 원래 요청을 최대 한 번 재시도한다. /auth/* 요청, 미로그인 요청, 업무 403, 통신 실패와 5xx는 이 경로에서 재시도하지 않는다.
- Refresh 401은 로컬 인증 상태를 정리하고 세션 만료 신호를 한 번 발생시킨다. Refresh 통신 실패·5xx는 저장 토큰을 유지하며 자동 재호출하지 않는다. 응답 유실 또는 회전 후 저장 실패에서도 이전 Refresh를 자동 재사용하지 않는다.
- 세션 만료 팝업은 '로그인이 만료됐어요', '다시 로그인해 주세요.'와 '닫기'/'로그인' 동작을 제공한다. 로그인 버튼을 누른 경우에만 /login으로 이동한다. 현재 개발용 admin 자동 로그인은 명시적으로 /login에 들어간 경우에만 유지한다.
- 초기 조회 실패는 화면 오류/재시도, 구매 실패는 기존 구매 팝업 내부 오류로 안내한다. 성공한 자동 갱신에는 팝업을 띄우지 않는다.

## 비목표와 가정

- 로그인 폼, 웹 영구 로그인, 실제 결제, 새로운 JWT 발급/회전 정책, DB 스키마·시드 변경은 포함하지 않는다. 네이티브 SecureStore와 웹 메모리 저장 정책을 유지한다.
- 현재 Access 만료·변조는 같은 문자열 코드다. 새로운 서버 오류 코드를 추가하지 않는다. 오류 메시지 문자열이나 정규식으로 상태를 판정하지 않는다.
- 사용자별 API 검증에는 로그인 가능한 기존 구매/미구매 계정과 기존 entitlement/watch-progress 데이터가 필요하다. 현재 두 번째 fixture 사용자의 로그인 가능 여부는 미확인이다. 필요한 자격 정보는 환경에서 주입하고 컬렉션에 비밀을 기록하지 않는다. 데이터가 없으면 실패로 보고하며 읽기 검증용 DB 초기화·시드·entitlement 조작을 하지 않는다.
- 실제 POST 성공 검증은 기존 개발 계정에 한해 최소 데이터 변경을 허용한다. 기존 보유/미보유·잔액 부족 fixture를 훼손하지 않도록 마지막에 분리 실행하고 새 지급에는 충돌하지 않는 idempotencyKey를 사용한다. 반복 구매에 중복 차감이 없는지도 확인한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | backend-jwt-product-api | 백엔드 identity/content/economy, 관련 단위 테스트·Postman·API 문서. 정확한 파일은 task-1 및 index.json | 선택/필수 JWT 적용, UUID 입력 제거, /me 경로와 권한 계약 검증 |
| 2 | front-api-session-errors | 공통 HTTP·오류 메시지, 사용자 세션·Provider, 해당 테스트·실행 목록. 정확한 파일은 task-2 및 index.json | 공통 요청, 동시 갱신 공유, 세션 경합 방지, 오류 분류·만료 신호 |
| 3 | front-jwt-screens-expiration-dialog | 기능 API·상세/재생/구매 UI·루트·로그인·공통 팝업·테스트·문서. 정확한 파일은 task-3 및 index.json | JWT 호출 연결, 오류별 UI, 세션 만료 팝업 1회 표시 |

## 실행 순서 및 병렬 작업

- task-1과 task-2는 의존성이 없고 수정 파일이 겹치지 않아 병렬 실행 가능하다. 공통 계약은 이 계획과 task 문서의 인증 모드·오류 처리 규칙을 따른다.
- task-3은 task-1과 task-2가 모두 완료된 뒤 실행한다. 확정된 /me API와 공통 요청/세션 인터페이스가 필요하다.
- task-3은 task-2의 front/scripts/test-front.cjs와 task-1의 _docs/api/00-overview/authentication.md를 이어서 수정하므로 선행 변경을 보존한다. task-3과 선행 task의 병렬 실행은 금지한다.
- 모든 worker는 승인된 자신의 파일만 수정한다. 다른 worker의 변경을 되돌리지 않고 현재 코드를 반영한다. 이 계획 작성 단계에서는 worker를 실행하지 않는다.

## 검증과 완료 조건

- task-1: npm --prefix back run lint / npm --prefix back run test / npm --prefix back run build. test는 단위 테스트와 실제 HTTP Postman 테스트를 모두 포함한다.
- task-2·task-3: npm --prefix front run typecheck / npm --prefix front run test / npm --prefix front run export.
- API 테스트 전 localhost:3000에 HTTP 요청을 보내고 현재 코드 반영을 확인한다. 서버가 없으면 실패 처리하고 npm --prefix back run start:dev를 안내한다. 서버 자동 실행·다른 포트 우회는 금지한다. UI 서버가 필요한 검증도 localhost:8081을 사용하고 없으면 npm --prefix front run start -- --port 8081을 안내한다.
- Bearer 자동 첨부/공개 요청 제외, 동시·지연 401의 갱신 1회, 최대 재시도 횟수, Refresh 재사용 방지, 로그아웃/계정 전환 뒤 늦은 응답 무시를 테스트로 확인한다.
- errorCode별 안내, 알 수 없는 오류 fallback, 세션 만료 팝업의 중복 방지/닫기/명시적 로그인, 화면별 조회 재시도와 구매 오류 처리를 검증한다.
- 네이티브 실기기 검증을 수행하지 못하면 export 성공과 구분해서 한계로 기록한다. 계획 검증 성공은 제품 테스트 통과를 뜻하지 않는다.

## 검증 결과

- 제품 검증: 미실행. 각 task는 pending이다.
- 계획 검증: 3개 task 본문을 다시 열어 핵심 로직 예시·수정 파일·의존성·checks·완료 조건을 대조했다. node tools/harness/cli.mjs validate --plan plan-34-jwt-api-client가 종료 코드 0, valid: true로 통과했다.
