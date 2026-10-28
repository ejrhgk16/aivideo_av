# task-1-episode-playback-entitlements

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `back/src/content/publicCatalogController.ts`
- `back/src/content/publicCatalogService.ts`
- `back/src/content/content.module.ts`
- `back/src/economy/entities/episodeEntitlement.entity.ts`
- `back/src/identity/entities/user.entity.ts`
- `back/src/common/error/error.baseException.ts`
- `back/src/common/error/error.filter.ts`
- `back/src/common/error/error.enum.ts`
- `back/src/common/error/error.customExceptions.ts`
- `back/test/unit/content/publicCatalogService.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/04-playback/episodes.md`
- `_docs/api/00-overview/conventions.md`

대상 back·_docs 아래에 추가 AGENTS.md는 없다. 실행 시 새로 존재한다면 적용 범위의 지침을 읽는다.

## 작업

### 소유 파일

아래 9개 파일만 변경한다. 다른 작업자도 같은 코드베이스를 사용하므로 다른 사람의 변경을 되돌리지 않고 현재 상태에 맞춘다.

1. `back/src/content/publicCatalogController.ts`
2. `back/src/content/publicCatalogService.ts`
3. `back/src/common/error/error.enum.ts`
4. `back/src/common/error/error.customExceptions.ts`
5. `back/test/unit/content/publicCatalogService.spec.ts`
6. `back/test/api/public.postman_collection.json`
7. `back/test/api/README.md`
8. `_docs/api/04-playback/episodes.md`
9. `_docs/api/00-overview/conventions.md`

### 구현 조건

- 회차 재생 endpoint는 선택 query `userUuid`를 받는다. 생략은 익명 요청이다. 기존 드라마 상세 UUID 검증 형식에 맞춰 전달된 빈 문자열·형식 오류·배열이나 객체 값은 `BadRequestException('userUuid must be a UUID')`(400)로 거절한다.
- `getEpisodePlaybackUrl(episodeId, userUuid, now = new Date())`로 인자를 전달한다. development 이외의 기존404 가드는 서비스 첫 부분에 유지한다.
- `getEpisodeVideo`의 기존 공개 조건·FULL 영상 JOIN·선택 순서를 유지하고, 파라미터화한 사용자 UUID에 의한 `User` JOIN 및 사용자 내부ID·회차 내부ID에 의한 `EpisodeEntitlement` JOIN을 추가한다.
- 공개 영상이 없으면 기존404, 전달된 UUID의 사용자가 없으면 `NotFoundException('User not found')`, 유료이면서 권한이 없으면 익명 요청도 `EpisodeAccessDeniedException`을 던진다. 무료 회차는 사용자 생략 시에도 허용한다. 권한 판정 후에만 서명 서비스를 호출한다. 새 내부 판정 열은 응답에 노출하지 않는다.
- `ErrorCodeEnum.EpisodeAccessDenied = 'EPISODE_ACCESS_DENIED'`와 `EpisodeAccessDeniedException`을 기존 파일에 추가한다. `errorName`은 `EpisodeAccessDenied`, HTTP status는403이다. 권한 오류 이외의 새 커스텀 오류는 추가하지 않는다.
- `@UseFilters(AllExceptionFilter)`는 `getEpisodePlayback` 메서드에만 붙여 다른 endpoint 동작을 바꾸지 않는다.
- DB 스키마·구매 처리·무료 기준·프리뷰·성공 응답·S3 서명 구현을 변경하지 않는다.

### 주요 로직 코드 또는 변경 예시

컨트롤러의 호출 흐름:

```ts
@Get('episodes/:episodeId/playback')
@UseFilters(AllExceptionFilter)
getEpisodePlayback(
  @Param('episodeId') episodeId: string,
  @Query('userUuid') userUuid?: unknown,
) {
  if (
    userUuid !== undefined && (
      typeof userUuid !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid)
    )
  ) {
    throw new BadRequestException('userUuid must be a UUID');
  }
  return this.publicCatalogService.getEpisodePlaybackUrl(episodeId, userUuid);
}
```

`getEpisodeVideo(episodeId: string, userUuid: string | undefined, now: Date)`의 기존 query builder에 아래 JOIN·선택 열을 추가한다. 사용자 생략 시 SQL 바인딩 값으로 `undefined` 대신 `null`을 전달해 사용자·권한 JOIN 결과가 null이 되게 한다. 기존 `select`가 선택 열을 초기화하므로 `addSelect`들은 기존 `select` 이후에 둔다.

```ts
.leftJoin(User, 'playbackUser', 'playbackUser.uuid = :userUuid', { userUuid: userUuid ?? null })
.leftJoin(
  EpisodeEntitlement,
  'entitlement',
  'entitlement.userId = playbackUser.id AND entitlement.episodeId = episode.id',
)
```

```ts
.addSelect('playbackUser.id', 'userId')
.addSelect('episode.pricePoints', 'pricePoints')
.addSelect('entitlement.id', 'entitlementId')
```

기존 raw 결과 타입에 `userId: number | null`, `pricePoints: number | string`, `entitlementId: number | null`을 추가한다. query는 권한 없는 행도 반환해야 404와 403을 구분할 수 있다. query 결과 직후:

```ts
if (!video) throw new NotFoundException(`Episode '${episodeId}' was not found`);
if (userUuid !== undefined && video.userId === null) throw new NotFoundException('User not found');
if (Number(video.pricePoints) !== 0 && video.entitlementId === null) {
  throw new EpisodeAccessDeniedException();
}
return video;
```

