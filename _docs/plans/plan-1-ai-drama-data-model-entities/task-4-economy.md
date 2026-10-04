# task-4-economy

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/AI_DRAMA_data_model/05-economy/*.md`
- `back/src/shared/entities/audited.entity.ts`
- `back/tsconfig.json`

## 작업

문서의 economy 영역을 1개 테이블당 1개 TypeORM Entity로 만든다. 파일명은 단수 kebab-case이며, `@Entity`의 실제 테이블명은 문서의 snake_case를 유지한다.

- `wallets` → `back/src/economy/entities/wallet.entity.ts`
- `point_transactions` → `back/src/economy/entities/point-transaction.entity.ts`
- `episode_entitlements` → `back/src/economy/entities/episode-entitlement.entity.ts`
- `point_products` → `back/src/economy/entities/point-product.entity.ts`
- `point_purchase_orders` → `back/src/economy/entities/point-purchase-order.entity.ts`
- `ad_reward_offers` → `back/src/economy/entities/ad-reward-offer.entity.ts`
- `ad_reward_claims` → `back/src/economy/entities/ad-reward-claim.entity.ts`
- `back/src/economy/entities/index.ts`

각 문서의 컬럼, nullable, 기본값, UNIQUE, CHECK, 인덱스를 반영한다. 특히 지갑의 비음수 잔액, 원장의 양·음수 규칙과 idempotency key, entitlement의 `(user_id, episode_id)` UNIQUE, 주문·광고 외부 ID UNIQUE를 metadata로 정의한다. 포인트/원화는 정수 타입을 사용하고, 원장과 지갑을 자동으로 갱신하는 서비스 로직이나 transaction manager는 이 task에 추가하지 않는다.

경제 도메인에서도 FK와 TypeORM object relation은 만들지 않는다. 사용자의 지갑 잠금, 중복 지급 방지, 광고 일일 제한, 최초 PAID 전환 같은 규칙은 이후 service transaction 구현의 책임이다.

### 검증 및 완료 조건

- `npm --prefix back run lint`
- 위 7개 테이블이 각각 정확히 하나의 Entity 파일과 연결되고, economy `index.ts`가 해당 Entity만 export한다.
