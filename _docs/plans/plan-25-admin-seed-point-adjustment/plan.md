# plan-25-admin-seed-point-adjustment

## 목표

개발용 시드로 이름이 admin인 ACTIVE OPERATOR 사용자와 지갑을 만들고 최초 100포인트를 원장과 함께 저장한다. 개발 환경에서 사용자 UUID를 대상으로 포인트 지급 및 회차 단건 구매 API를 제공한다. 범위 및 두 task 구성과 이후 회차 단건 구매 변경은 사용자 승인을 받았다.

## 범위와 비목표

- 기존 User, Wallet, PointTransaction, EpisodeEntitlement, Episode, Drama 테이블과 TypeORM 구조를 사용한다. 스키마 변경 및 마이그레이션은 없다. unlockTransactionId의 TypeScript 타입만 실제 정수 FK에 맞춘다.
- 시드 재실행은 최초 지급을 반복하거나 변경된 잔액을 초기화하지 않는다.
- 지급은 금액·사용자 UUID·중복 방지 키·선택 메모를 검증하고 잔액과 원장을 함께 저장한다. 회차 단건 구매는 서버가 회차 가격을 조회해 잔액·원장·권한을 동일 트랜잭션으로 저장한다. 구매 body와 클라이언트 지정 금액·중복 방지 키는 필요 없다.
- 정식 인증이 없으므로 NODE_ENV가 development인 경우에만 변경 API를 사용할 수 있다. admin은 이름과 OPERATOR 역할이며 로그인 계정·비밀번호를 새로 만들지 않는다.
- 프론트 연결, 외부 결제, 광고 보상, 회차 다중 구매, 조회 API, 정식 인증, 재생 API의 구매 권한 검사는 제외한다.
- web-prototype은 계획·실행·검증 대상이 아니다. 작업은 dev에서 수행하고 branch/worktree를 만들지 않는다.

## Task

추가 task-3: `task-3-point-errors.md`에 따라 사용자 제공 common/error 예시의 미사용 인증·권한·IP 코드를 정리하고 포인트 커스텀 오류를 연결한다. task-2 완료 후 순차 실행하며 정확한 소유 파일과 checks는 index.json에 선언한다. 이 추가 태스크는 기존 task 문서의 GET·OPTIONS 전용/서버 자동 시작 지침보다 최신 AGENTS.md를 따른다. 실제 POST 검증과 필요한 개발 데이터 변경을 허용하며 실행 중인 3000 서버를 사용한다. 서버가 없으면 자동 시작하지 않고 오류와 실행 안내를 출력한다.

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | admin 시드와 최초 100포인트 | `back/src/common/database/seed/initialData.ts`, `back/src/common/database/seed.ts`, `back/test/unit/database/initialData.spec.ts`, `back/test/unit/database/seed.spec.ts`, `back/README.md` | 고정 UUID 운영자, 지갑, 최초 지급 원장 및 재실행 보존 검증. 개발 DB에 명시적 시드 적용 후 저장 결과 확인 |
| 2 | 개발용 포인트 지급·회차 단건 구매 API | `back/src/app.module.ts`, `back/src/economy/economy.module.ts`, `back/src/economy/pointController.ts`, `back/src/economy/pointService.ts`, `back/src/economy/entities/episodeEntitlement.entity.ts`, `back/test/unit/economy/pointService.spec.ts`, `back/test/unit/economy/pointController.spec.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/05-economy/README.md`, `_docs/api/05-economy/points.md` | 포인트 지급, 서버 가격 기반 회차 단건 구매, 잔액·원장·권한의 원자적 저장 및 중복 구매 방지 |

## 실행 순서 및 병렬 작업

- task-1은 선행 의존성이 없다. task-2와 파일은 겹치지 않지만 병렬 실행하지 않는다.
- task-2는 task-1 완료 후 실행한다. 최초 지급과 개발 DB 저장 확인을 완료하고 변경 API의 검증을 진행한다.
- 실행은 apply_patch로만 수정하며 각 task의 index.json files 범위를 따른다. 이 계획 생성 단계에서는 제품 코드를 수정하거나 시드를 실행하지 않는다.

## API 계약

