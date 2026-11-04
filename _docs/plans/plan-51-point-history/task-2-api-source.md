# task-2-api-source

## 기본 입력

- 이 task 문서와 index.json의 task-2 항목
- 컨텍스트로 전달된 적용 지침과 task-1의 테스트 작성·정적 검사·fixture 계약 완료 요약
- task-1 완료 후 실행한다. 역할은 소스 구현 및 테스트 실행이다.

## 읽어야 할 파일

- `back/src/economy/pointController.ts`, `pointService.ts`, `pointResponses.ts`: 기존 지급/구매 경로·응답을 보존하고 조회를 추가할 위치
- `back/src/economy/entities/pointTransaction.entity.ts`, `episodeEntitlement.entity.ts`: 거래/권한 관계와 고유 제약
- `back/src/content/entities/drama.entity.ts`, `episode.entity.ts`, `back/src/identity/entities/user.entity.ts`: UUID 사용자 제한·회차·작품 공개 조건에 필요한 필드
- `back/src/common/pagination/pagination.ts`, `paginationResponses.ts`: 기존 parsePage/getPageWindow/createPageResponse/PageResponse 계약
- `_docs/api/05-economy/points.md`: 현재 두 POST 계약과 개발 환경 제한
- `_docs/api/README.md`, `_docs/api/05-economy/README.md`: API 목록의 economy 소개 구간
- `_docs/api/00-overview/authentication.md`: 사용자 귀속 API의 JWT 목록 구간

## 필요 시 참고할 문서

- 전달되지 않았거나 변경된 적용 `AGENTS.md`만 다시 확인한다.
- `_docs/ARCHITECTURE.md`의 Backend, 시간 저장·비교·표시 기준: 전달된 관련 내용으로 해결되지 않는 계층 경계·UTC 처리 판단이 필요할 때만 참고한다. 파일 책임/계층은 변경하지 않는다.
- `_docs/api/00-overview/conventions.md`: 오류/시간/응답 규칙에 충돌이 의심될 때 확인한다. 공통 계약을 변경하지 않는다.
- `back/test/api/README.md`: 실제 HTTP 실행 전 연결·필수 데이터·소유 fixture·외부 환경 전제를 확인한다. 서버가 없으면 자동 시작하지 않는 루트 지침이 우선한다.
- `plan.md`의 승인된 API 계약: 본 task에 없는 계약 누락·충돌이 있을 때만 참고한다.
- 실제 API 구현 시 `api-and-interface-design`, `nestjs-best-practices` 스킬의 적용 지침을 사용한다. 사용자 승인 범위를 확장하지 않는다.

## 실패 시 참고할 파일

- `back/test/api/point-history.postman_collection.json`: 실패한 요청과 정확한 응답 assertion
- `back/test/api/pointHistoryFixtures.mjs`, `run.mjs`: fixture 준비·기대 배열·불변성 스냅샷·정리 실패 지점
- `back/test/api/suites.mjs`, `back/test/unit/api/suiteSelection.spec.ts`, `fixtureIsolation.spec.ts`: suite 선택·등록·소유 사용자 정리 오류 지점
- `back/test/api/economy.postman_collection.json`: 기존 지급·중복 요청·구매 회귀가 실패한 경우 해당 요청만 확인한다.
- 테스트 실행만을 위해 이 파일들의 전체 구현을 먼저 읽지 않는다. 테스트 결함은 재현 증거를 보고하고 별도 범위의 수정을 요청한다.

## 작업

### 역할과 완료 조건

소스 구현 및 테스트 실행 task로서 아래 파일만 수정한다.

```text
back/src/economy/pointController.ts
back/src/economy/pointService.ts
back/src/economy/pointResponses.ts
_docs/api/README.md
_docs/api/05-economy/README.md
_docs/api/05-economy/points.md
_docs/api/00-overview/authentication.md
```

checks:

```text
npm --prefix back run test:unit -- test/unit/api/suiteSelection.spec.ts test/unit/api/fixtureIsolation.spec.ts
npm --prefix back run test:api -- --suite point-history --suite economy
npm --prefix back run test:api
```

task-1은 테스트 준비 완료일 뿐 실제 기능 통과가 아니다. 구현 후 모든 checks를 실행·통과해야 본 task를 완료한다. 공통 실행기/suite가 바뀌므로 무인자 전체 API 회귀도 필요하다. 선택 검증이 통과했다고 전체 실행을 생략하지 않는다. 테스트·fixture·실행기를 이 task에서 수정하거나 assertion을 약화하지 않는다.

### 고정 계약과 구현

