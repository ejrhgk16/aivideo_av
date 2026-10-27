# task-1-episode-entitlements

## 읽어야 할 파일
- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-29-drama-episode-entitlements/plan.md
- .agents/skills/nestjs-best-practices/SKILL.md
- .agents/skills/api-and-interface-design/SKILL.md
- back/src/content/publicCatalogController.ts
- back/src/content/publicCatalogService.ts
- back/src/content/content.module.ts
- back/test/unit/content/publicCatalogService.spec.ts
- back/test/api/public.postman_collection.json
- back/test/api/README.md
- _docs/api/02-content/dramas.md
- _docs/api/00-overview/conventions.md
- back/src/economy/entities/episodeEntitlement.entity.ts
- back/src/identity/entities/user.entity.ts
- back/src/economy/pointService.ts

현재 backend/docs 범위에 하위 AGENTS.md는 발견되지 않았다. 실행 시 추가된 지침이 있다면 따른다.

## 작업
드라마 상세 회차에 사용자 권한을 LEFT JOIN하고 공개 조건 및 정렬을 DB에서 처리한다. 다른 작업자도 저장소를 사용하므로 타인의 변경을 되돌리지 말고 현 상태에 맞춘다.

### 정확한 수정 범위
- `back/src/content/publicCatalogController.ts`
- `back/src/content/publicCatalogService.ts`
- `back/src/content/content.module.ts`
- `back/test/unit/content/publicCatalogService.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/00-overview/conventions.md`

### 구현 지시
1. 상세 controller에 선택 @Query('userUuid')를 받는다. 생략만 비로그인이다. 빈 값·잘못된 UUID·배열·객체는 BadRequestException('userUuid must be a UUID')로 400을 반환한다. 기존 상세 now 인자 호환성을 유지해 userUuid는 서비스 세 번째 인자로 전달한다.
2. ContentModule의 forFeature에 User를 등록하고 서비스에 User repository를 주입한다. EpisodeEntitlement는 기존 registry에 등록된 Entity를 JOIN 대상으로 사용한다. 새 Entity 관계·스키마나 module 순환 의존을 만들지 않는다. 생성자 변경에 맞춰 기존 단위 테스트 인자를 조정한다.
3. 기존 작품 공개 검증 이후 제공된 userUuid로 사용자를 조회한다. 없으면 NotFoundException('User not found')다. 작품 미존재·비공개 오류는 기존 동작을 유지한다.
4. 아래 episodeQuery.getRawMany 호출을 기존 Promise.all의 episodeRepository.findBy 위치에 넣는다. 반환 episodes는 이미 공개 필터·정렬을 만족하므로 상세의 JS filter/sort를 제거한다.
5. 기존 회차 이미지 IN 조회와 Map을 유지한다. 내부 숫자 id는 이미지 매핑에만 사용하며 공개 응답에는 포함하지 않는다. DramaDetail의 회차 타입에 isUnlocked: boolean을 추가한다.
6. 작품 목록, 장르 조회, 재생 API는 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시
Controller의 기존 @Get('dramas/:dramaId') 메서드를 다음처럼 확장한다.

```typescript
getDrama(
  @Param('dramaId') dramaId: string,
  @Query('userUuid') userUuid?: unknown,
) {
  if (userUuid !== undefined && (
    typeof userUuid !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)
  )) {
    throw new BadRequestException('userUuid must be a UUID');
  }
  return this.publicCatalogService.getDrama(dramaId, undefined, userUuid);
}
```

서비스 signature는 getDrama(dramaId: string, now = new Date(), userUuid?: string)이다. 기존 작품 공개 검증 다음에 사용자를 결정한다.

```typescript
const user = userUuid === undefined
  ? null
  : await this.userRepository.findOneBy({ uuid: userUuid });
if (userUuid !== undefined && user === null) {
  throw new NotFoundException('User not found');
}
const userId = user?.id ?? null;
```

회차 쿼리: userId가 null이면 어떤 권한과도 일치하지 않는다. 취득 종류는 제한하지 않는다. NULL publishedAt은 <= 비교에서 제외된다.

```typescript
type DetailEpisodeRow = Pick<Episode,
  'id' | 'uuid' | 'episodeNumber' | 'title' | 'synopsis' | 'durationMs' | 'pricePoints'
> & { unlocked: number | string };

const episodeQuery = this.episodeRepository.createQueryBuilder('episode')
  .leftJoin(EpisodeEntitlement, 'entitlement',
    'entitlement.episodeId = episode.id AND entitlement.userId = :userId',
    { userId })
  .select('episode.id', 'id')
  .addSelect('episode.uuid', 'uuid')
  .addSelect('episode.episodeNumber', 'episodeNumber')
  .addSelect('episode.title', 'title')
  .addSelect('episode.synopsis', 'synopsis')
  .addSelect('episode.durationMs', 'durationMs')
  .addSelect('episode.pricePoints', 'pricePoints')
  .addSelect(
    'CASE WHEN episode.pricePoints = 0 OR entitlement.id IS NOT NULL THEN 1 ELSE 0 END',
    'unlocked',
  )
  .where('episode.dramaId = :dramaId', { dramaId: drama.id })
  .andWhere('episode.status = :status', { status: PUBLIC_STATUS })
  .andWhere('episode.publishedAt <= :now', { now })
  .orderBy('episode.episodeNumber', 'ASC');
```

기존 Promise.all의 마지막 항목은 episodeQuery.getRawMany<DetailEpisodeRow>()로 교체한다. episodes를 그대로 기존 회차 커버 이미지 조회에 사용하고 최종 상세 객체의 episodes 필드는 다음처럼 구성한다.

