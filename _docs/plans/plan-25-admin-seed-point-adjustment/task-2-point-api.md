# task-2-point-api

## 읽어야 할 파일

- `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`
- `_docs/plans/plan-25-admin-seed-point-adjustment/plan.md`, 같은 폴더의 `task-1-admin-seed.md`
- `back/src/app.module.ts`, `back/src/content/content.module.ts`, `back/src/content/publicCatalogService.ts`
- `back/src/identity/entities/user.entity.ts`, `back/src/economy/entities/wallet.entity.ts`, `back/src/economy/entities/pointTransaction.entity.ts`, `back/src/economy/entities/episodeEntitlement.entity.ts`
- `back/src/content/entities/episode.entity.ts`, `back/src/content/entities/drama.entity.ts`
- `_docs/AI_DRAMA_data_model/05-economy/episode_entitlements.md`, `_docs/api/04-playback/episodes.md`
- `back/src/common/http/webCors.ts`, `back/test/api/README.md`, `back/test/api/public.postman_collection.json`
- `_docs/api/00-overview/conventions.md`, `_docs/api/05-economy/README.md`
- 적용되는 하위 AGENTS.md와 NestJS 및 API 설계 스킬을 읽는다.

## 작업

task-1 완료 후 실행한다. 다른 worker의 변경을 되돌리지 말고 반영한다. 소유 파일:

- `back/src/app.module.ts`
- `back/src/economy/economy.module.ts`
- `back/src/economy/pointController.ts`
- `back/src/economy/pointService.ts`
- `back/src/economy/entities/episodeEntitlement.entity.ts`
- `back/test/unit/economy/pointService.spec.ts`
- `back/test/unit/economy/pointController.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/05-economy/README.md`
- `_docs/api/05-economy/points.md`

포인트 지급과 회차 단건 구매를 구현한다. 범용 차감·다중 구매·조회 API나 새 의존성·스키마·인증·프론트를 추가하지 않는다. EconomyModule을 AppModule에 등록하고 기존 DI·파일명 관례를 따른다. EpisodeEntitlement.unlockTransactionId는 실제 INT FK에 맞게 string | null에서 number | null로 수정하고 컬럼 metadata는 유지한다.

controller 공통 경로는 users/:userUuid이고 POST 두 개에 @HttpCode(200)를 적용한다. ConfigService의 NODE_ENV 미설정은 development로 해석하며 그 외 환경은 입력 검증/DB 호출보다 먼저 404로 차단한다. 사용자·회차 UUID 형식 오류는 400, DB에 없는 유효 회차 UUID는 404 Episode not found다.

지급 body는 객체이며 amount는 1~2147483647 정수, idempotencyKey는 공백만 아닌 1~100자 문자열, memo는 생략 또는 300자 이하 문자열이다. 키를 임의로 trim하지 않고 memo 생략은 null로 정규화한다. 구매 body는 필요 없으며 금액이나 키를 클라이언트에서 받지 않는다. 단건 구매의 controller/service 메서드와 경로는 하이픈 없는 purchaseSingle로 통일한다.

### 주요 로직 코드 또는 변경 예시

```ts
@Post('points/increase')
@HttpCode(200)
increase(@Param('userUuid') userUuid: string, @Body() body: unknown) {
  this.assertDevelopment();
  this.assertUuid(userUuid);
  return this.pointService.increase(userUuid, this.parseIncreaseInput(body));
}

@Post('episodes/:episodeUuid/purchaseSingle')
@HttpCode(200)
purchaseSingle(@Param('userUuid') userUuid: string,
               @Param('episodeUuid') episodeUuid: string) {
  this.assertDevelopment();
  this.assertUuid(userUuid);
  this.assertUuid(episodeUuid);
  return this.pointService.purchaseSingle(userUuid, episodeUuid);
}
```