- 기존 PointController의 `@Controller('me')`, 클래스 JWT guard를 재사용해 `@Get('points/transactions')`를 추가한다.
- request.user.uuid만 사용하고 query의 사용자 UUID는 받지 않는다. page는 `@Query('page') rawPage: unknown`을 parsePage(rawPage, POINT_HISTORY_PAGE_SIZE)로 파싱한다.
- `POINT_HISTORY_PAGE_SIZE = 30`을 pointService.ts에 둔다. 공통 페이지 helper는 수정하지 않는다.
- GET 메서드에서 assertDevelopment를 호출하지 않는다. 기존 POST의 assertDevelopment 호출·validation·응답·write 동작은 보존한다. 비개발 서버를 새로 띄우거나 환경을 바꿔 검증하지 말고 GET에 환경 분기가 없는 것을 코드 검토로 확인한다.
- pointResponses.ts에 `PointTransactionType`, `PointHistoryItemResponse`, `PointHistoryPageResponse`를 추가한다. PageResponse를 type import하고 새 공개 메서드의 Promise 반환 타입을 명시한다.
- item 정확한 키: uuid, transactionType, amount, balanceAfter, createdAt, episode. root 정확한 키: items, page, hasNext.
- transactionType은 PURCHASE/AD_REWARD/EPISODE_UNLOCK/ADMIN_ADJUSTMENT/REFUND다. amount는 부호 있는 JSON 정수, balanceAfter는 저장된 거래 직후 정수, createdAt은 UTC ISO Z다.
- episode는 `{ dramaTitle: string, episodeNumber: number } | null`. EPISODE_UNLOCK 원장 → 같은 사용자 entitlement.unlockTransactionId → 회차 → 작품을 LEFT JOIN한다.
- 회차/작품이 PUBLISHED이고 각각 publishedAt이 현재 UTC 이하일 때만 표시한다. 공개 필터는 JOIN 조건으로 적용하며 원장 행을 제거하는 WHERE 조건으로 넣지 않는다.
- 공개 정보가 없는 거래도 목록과 페이지 개수에 그대로 포함한다. 조인은 거래당 최대 한 행이어야 한다. 기존 unlock_transaction_id 고유 제약을 사용한다.
- 원장은 JWT 사용자 조건만으로 필터하고 createdAt DESC/id DESC, 31개 lookahead와 공통 페이지 결과를 사용한다. 숫자 ID는 정렬·조인에만 쓴다.
- 내부 ID, wallet user ID, idempotency key, memo는 SELECT/응답에서 제외한다. balanceAfter로 현재 잔액을 재계산하지 않는다.
- 지갑이 없거나 원장이 없는 사용자는 200 빈 목록이다. 조회 중 지갑/권한/원장 INSERT·UPDATE·DELETE, 잠금·조회용 지급·seed는 하지 않는다.
- page 기본/검증·범위 끝은 공통 helper 그대로다. 인증 오류는 401 AUTH_INVALID_TOKEN, page 오류는 400 HTTP_BAD_REQUEST이며 기존 공통 다섯 오류 필드를 유지한다.
- UTC 직렬화는 기존 UTC 드라이버를 전제로 new Date(row.createdAt).toISOString()을 사용한다. 과거 값과 원장 CURRENT_TIMESTAMP 기본값을 이번 작업에서 변경하지 않는다.

### 문서 갱신

- `_docs/api/README.md`: economy에 본인 포인트 내역 조회가 제공됨을 같은 작업에서 반영한다. 해당 설명만 수정한다.
- `_docs/api/05-economy/README.md`: 링크 설명에 이용 내역 조회를 포함한다.
- `_docs/api/05-economy/points.md`: GET 요청/page, 정확한 성공 예시, 거래 유형, UTC, 30개/hasNext/동일 시각 정렬, 본인 격리, 숨겨진 콘텐츠의 episode:null과 거래 유지, 오류, 비개발 GET 노출을 명시한다. 기존 두 변경 POST의 개발 전용 제한과 구분한다.
- `_docs/api/00-overview/authentication.md`: 필수 JWT 사용자 귀속 endpoint 목록에 새 GET을 추가하고 개발 환경 제한은 기존 POST에만 적용됨을 명확히 한다.
- 관계·파일 책임·스키마는 바꾸지 않아 ARCHITECTURE나 데이터 모델 변경은 필요 없다. 다른 문서의 기존 오래된 설명은 이 작업과 관련된 구간 외에는 수정하지 않는다.

### 서버와 검증

