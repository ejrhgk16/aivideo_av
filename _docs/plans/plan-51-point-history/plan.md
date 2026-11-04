# plan-51-point-history

## 목표

기존 point_transactions 원장으로 로그인한 사용자의 포인트 이용 내역 조회 API를 추가하고, 프론트 포인트 화면의 이용 내역 탭에 연결한다. 사용과 함께 충전·광고 보상·관리자 조정·환불 등 실제로 기록된 모든 증감을 표시해 잔액 변동을 확인할 수 있게 한다.

사용자는 범위를 승인한 뒤 4개 task의 정확한 수정 파일·의존성·검증 명령도 승인했다. 이 plan 생성은 실행 승인이 아니며 제품 구현은 별도의 명시적 `$harness` 호출로 시작한다.

## 승인된 범위와 비목표

- 백엔드: economy의 기존 controller/service/response 파일에서 읽기 전용 목록 조회를 추가한다. 기존 QueryBuilder와 공통 페이지 처리기를 사용한다.
- 프론트: economy 요청·응답 타입과 PointsScreen의 이용 내역 상태·UI를 구현한다. 상태는 해당 화면이 소유한다.
- 문서: API 목록·economy 계약·인증 목록과 프론트 연결 상태를 해당 변경에 한해 갱신한다.
- DB 스키마·entity·migration·기존 원장 기록 경로는 변경하지 않는다.
- 결제 충전, 광고 보상 지급, 환불 실행, 관리자 조정 기능을 새로 만들지 않는다. 기록된 거래를 조회하는 기능이다.
- 유형 필터·기간 검색·검색·내보내기·회차 이동은 추가하지 않는다. 기존 충전 탭의 예시 상품과 비활성 버튼은 유지한다.
- 공통 HTTP·세션·구매 로직, 상단 현재 잔액의 갱신 정책은 변경하지 않는다. 거래 직후 잔액을 현재 잔액으로 덮어쓰지 않는다.
- 기존 원장에는 거래 당시 작품명 snapshot이 없으므로 연결된 현재 공개 작품명·회차를 표시한다. 연결이 사라지거나 비공개가 되면 거래는 유지하고 회차 정보만 null로 한다.
- 작업·검증에서 web-prototype/을 제외한다. branch/worktree 생성과 Git 명령은 수행하지 않는다.

## 승인된 API 계약

### 요청·인증·페이지

- `GET /me/points/transactions?page=1`, Access JWT 필수. 검증된 request.user.uuid만 조회 대상으로 사용한다.
- 요청 경로·본문·query의 다른 사용자 UUID는 조회 대상을 바꾸지 않는다.
- 이 GET은 개발 환경 제한이 없다. 기존 두 POST의 개발 환경 제한은 유지한다.
- page 생략은 1. `parsePage(rawPage, 30)`의 기존 규칙을 그대로 사용한다. 0·음수·소수·배열/중복 page·공백·비숫자·안전 범위를 벗어난 값은 공통 400이다.
- 고정 30개. `getPageWindow`의 31개 lookahead와 `createPageResponse`를 사용한다. `created_at DESC, id DESC`로 정렬한다.
- 성공 응답은 아래 정확한 키를 사용한다. 빈 결과 및 마지막 다음 페이지는 items: [], hasNext: false다. 총 개수는 반환하지 않는다.

```typescript
type PointTransactionType =
  | 'PURCHASE' | 'AD_REWARD' | 'EPISODE_UNLOCK' | 'ADMIN_ADJUSTMENT' | 'REFUND';
type PointHistoryItem = {
  uuid: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  episode: { dramaTitle: string; episodeNumber: number } | null;
};
type PointHistoryPage = {
  items: PointHistoryItem[];
  page: number;
  hasNext: boolean;
};
```

- amount는 저장된 부호 있는 정수, balanceAfter는 저장된 거래 직후 잔액이다. createdAt은 저장된 UTC 값을 ISO 8601 Z 문자열로 직렬화한다. 기존 시간 기본값·과거 데이터는 이번에 보정하지 않는다.
- EPISODE_UNLOCK만 `episode_entitlements.unlock_transaction_id`와 원장 내부 ID를 연결한다. entitlement의 사용자도 원장 사용자와 같아야 한다.
- 작품과 회차 모두 PUBLISHED이고 publishedAt이 현재 UTC 이하인 경우에만 episode 정보를 반환한다. 공개 조건은 LEFT JOIN의 조건/응답 매핑에 적용하며 원장 행을 WHERE로 제거하지 않는다.
- 다른 유형, 연결 없음, 비공개·공개 예정 작품/회차는 episode: null이다. 회차 정보와 무관하게 모든 원장 행은 목록에 남는다.
- 내부 숫자 ID, wallet_user_id, idempotency_key, memo는 노출하지 않는다. 응답 숫자는 JSON number이며 원장 중복 행을 만들지 않는다.
- 인증 누락·잘못된 Access는 401 AUTH_INVALID_TOKEN, 잘못된 page는 400 HTTP_BAD_REQUEST. 오류 응답은 기존 공통 다섯 필드다. 기존 목록 API처럼 거래가 없으면 200 빈 목록이며 지갑 생성·수정은 하지 않는다.