assertDevelopment/assertUuid/parseIncreaseInput은 위 조건에 맞게 실제 구현한다. 서비스는 DataSource.transaction('READ COMMITTED', ...)을 사용한다. 지급은 사용자 조회 및 지갑 pessimistic_write 잠금 후 아래 흐름을 수행한다.

```ts
const previous = await transactions.findOneBy({ idempotencyKey: input.idempotencyKey });
if (previous) {
  if (previous.walletUserId !== user.id || previous.amount !== input.amount ||
      previous.memo !== input.memo || previous.transactionType !== 'ADMIN_ADJUSTMENT') {
    throw new ConflictException('Idempotency key already used');
  }
  return { uuid: previous.uuid, amount: previous.amount, balanceAfter: previous.balanceAfter };
}
const balanceAfter = wallet.availablePoints + input.amount;
if (balanceAfter > 2147483647) throw new BadRequestException('Balance exceeds INT range');
const row = {
  uuid: randomUUID(), walletUserId: user.id, transactionType: 'ADMIN_ADJUSTMENT',
  amount: input.amount, balanceAfter, idempotencyKey: input.idempotencyKey, memo: input.memo,
};
await transactions.insert(row);
await wallets.update({ userId: user.id }, { availablePoints: balanceAfter });
return { uuid: row.uuid, amount: row.amount, balanceAfter };
```

지급에서 사용자/지갑이 없으면 404다. 다른 지갑이 동시에 같은 전역 키를 사용하면 transaction 밖에서 idempotency_key UNIQUE 충돌만 409로 변환한다. 다른 DB 오류는 숨기지 않는다.

구매는 지갑 잠금으로 동일 사용자의 변경을 직렬화한다. READ COMMITTED로 잠금 대기 중 커밋된 구매 권한을 이후 조회에서 읽는다. 회차·작품 공개 조건과 가격을 확인하고 구매 목록 전체가 아닌 (userId, episodeId)의 권한 한 건을 조회한다.

```ts
return this.dataSource.transaction('READ COMMITTED', async (manager) => {
  const user = await manager.getRepository(User).findOneBy({ uuid: userUuid });
  if (!user) throw new NotFoundException('User not found');
  const wallets = manager.getRepository(Wallet);
  const wallet = await wallets.findOne({
    where: { userId: user.id }, lock: { mode: 'pessimistic_write' },
  });
  if (!wallet) throw new NotFoundException('Wallet not found');
  const episode = await manager.getRepository(Episode).createQueryBuilder('episode')
    .innerJoin(Drama, 'drama', 'drama.id = episode.dramaId')
    .where('episode.uuid = :episodeUuid', { episodeUuid })
    .andWhere('episode.status = :status AND drama.status = :status', { status: 'PUBLISHED' })
    .andWhere('episode.publishedAt <= :now AND drama.publishedAt <= :now', { now: new Date() })
    .setLock('pessimistic_read').getOne();
  if (!episode) throw new NotFoundException('Episode not found');
  const entitlements = manager.getRepository(EpisodeEntitlement);
  const existing = await entitlements.findOneBy({ userId: user.id, episodeId: episode.id });
  if (existing || episode.pricePoints === 0) {
    return { episodeUuid, entitlementUuid: existing?.uuid ?? null,
      chargedPoints: 0, availablePoints: wallet.availablePoints };
  }
  const price = episode.pricePoints;
  if (wallet.availablePoints < price) throw new ConflictException('Insufficient points');
  const availablePoints = wallet.availablePoints - price;
  const transactions = manager.getRepository(PointTransaction);
  const transaction = await transactions.save(transactions.create({
    uuid: randomUUID(), walletUserId: user.id, transactionType: 'EPISODE_UNLOCK',
    amount: -price, balanceAfter: availablePoints,
    idempotencyKey: 'episode-purchase:' + randomUUID(), memo: null,
  }));
  const entitlementUuid = randomUUID();
  await entitlements.insert({ uuid: entitlementUuid, userId: user.id, episodeId: episode.id,
    acquisitionType: 'POINT_PURCHASE', unlockTransactionId: transaction.id });
  await wallets.update({ userId: user.id }, { availablePoints });
  return { episodeUuid, entitlementUuid, chargedPoints: price, availablePoints };
});
```