서명 호출은 위 검사를 완료한 helper 뒤에서 수행하고 기존 응답을 유지한다:

```ts
async getEpisodePlaybackUrl(episodeId: string, userUuid?: string, now = new Date()) {
  if (process.env.NODE_ENV !== 'development') {
    throw new NotFoundException(`Episode '${episodeId}' was not found`);
  }
  const { storageKey, title, episodeNumber, durationMs } =
    await this.getEpisodeVideo(episodeId, userUuid, now);
  const url = await this.s3VideoUrlService.createSignedGetUrl(storageKey);
  return { url, title, episodeNumber, durationMs };
}
```

기존 반환 타입 명시는 유지한다. 커스텀 오류:

```ts
export class EpisodeAccessDeniedException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.EpisodeAccessDenied, 'EpisodeAccessDenied', HttpStatus.FORBIDDEN);
  }
}
```

### 문서·테스트 변경

- `_docs/api/04-playback/episodes.md`: 선택 query 표, 사용자·권한 JOIN 조건, 익명 포함 무료 허용/유료 권한 필수, 400/404/403 구분 및 커스텀403 응답 형식을 명시한다. 권한 미검사라는 기존 문구를 교체한다. UUID는 인증 수단이 아니라는 제한을 명시한다.
- `_docs/api/00-overview/conventions.md`: 회차 재생 메서드의 커스텀 권한 오류와 선택 사용자 UUID·익명 무료 재생을 추가하고, 회차·프리뷰 모두 구매 권한을 확인하지 않는다는 기존 문구를 회차와 프리뷰의 실제 동작에 맞게 수정한다. 나머지 공통 규칙을 바꾸지 않는다.
- `back/test/api/README.md`: 기존 entitlement fixture를 재생 검증에도 사용함을 설명하고 현재 데이터 조건·커버리지를 갱신한다. 기존 free/paid 재생 성공 설명은 권한 기준으로 수정한다. 데이터 생성·수정 단계는 추가하지 않는다.
- `back/test/unit/content/publicCatalogService.spec.ts`: 기존 production 차단 테스트에서 사용자 생략과 전달 모두 기존404 가드로 차단되는지 확인한다. 사용자·권한 HTTP 동작을 mock 단위 테스트로 중복하지 않는다.
- `back/test/api/public.postman_collection.json`: 기존 회차 재생 요청과 없는 회차404 요청에 유효한 사용자 query를 추가한다. 임의 발견 유료 회차가 200이라는 가정을 제거하고, 기존 `entitledUserUuid`/`unentitledUserUuid`/`entitledEpisodeUuid`/`lockedEpisodeUuid`를 사용한다. preview 요청은 그대로 둔다.

Postman에서 최소 아래를 실제 GET으로 검증한다:

1. 두 기존 사용자 및 사용자 query를 생략한 익명 요청 모두 무료 회차 200. 기존 성공 응답 필드·서명 URL·3600초 만료 검사를 유지한다.
2. `entitledUserUuid` + `entitledEpisodeUuid`는 200.
3. `unentitledUserUuid` + 동일 `entitledEpisodeUuid`는 403. 다른 사용자의 권한이 적용되지 않음을 증명한다.
4. `entitledUserUuid` + `lockedEpisodeUuid`는 403. 같은 사용자의 다른 회차 권한이 적용되지 않음을 증명한다.
5. 사용자 query 생략 + 유료 회차는 커스텀403. 빈 값·형식 오류·중복 사용자 query는 400.
6. 존재하지 않는 UUID 사용자 + 공개 무료 회차는 404, 유효 사용자 + 없는 회차는 기존404.

권한 거절 테스트의 핵심 assertion은 다음과 같다. 각 요청에서 오류 `path`도 실제 요청 경로와 query를 포함해 확인한다.

```js
pm.test('Paid episode requires this user entitlement', () => {
  pm.response.to.have.status(403);
  const body = pm.response.json();
  pm.expect(body.errorCode).to.equal('EPISODE_ACCESS_DENIED');
  pm.expect(body.errorName).to.equal('EpisodeAccessDenied');
  pm.expect(body.statusCode).to.equal(403);
  pm.expect(body.timestamp).to.be.a('string');
  pm.expect(Number.isNaN(Date.parse(body.timestamp))).to.equal(false);
  pm.expect(body).not.to.have.property('url');
});
```

### 검증 명령과 완료 조건

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

- 실행 전 기존 `http://localhost:3000`에 HTTP로 연결하고 변경 코드 반영을 확인한다. 확인할 수 없으면 사용자에게 묻는다. 서버가 없으면 자동 실행·별도 포트 사용 없이 검증 실패 및 `npm --prefix back run start:dev` 실행 안내를 보고한다.
- 기존 실제 MySQL fixture만 사용하며 DB 초기화·시드·구매·포인트·권한 변경을 하지 않는다. fixture가 없으면 검증 실패로 보고한다.
- `test`는 단위 및 실제 HTTP API 테스트를 포함한다. S3 객체 다운로드는 하지 않는다.
- 권한 거절에서 URL이 반환되지 않고, 무료·권한 보유 성공 응답은 기존과 동일해야 한다. 사용자 및 회차가 모두 일치해야만 유료 회차를 허용한다.
- 9개 파일 범위를 지키고 문서와 Postman 계약을 구현과 일치시키며 세 검증 명령이 모두 통과하면 완료다. 인증 도입으로 범위를 넓히지 않는다. 프론트 호출부는 후속 task-2가 소유한다.