### 프론트 계약

- `getPointHistory(page = 1)`는 `apiRequest`를 통해 GET /me/points/transactions?page=N을 auth: required로 호출한다.
- PointsScreen의 history 탭과 `?tab=history` 진입을 지원한다. charge 탭만 보고 있을 때 조회하지 않는다.
- 로그인 복원 중에는 대기, 익명 상태에서는 로그인 안내를 표시한다. 복원 완료 후 로그인 사용자만 요청한다.
- 거래 유형은 PURCHASE=포인트 충전, AD_REWARD=광고 보상, EPISODE_UNLOCK=회차 구매, ADMIN_ADJUSTMENT=관리자 조정, REFUND=환불로 표시한다.
- amount는 +100 P/-30 P처럼 부호와 한국식 천 단위 구분을 표시한다. 거래 직후 잔액·일시를 함께 표시하고 episode가 있으면 작품명과 N화를 표시한다. null이면 일반 유형 문구를 표시한다.
- 날짜는 장치 시간대와 관계없이 Asia/Seoul로 표시한다. 예: 2026-11-03T18:04:00.000Z → 2026.11.04 03:04. 기존 deps만 사용한다.
- 첫 페이지 로딩·빈 내역·첫 조회 실패와 재시도, 다음 페이지 로딩·실패 재시도·더 보기를 제공한다. 다음 페이지 실패 시 기존 행은 유지한다.
- 더 보기는 마지막 성공 page + 1을 요청한다. 중복 클릭을 막고 uuid로 중복 행을 제거하며 hasNext가 false이면 추가 요청하지 않는다.
- history 탭 진입/재진입과 화면 재포커스 시 첫 페이지를 새로 조회한다. blur·unmount·탭 변경·계정/세션 버전 변경 후 이전 응답은 무시한다.
- 계정/세션이 바뀐 렌더에서는 이전 계정 행이 노출되지 않아야 한다. 공통 isCurrentSession과 화면 요청 세대·소유자 검사를 사용한다.
- 응답의 balanceAfter로 UserProvider의 현재 points를 변경하지 않는다. 기존 공통 오류 안내·세션 갱신을 재사용한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | API 테스트 작성 | `back/test/api/point-history.postman_collection.json`, `pointHistoryFixtures.mjs`, `run.mjs`, `suites.mjs`, `README.md`, `back/test/unit/api/suiteSelection.spec.ts` | HTTP 계약·소유 fixture·suite 등록을 작성하고 정적 검사·시나리오 검토 |
| 2 | API 구현·검증 | `back/src/economy/pointController.ts`, `pointService.ts`, `pointResponses.ts`, API 문서 4개 | 읽기 전용 조회·문서 갱신 후 신규 HTTP와 기존 경제·실행기 회귀 검증 |
| 3 | 프론트 테스트 작성 | `front/tests/unit/pointHistory.test.ts`, `pointsScreen.test.ts` | 요청·표시·페이지·오류·계정 변경 계약 테스트 작성·검토 |
| 4 | 프론트 연결·검증 | `front/src/features/economy/pointHistory.ts`, `economyResponses.ts`, `front/src/screens/PointsScreen.tsx`, `front/README.md` | 이용 내역 탭 연결 후 신규·기존 구매 테스트 실행 |

정확한 repository-relative 수정 허용 파일과 checks는 plan-local index.json과 각 task 문서에 일치하도록 선언한다. checks에서 실행하는 읽기 전용 테스트는 수정 파일 목록에 추가하지 않는다.

## 실행 순서 및 병렬 작업