회차 조회의 공유 잠금으로 거래 중 가격 변경을 방지하며 지갑 다음에 회차를 잠그는 순서를 유지한다. 기존 권한은 ADMIN_GRANT 등을 포함해 추가 차감 없이 반환한다. 무료 회차는 신규 권한/원장을 만들지 않는다. 원장의 키는 구매에 한해 서버가 생성하고 중복 구매는 지갑 잠금 및 UNIQUE(user_id, episode_id)로 막는다. 원장/권한/잔액 중 어느 저장 단계에서 실패해도 모두 rollback한다. 사용자/지갑을 API에서 자동 생성하거나 기존 원장을 수정/삭제하지 않는다. 재생 API에 구매 권한 검사를 추가하지 않는다.

단위 테스트 완료 조건:

- 지급 성공, 동일 키 재시도 시 최초 거래 응답 보존, 사용자·금액·메모·유형 충돌, 전역 키 경쟁, 입력 경계와 INT overflow.
- 서버 회차 가격만큼 차감, 음수 EPISODE_UNLOCK 원장과 POINT_PURCHASE 권한의 FK 연결 및 최종 잔액.
- 없는 회차 404 및 쓰기 없음, UUID 형식 오류 400, 작품·회차 비공개/미래 공개/publishedAt null의 404.
- 무료 회차는 0 차감과 신규 원장·권한 없음. 기존 구매는 동일 권한 반환 및 추가 차감 없음. 가격 변경 후 재구매도 추가 차감 없음.
- 잔액 부족 시 쓰기 없음, 정확한 잔액 구매 시 0 잔액 허용, 같은 회차 동시 요청은 한 번 차감, 다른 회차 동시 요청은 갱신 잔액 기준으로 판단.
- 저장 실패 rollback 계약과 lock/isolation 설정. 대역으로 제어한 동시성을 실제 MySQL 잠금 검증이라고 보고하지 않음.
- controller 환경 차단, UUID·지급 body 검증, 서비스 전달 값 및 경로/POST/200 metadata. 범용 decrease endpoint 없음.

Postman에는 지급 경로와 purchaseSingle 경로의 OPTIONS CORS preflight 검증을 추가한다. 구매 body가 없으므로 Content-Type을 필수로 가정하지 않는다. UUID가 실제 존재한다고 가정하지 않으며 기존 GET·OPTIONS 및 데이터 조건은 유지한다. POST·seed·cleanup을 추가하지 않는다. README에 preflight는 실제 구매 라우팅·변경을 입증하지 않음을 명시한다.

economy README에 링크를 추가하고 points.md에 두 API의 명칭·경로·body 유무·200 응답·400/404/409·개발 한정/인증 없음·원장 유형·중복 처리·무료 회차 정책을 기록한다. 구매 chargedPoints는 이번 요청 차감량, availablePoints는 처리 시점 잔액이다. 재생 API는 현재 구매 권한을 확인하지 않는다는 제한을 명시한다. 공통 규칙 및 재생 API는 수정하지 않는다.

검증 명령:

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

API 검증 전 개발 서버가 최신 코드로 재컴파일되었는지 확인하고 없으면 개발 환경으로 시작한다. MySQL 연결 실패나 데이터 부족은 실패다. 테스트를 위해 DB를 생성·초기화·시드하거나 기존 데이터를 변경하지 않는다.

완료 조건: 두 API와 문서 계약 일치, 전체 checks 통과 및 위 단위 테스트 경계 검증. 실제 DB 쓰기 HTTP 통합 검증을 수행했다고 보고하지 않는다. task-1 시드와 순차 실행 관계는 유지한다.