- HTTP 대상은 기존 http://localhost:3000과 그 서버의 MySQL이다. 연결 확인 뒤 인증된 새 route가 현재 코드를 반영하는지 확인한다. 반영 여부가 불명확하면 사용자에게 확인한다.
- 서버가 없으면 실패를 기록하고 `npm --prefix back run start:dev`를 안내한다. 자동 실행·다른 포트 우회는 하지 않는다.
- 새 suite는 실행별 fixture만 쓰고 기존 데이터 reset/seed·기존 사용자 잔액/원장을 변경하지 않는다.
- 원장·잔액·권한의 조회 전후 동일성, 정리 성공까지 checks 결과에 포함한다. 서버/필수 데이터/주장/정리 실패나 미실행을 통과 처리하지 않는다.

### 반복 작업 위임

불가. 하나의 조회 계약·쿼리와 문서의 의미를 맞추는 작업이며 반복 편집이 아니다. worker가 직접 통합·검증하고 하위 에이전트를 만들지 않는다.

### 주요 로직 코드 또는 변경 예시

추가할 controller/response 핵심 형태다. 기존 POST 코드는 유지한다.

```typescript
// pointResponses.ts
import type { PageResponse } from '../common/pagination/paginationResponses.js';

export type PointTransactionType =
  | 'PURCHASE' | 'AD_REWARD' | 'EPISODE_UNLOCK' | 'ADMIN_ADJUSTMENT' | 'REFUND';
export type PointHistoryItemResponse = {
  uuid: string;
  transactionType: PointTransactionType;
  amount: number;
  balanceAfter: number;
  createdAt: string;
  episode: { dramaTitle: string; episodeNumber: number } | null;
};
export type PointHistoryPageResponse = PageResponse<PointHistoryItemResponse>;

// PointController method; Get/Query, parsePage, constant/response imports도 추가한다.
@Get('points/transactions')
listTransactions(
  @Req() request: AuthenticatedRequest,
  @Query('page') rawPage: unknown,
): Promise<PointHistoryPageResponse> {
  const page = parsePage(rawPage, POINT_HISTORY_PAGE_SIZE);
  return this.pointService.listTransactions(request.user.uuid, page);
}
```

pointService.ts의 새 메서드 핵심 흐름은 다음과 같다. 기존 imports와 스타일에 맞추되 조회/조인/응답 의미를 유지한다.

```typescript
export const POINT_HISTORY_PAGE_SIZE = 30;
type PointHistoryRow = {
  uuid: string;
  transactionType: PointTransactionType;
  amount: number | string;
  balanceAfter: number | string;
  createdAt: Date;
  dramaTitle: string | null;
  episodeNumber: number | string | null;
};

async listTransactions(userUuid: string, page: number): Promise<PointHistoryPageResponse> {
  const { offset, limit } = getPageWindow(page, POINT_HISTORY_PAGE_SIZE);
  const rows = await this.dataSource.createQueryBuilder()
    .from(PointTransaction, 'point')
    .innerJoin(User, 'appUser',
      'appUser.id = point.walletUserId AND appUser.uuid = :userUuid', { userUuid })
    .leftJoin(EpisodeEntitlement, 'entitlement',
      "point.transactionType = 'EPISODE_UNLOCK' AND entitlement.unlockTransactionId = point.id " +
      'AND entitlement.userId = point.walletUserId')
    .leftJoin(Episode, 'episode',
      "episode.id = entitlement.episodeId AND episode.status = 'PUBLISHED' " +
      'AND episode.publishedAt <= UTC_TIMESTAMP(3)')
    .leftJoin(Drama, 'drama',
      "drama.id = episode.dramaId AND drama.status = 'PUBLISHED' " +
      'AND drama.publishedAt <= UTC_TIMESTAMP(3)')
    .select('point.uuid', 'uuid')
    .addSelect('point.transactionType', 'transactionType')
    .addSelect('point.amount', 'amount')
    .addSelect('point.balanceAfter', 'balanceAfter')
    .addSelect('point.createdAt', 'createdAt')
    .addSelect('drama.title', 'dramaTitle')
    .addSelect('episode.episodeNumber', 'episodeNumber')
    .orderBy('point.createdAt', 'DESC')
    .addOrderBy('point.id', 'DESC')
    .offset(offset).limit(limit)
    .getRawMany<PointHistoryRow>();
  const result = createPageResponse(rows, page, POINT_HISTORY_PAGE_SIZE);
  return {
    ...result,
    items: result.items.map(row => ({
      uuid: row.uuid,
      transactionType: row.transactionType,
      amount: Number(row.amount),
      balanceAfter: Number(row.balanceAfter),
      createdAt: new Date(row.createdAt).toISOString(),
      episode: row.dramaTitle !== null && row.episodeNumber !== null
        ? { dramaTitle: row.dramaTitle, episodeNumber: Number(row.episodeNumber) }
        : null,
    })),
  };
}
```