- task-1과 task-3은 선행 조건이 없으며 백엔드/프론트 테스트 파일이 독립적이므로 병렬 작성할 수 있다. 이 단계에는 구현 전 동작 테스트를 실행하지 않는다.
- task-2는 task-1 완료 후 실행한다. task-3이 진행 중이면 task-2와도 병렬 가능하다. 수정 파일·출력 경로가 다르며 task-3은 DB나 서버를 사용하지 않는다.
- task-4는 task-2와 task-3 완료 후 실행한다. 검증된 API 계약과 작성 완료된 프론트 테스트를 받아 구현한다.
- 같은 파일을 수정하는 동시 task는 없다. 백엔드 HTTP 검증은 task-2 한 곳에서 순차 실행하며 같은 서버를 대상으로 하는 외부 테스트와는 기존 content lock을 준수한다.
- point-history suite는 공개된 실행별 작품/회차 fixture를 만들므로 exclusive content lock을 사용한다. 기존 콘텐츠를 바꾸지 않아도 독자가 변하는 카탈로그를 비교하지 않도록 한다.
- 각 테스트 실행은 기존 runner의 별도 임시 폴더·실행별 사용자/UUID를 사용한다. 프론트 선택 테스트는 한 명령에서 실행하므로 컴파일 출력 경합이 없다.
- 모든 task는 메인 0뎁스 → harness_worker 1뎁스만 허용한다. 설계 판단이 필요한 작업이므로 반복 작업의 2뎁스 위임은 허용하지 않는다.
- 동시 실행 예산은 메인 1 + task worker 최대 2 = 최대 3개다. 하위 에이전트 예약은 0개이며 전체 상한 6개 이내다.

## 검증 계획과 영향 근거

- task-1: 새 .mjs와 기존 실행기/선택기의 node --check, 컬렉션 JSON 파싱만 실행한다. suiteSelection의 기능 검증은 task-2가 수행한다.
- task-3: 미구현 인터페이스를 참조하므로 checks: []로 둔다. API/화면 시나리오를 검토하고 task-4가 실행할 준비가 됐음을 보고한다. 테스트 통과를 의미하지 않는다.
- task-2: suiteSelection 및 fixtureIsolation 단위 테스트, point-history+economy 선택 HTTP, 무인자 전체 HTTP를 실행한다. 공통 runner/suite 등록이 바뀌므로 영향이 economy에만 국한되지 않아 전체 HTTP 회귀가 필요하다.
- task-4: pointHistory 및 pointsScreen의 신규 테스트와 episodePurchase 및 episodeUnlockDialog 회귀 테스트를 정확한 경로로 실행한다. 공통 요청·세션 로직을 바꾸지 않고 조회 요청 및 한 화면에 영향이 한정되므로 task에서 프론트 전체 검증을 반복하지 않는다.
- 실제 HTTP 검증은 현재 변경이 반영된 기존 http://localhost:3000 및 같은 MySQL을 사용한다. 서버 연결과 새 route 반영을 먼저 확인한다. 반영 여부가 불명확하면 사용자에게 확인하며 실패/미실행을 통과로 처리하지 않는다.
- 수동 프론트 확인 시 기존 http://localhost:8081만 사용한다. 서버가 없으면 자동 시작·다른 포트 우회 없이 검증 실패/미실행을 명시하고 사용자에게 실행 명령을 안내한다.
- 서버 실행 안내: `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`.
- DB reset·seed 실행·기존 사용자/잔액/원장 수정은 금지한다. 소유 fixture 준비·정리 실패, 연결·필수 데이터·assertion 실패는 검증 실패다.
- 실제 Expo API를 작성하기 전 front/AGENTS.md의 버전별 Expo 문서 확인을 수행한다. 이번 계획 작성에서는 제품 코드를 작성하지 않는다.
- 최종 `$finish-plan`은 모든 task checks와 변경 제품의 전체 검증을 담당한다. 계획 작성 중에는 제품 테스트·구현·Git 조작을 하지 않는다.

## 계획 작성 검토

- task별 입력에 승인된 계약을 포함하고 전체 plan 재독을 필수로 요구하지 않는다.
- 테스트/fixture/runner 수정은 task-1 또는 task-3에만, 제품 코드·제품/API 문서는 task-2 또는 task-4에만 배정한다.
- source task가 테스트를 수정·약화하여 통과시키지 않도록 하고, 결함 발견 시 증거를 보고해 범위가 정해진 테스트 수정을 요청한다.
- 새 task 문서를 다시 열어 핵심 코드·파일 범위·조건부 참고·의존성·checks를 검토한 뒤 validate한다.
- 계획 생성 시점의 제품 검증 결과는 없음. 실행 결과는 후속 Harness task 완료 결과로 기록한다.

## 생성 검증 결과

- 네 task 문서를 다시 열어 승인된 계약·핵심 코드·정확한 수정 파일·역할별 읽기 범위·선행 조건·checks·위임 제한을 검토했다.
- 테스트 작성과 제품 구현의 수정 파일을 분리했고, 기능/회귀 검사는 해당 소스 task가 수행하도록 확인했다.
- `node tools/harness/cli.mjs validate --plan plan-51-point-history`: 종료 코드 0, valid: true.
- 제품 코드 변경·기능 테스트·worker 실행·Git 조작은 수행하지 않았다. 네 task는 모두 pending이다.