- 포인트 지급: `POST /users/:userUuid/points/increase`. 요청 `{ "amount": 10, "idempotencyKey": "unique-request-key", "memo": "선택 메모" }`. HTTP 200 응답 `{ "uuid": "거래 UUID", "amount": 10, "balanceAfter": 110 }`.
- 지급 amount는 1~2147483647 정수, 키는 공백만 아닌 1~100자 문자열, memo는 생략 또는 300자 이하 문자열이며 생략 시 null이다. ADMIN_ADJUSTMENT 원장을 저장한다. 같은 키의 동일 사용자·금액·메모는 첫 거래 결과를 반환하고 다른 요청에 사용한 키는 409다.
- 회차 단건 구매: `POST /users/:userUuid/episodes/:episodeUuid/purchaseSingle`. body 없음. controller/service 메서드도 purchaseSingle로 명명한다. 하이픈을 사용하지 않는다. 서버가 episodes.price_points를 조회하며 구매 금액을 클라이언트로부터 받지 않는다.
- 구매 응답 HTTP 200: `{ "episodeUuid": "회차 UUID", "entitlementUuid": "권한 UUID 또는 null", "chargedPoints": 10, "availablePoints": 90 }`. chargedPoints는 이번 요청의 실제 차감량이고 기존 권한 반환·무료 회차는 0이다. availablePoints는 잠금 후 처리 시점의 잔액이다.
- 사용자 및 공개 작품·회차를 확인하고 지갑 잠금 후 (userId, episodeId) 조건의 권한 한 건을 조회한다. 기존 권한이 있으면 같은 권한을 반환하고 추가 차감하지 않는다. 무료 회차는 차감·원장·신규 권한 생성 없이 성공 처리한다.
- 유료 신규 구매는 서버 가격만큼 차감하고 음수 EPISODE_UNLOCK 원장 및 POINT_PURCHASE 권한을 연결해 저장한다. 원장의 idempotency_key는 서버에서 생성하며 중복 구매는 지갑 잠금과 사용자·회차 UNIQUE 제약으로 막는다.
- 400: 잘못된 UUID/지급 입력 또는 지급 후 INT 범위 초과. 404: 사용자/지갑/회차 없음, 작품·회차 비공개/공개 예정, 개발 환경 외 접근. 없는 회차 메시지는 Episode not found다. 409: 잔액 부족 또는 지급 키 충돌. 실패 시 잔액·원장·권한 변경을 남기지 않는다.
- 공개 응답에 내부 숫자 ID를 노출하지 않는다. 범용 포인트 차감 API는 만들지 않는다.

## 검증 및 완료 조건

- 각 task checks: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
- API 검증 전 현재 코드를 반영한 개발 서버와 실제 MySQL 연결을 확인한다. 서버가 없으면 `npm --prefix back run start:dev`로 시작한다. 연결 실패/필수 데이터 부족은 실패다.
- Postman은 GET·OPTIONS만 사용하고 두 신규 경로의 CORS preflight를 검증한다. OPTIONS 성공이 실제 POST 라우트나 잔액 변경 동작의 증거는 아님을 문서에 명시한다.
- 지급·회차 가격 기반 차감·없는 회차·무료 회차·공개 조건·잔액 부족·중복 구매·동시성·rollback·환경 경계는 기존 데이터를 변경하지 않는 단위 테스트에서 검증한다. 실제 MySQL 변경 성공/잠금 동작을 HTTP 통합 검증했다고 보고하지 않는다.
- task-1의 시드 실행은 사용자가 요청한 개발 데이터 준비다. 테스트의 자동 시드나 DB 초기화가 아니며, 기존 개발 DB에 `npm --prefix back run db:seed`를 별도로 실행한다. 실행 전 기존 시드가 카탈로그 고정 데이터를 upsert하는 점을 확인한다. DB 생성·초기화·삭제는 하지 않는다.
- 새 admin에는 100 잔액과 단일 지급 원장, 재실행에는 잔액 및 거래 수 보존을 읽기 전용 조회로 확인한다. 이미 사용된 시드 지갑의 잔액을 100으로 강제 복원하지 않는다. 비밀 값은 환경 파일에만 둔다.

## 검증 결과

- 계획 작성 단계: 두 task 문서를 다시 열어 핵심 로직 예시, files 범위, 순차 의존성, 검증 명령 및 완료 조건 일치를 검토했다.
- `node tools/harness/cli.mjs validate --plan plan-25-admin-seed-point-adjustment`: 통과 (`valid: true`).
- 제품 구현 및 DB 적용은 아직 실행하지 않았다. 실제 검증 결과는 Harness 실행 시 기록한다.
