# 포인트 API

## 공통 동작

- 아래 변경 API는 개발 환경에서만 사용할 수 있다. `NODE_ENV`가 없으면 development로 취급한다. 다른 환경에서는 404를 반환한다.
- 인증은 구현되어 있지 않으며 두 API 모두 `userUuid` 경로 값으로 사용자를 식별한다. 신뢰할 수 있는 운영 API로 공개하지 않는다.
- 경로 값의 UUID 형식을 별도로 검사하지 않고 DB에서 조회한다. 조회되는 리소스가 없으면 404를 반환한다. 숫자 ID는 응답에 노출하지 않는다.
- 성공 요청은 envelope 없이 JSON 응답을 반환한다. 업무 오류는 아래 공통 필드의 포인트 커스텀 오류 형식으로 반환한다.

```json
{
  "errorCode": "POINT_INSUFFICIENT_BALANCE",
  "errorName": "InsufficientPoints",
  "statusCode": 409,
  "timestamp": "2026-10-27T07:00:00.000Z",
  "path": "/users/<userUuid>/episodes/<episodeUuid>/purchaseSingle"
}
```

예상하지 못한 내부 오류와 개발 환경 차단은 기본 NestJS 오류 형식을 유지한다. 내부 SQL 및 stack trace는 응답에 포함하지 않는다.

## 포인트 지급

### `POST /users/:userUuid/points/increase`

사용자 지갑에 포인트를 지급하고 `ADMIN_ADJUSTMENT` 원장을 기록한다.

#### Path parameter

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `userUuid` | 예 | 지급할 사용자의 UUID |

#### Request body

```json
{
  "amount": 100,
  "idempotencyKey": "admin-grant-2026-10-27-001",
  "memo": "운영자 지급"
}
```

`amount`는 1부터 2147483647 사이의 정수다. `idempotencyKey`는 공백만으로 구성되지 않은 1~100자 문자열이며 저장할 때 trim하지 않는다. `memo`는 선택 항목이고 문자열 최대 길이는 300자다. 생략하면 원장에는 `null`이 저장된다.

#### 200 Response

```json
{
  "uuid": "5c0d2ef3-fbb4-4b28-a34a-6fe781ac1d61",
  "amount": 100,
  "balanceAfter": 200
}
```

같은 키를 같은 사용자·금액·메모의 `ADMIN_ADJUSTMENT` 요청에 재사용하면 최초 거래 응답을 반환하며 잔액을 다시 늘리지 않는다. 키가 다른 사용자나 다른 요청 값 또는 다른 거래 유형에 사용됐으면 409다. 키는 지갑별이 아닌 전역 고유 값이다. 동시에 다른 지갑이 같은 키를 선점한 경우도 409다. 잔액과 원장은 하나의 트랜잭션으로 저장한다.

#### Errors

| HTTP | errorCode | errorName | 의미 |
| --- | --- | --- | --- |
| 400 | `POINT_INVALID_INCREASE` | `InvalidPointIncrease` | body가 유효하지 않음 |
| 400 | `POINT_BALANCE_OVERFLOW` | `PointBalanceOverflow` | 지급 후 INT 잔액 범위 초과 |
| 404 | `POINT_USER_NOT_FOUND` | `PointUserNotFound` | 사용자가 없음 |
| 404 | `POINT_WALLET_NOT_FOUND` | `PointWalletNotFound` | 사용자 지갑이 없음 |
| 409 | `POINT_IDEMPOTENCY_CONFLICT` | `PointIdempotencyConflict` | 키가 다른 요청에 이미 사용됨 |
| 404 | — | — | 개발 환경 외 접근 (기본 NestJS 오류) |

## 회차 단건 구매

### `POST /users/:userUuid/episodes/:episodeUuid/purchaseSingle`

공개된 회차 하나를 현재 서버 가격으로 구매한다. 요청 body는 없다. 금액과 원장 중복 방지 키를 클라이언트에서 받지 않는다.

#### Path parameters

| 이름 | 필수 | 설명 |
| --- | --- | --- |
| `userUuid` | 예 | 구매할 사용자의 UUID |
| `episodeUuid` | 예 | 구매할 회차의 UUID |

작품과 회차 모두 `PUBLISHED` 상태이고 `publishedAt`이 현재 시각 이하이어야 한다. 서버는 회차의 `pricePoints`를 사용한다. 없는 회차, 비공개 회차·작품, 공개 예정 회차·작품은 모두 `404 Episode not found`다.

#### 200 Response

```json
{
  "episodeUuid": "00000020-0000-4000-8000-000000000001",
  "entitlementUuid": "a1cf9b48-0c82-4b86-b680-d9c19a113db0",
  "chargedPoints": 10,
  "availablePoints": 90
}
```

`chargedPoints`는 이번 요청에서 실제 차감한 포인트이며 `availablePoints`는 처리 당시 잔액이다. 같은 사용자의 기존 회차 권한(관리자 지급 포함)이 있으면 기존 `entitlementUuid`를 반환하고 추가 차감하지 않는다. 무료 회차는 `chargedPoints: 0`으로 성공하며 원장이나 신규 권한을 만들지 않는다. 기존 권한이 없다면 `entitlementUuid`는 `null`이고, 권한이 이미 있으면 그 권한 UUID를 반환한다. 신규 유료 구매는 잔액에서 서버 가격을 차감하고 음수 `EPISODE_UNLOCK` 원장과 해당 원장을 참조하는 `POINT_PURCHASE` 권한을 저장한다. 원장·권한·잔액은 하나의 트랜잭션이다. 사용자 지갑 잠금과 `(user_id, episode_id)` 고유 제약으로 같은 회차의 중복 구매를 막는다.

#### Errors

| HTTP | errorCode | errorName | 의미 |
| --- | --- | --- | --- |
| 404 | `POINT_USER_NOT_FOUND` | `PointUserNotFound` | 사용자가 없음 |
| 404 | `POINT_WALLET_NOT_FOUND` | `PointWalletNotFound` | 지갑이 없음 |
| 404 | `POINT_EPISODE_NOT_FOUND` | `PointEpisodeNotFound` | 회차 없음, 비공개 또는 공개 예정 |
| 409 | `POINT_INSUFFICIENT_BALANCE` | `InsufficientPoints` | 잔액 부족 |
| 404 | — | — | 개발 환경 외 접근 (기본 NestJS 오류) |

현재 회차 재생 URL API는 구매 권한을 확인하지 않는다. 이 구매 API를 추가해도 재생 접근 제어는 바뀌지 않는다.
