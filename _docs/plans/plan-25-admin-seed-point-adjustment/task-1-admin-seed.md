# task-1-admin-seed

## 읽어야 할 파일

- `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`
- `_docs/plans/plan-25-admin-seed-point-adjustment/plan.md`
- `back/src/common/database/seed.ts`, `back/src/common/database/seed/initialData.ts`
- `back/src/identity/entities/user.entity.ts`, `back/src/economy/entities/wallet.entity.ts`, `back/src/economy/entities/pointTransaction.entity.ts`
- `back/test/unit/database/seed.spec.ts`, `back/test/unit/database/initialData.spec.ts`
- `back/README.md`, `back/test/api/README.md`
- 적용되는 하위 AGENTS.md가 추가되어 있으면 읽고 따른다. 계획 작성 시 back 및 _docs 아래에는 없었다.

## 작업

소유 파일은 아래 다섯 개로 제한한다. 다른 worker의 변경을 되돌리지 말고 반영한다.

- `back/src/common/database/seed/initialData.ts`
- `back/src/common/database/seed.ts`
- `back/test/unit/database/initialData.spec.ts`
- `back/test/unit/database/seed.spec.ts`
- `back/README.md`

initialData에 사용자 UUID `00000010-0000-4000-8000-000000000001`, displayName `admin`, accountType `OPERATOR`, status `ACTIVE`, productionCompanyId null을 정의한다. 최초 지급은 100, 거래 UUID `00000011-0000-4000-8000-000000000001`, 키 `seed:admin:initial-points:v1`, 유형 ADMIN_ADJUSTMENT, 메모 `admin initial points`로 고정한다. ID는 기존 UUID→정수 조회 패턴을 따르며 숫자를 하드코딩하지 않는다.

기존 seedData(manager)의 외부 transaction 안에서 사용자를 생성하고, 없는 지갑만 0으로 생성한 뒤 지갑을 잠근다. 최초 지급 키가 없을 때만 원장과 잔액을 함께 저장한다. 기존 원장을 upsert하거나 잔액을 100으로 덮어쓰지 않는다. 기존 seedData의 다른 데이터 처리를 리팩토링하지 않는다. 아래 흐름을 seedData에서 호출한다.

### 주요 로직 코드 또는 변경 예시

```ts
const userRepository = manager.getRepository(User);
await userRepository.createQueryBuilder().insert()
  .values(initialData.adminUser).orIgnore().execute();
const user = await userRepository.findOneByOrFail({ uuid: initialData.adminUser.uuid });
const wallets = manager.getRepository(Wallet);
await wallets.createQueryBuilder().insert()
  .values({ userId: user.id, availablePoints: 0 }).orIgnore().execute();
const wallet = await wallets.findOneOrFail({
  where: { userId: user.id }, lock: { mode: 'pessimistic_write' },
});
const transactions = manager.getRepository(PointTransaction);
const initialGrant = initialData.adminInitialGrant;
const existing = await transactions.findOneBy({ idempotencyKey: initialGrant.idempotencyKey });
if (!existing) {
  const balanceAfter = wallet.availablePoints + initialGrant.amount;
  if (balanceAfter > 2147483647) throw new Error('Seed balance exceeds INT range');
  await transactions.insert({ ...initialGrant, walletUserId: user.id, balanceAfter });
  await wallets.update({ userId: user.id }, { availablePoints: balanceAfter });
}
```

타입 선언·필드명은 위 adminUser/adminInitialGrant와 맞춘다. 단위 테스트의 저장소 대역은 실제로 쓰는 insert/find/lock/update를 지원하도록 최소 변경한다. 최초 실행에 사용자·지갑·단일 100 지급 원장을 검증하고, 재실행 시 중복 없음, 임의 변경된 잔액 보존, 기존 사용자 ID와 FK 유지, 실패 전파를 검증한다. 외부 transaction에서 rollback한다는 호출 구조를 유지한다.

README의 Development seed data 절에 admin UUID, 역할, 최초 잔액, 원장 키, 재실행 보존 동작과 개발 전용 명시적 실행 방법을 적는다. 기존 문서의 모든 행을 primary key로 upsert한다는 설명은 신규 insert-only 항목과 기존 UUID upsert를 구분하도록 해당 절만 고친다.

검증 명령:

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

API checks 전에 현재 코드를 반영한 개발 서버가 실행 중인지 확인한다. 기존 DB나 서버가 없다고 테스트를 통과 처리하지 않는다. API 검증을 위해 시드를 자동 실행하지 않는다.

별도 데이터 준비 단계로 기존 개발 환경 DB를 확인한 뒤 `npm --prefix back run db:seed`를 실행한다. 이 명령은 기존 카탈로그도 upsert하므로 기존 동작을 확인하고 DB 생성/초기화/삭제를 추가하지 않는다. 기존 환경 설정을 사용하고 자격 증명을 출력하지 않는다. seed 모듈을 import해 seedData를 재호출하지 말고 CLI의 명시적 transaction 실행을 사용한다.

완료 조건: 신규 admin이 실제 개발 DB에 있고 지갑 100 및 지급 원장 1개가 확인된다. 재실행 후 잔액·원장 수 보존을 SELECT로 확인한다. 이미 지급 후 사용된 지갑이면 잔액을 강제 초기화하지 말고 현재 잔액과 최초 지급 원장을 보고한다. 전체 checks가 통과하고 실제 DB 적용·읽기 조회 결과를 보고한다. 필요한 DB에 연결할 수 없으면 적용 미완료로 보고한다.