```typescript
episodes: episodes.map(({ id, uuid, episodeNumber, title, synopsis,
  durationMs, pricePoints, unlocked }) => ({
  uuid,
  episodeNumber,
  title,
  synopsis,
  durationMs,
  pricePoints,
  image: episodeImagesById.get(id) ?? null,
  isUnlocked: Number(unlocked) === 1,
})),
```

User 및 EpisodeEntitlement import, User repository 주입은 기존 스타일을 따른다. 회차마다 권한 조회하거나 전체 권한을 별도 조회해 병합하지 않는다.

### 문서와 검증 구현
- dramas.md: 선택 userUuid와 입력 오류, 사용자 미존재 404, isUnlocked의 타입·예시·생략/무료/보유/미보유 의미를 추가한다. 기존 '사용자별 구매·해제 여부를 조회하지 않는다' 및 후속 API로 미루는 두 규칙은 새 계약으로 교체한다. 공개 조건과 정렬을 DB에서 수행하고 회차에 해당 사용자 권한을 LEFT JOIN한다고 명시한다.
- conventions.md: 상세의 선택 userUuid와 권한 표시, 현재 인증 부재를 추가한다. 재생 접근 제어 규칙은 유지한다.
- Postman: 기존 상세 검증에 isUnlocked boolean, 무료 true·비로그인 유료 false, 번호 오름차순, 회차 UUID 중복 없음 및 기존 필드·개수 유지 검증을 추가한다.
- 기존 DB fixture의 entitledUserUuid, entitlementDramaUuid, entitledEpisodeUuid, unentitledUserUuid, lockedEpisodeUuid는 컬렉션 변수에 README의 개발 기본값을 제공한다. finish 실패 후 사용자가 기본 테스트 수정 요청을 승인한 사항이다. 외부 Postman 환경 변수로 덮어쓸 수 있다. 같은 공개 작품에 무료 회차, 보유 사용자의 유료 보유 회차 및 유료 미보유 회차가 있고 두 번째 사용자는 보유 대상 회차에 권한이 없어야 한다. README에 변수 의미와 --env-var 전달 예시를 적는다. 비밀 값은 컬렉션에 넣지 않는다.
- 같은 작품을 보유 사용자·미보유 사용자·사용자 생략으로 GET 조회한다. 아래 검증 예시를 실제 요청별 assertion에 반영한다. 변수 및 fixture 부족은 실패로 처리하며 skip하지 않는다. collection의 초기화 script는 fixture 입력을 지우지 않아야 한다. 새 상세 요청은 기존 genres/catalog 변수가 준비된 이후에 배치한다.

```javascript
const detail = pm.response.json();
const owned = detail.episodes.find(e => e.uuid === pm.variables.get("entitledEpisodeUuid"));
const locked = detail.episodes.find(e => e.uuid === pm.variables.get("lockedEpisodeUuid"));
pm.test("Existing paid entitlement unlocks only the owned episode", () => {
  pm.expect(owned).to.be.an("object");
  pm.expect(owned.pricePoints).to.be.above(0);
  pm.expect(owned.isUnlocked).to.equal(true);
  pm.expect(locked).to.be.an("object");
  pm.expect(locked.pricePoints).to.be.above(0);
  pm.expect(locked.isUnlocked).to.equal(false);
  const free = detail.episodes.filter(e => e.pricePoints === 0);
  pm.expect(free.length).to.be.above(0);
  free.forEach(e => pm.expect(e.isUnlocked).to.equal(true));
});
```

- 미보유 사용자 및 사용자 생략 응답에서는 entitledEpisodeUuid의 isUnlocked가 false인지 각각 검증해 사용자 간 권한 누출을 막는다.
- malformed/empty/repeated userUuid 400, 정상 형식의 없는 UUID 404 및 기존 작품 404를 실제 HTTP로 검증한다. 기존 NestJS 기본 오류 형식을 유지한다.
- publicCatalogService.spec.ts의 생성자 인자를 맞춘다. 추가 단위 테스트는 공개 시각 경계의 DB 조건 전달에 한정한다. 과거·현재 포함, 미래·NULL·비공개 제외 조건을 확인하되 mock 결과만으로 SQL 실행 성공을 주장하지 않는다. 권한·정렬 동작은 실제 Postman 검증으로 확인한다.
- 테스트에서 DB 초기화·시드·구매·권한 지급을 하지 않는다. 기존 fixture 데이터 부족은 명확한 실패로 보고한다.

### 검증 명령
1. `npm --prefix back run lint`
2. `npm --prefix back run test`
3. `npm --prefix back run build`

HTTP 검증 전에 localhost:3000에 요청하고 현재 코드 반영을 확인한다. 불확실하면 사용자에게 확인한다. 서버 미실행 시 실패 처리 및 npm --prefix back run start:dev 안내를 출력한다. 자동 실행·추가 서버·다른 포트 우회는 하지 않는다.

### 완료 조건
- 사용자·회차 조건이 JOIN ON에 있으며 미구매 회차도 유지된다. 권한 취득 종류와 무관하게 판정한다.
- 공개 조건 및 episodeNumber ASC가 DB에서 처리되고 상세의 JS filter/sort는 제거된다.
- 무료·보유·미보유·사용자 간 분리·입력 오류가 문서와 실제 응답에 일치한다.
- 기존 응답 필드·공개 회차 개수 및 작품 공개 경계가 유지된다.
- 위 8개 파일만 변경하고 lint/test/build가 모두 통과한다. 실패·미실행은 통과로 보고하지 않는다.
