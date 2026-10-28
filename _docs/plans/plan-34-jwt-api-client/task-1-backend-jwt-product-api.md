# task-1-backend-jwt-product-api

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-34-jwt-api-client/plan.md
- .agents/skills/nestjs-best-practices/SKILL.md
- .agents/skills/api-and-interface-design/SKILL.md
- back/src/identity/jwtAuthGuard.ts, jwtStrategy.ts, identity.module.ts
- back/src/content/publicCatalogController.ts, publicCatalogService.ts
- back/src/economy/pointController.ts, pointService.ts
- back/src/common/error/error.enum.ts, error.customExceptions.ts, error.filter.ts
- back/src/common/http/webCors.ts
- back/test/api/README.md 및 해당 API 문서·기존 테스트

## 작업

사용자 UUID를 외부에서 선택하던 제품 API를 기존 Access JWT 인증으로 전환한다. task-2와 병렬 실행 가능하다. 다른 worker가 같은 저장소에서 작업하므로 자신의 범위만 수정하고 다른 변경을 되돌리지 않는다.

### 정확한 수정 파일

```text
back/src/identity/optionalJwtAuthGuard.ts
back/src/identity/identity.module.ts
back/src/content/content.module.ts
back/src/content/publicCatalogController.ts
back/src/content/publicCatalogService.ts
back/src/economy/economy.module.ts
back/src/economy/pointController.ts
back/test/unit/identity/jwtStrategy.spec.ts
back/test/unit/content/publicCatalogService.spec.ts
back/test/unit/economy/pointController.spec.ts
back/test/api/public.postman_collection.json
back/test/api/README.md
_docs/api/00-overview/authentication.md
_docs/api/00-overview/conventions.md
_docs/api/02-content/dramas.md
_docs/api/04-playback/episodes.md
_docs/api/05-economy/points.md
```

### 구현 지시

1. OptionalJwtAuthGuard를 기존 JwtAuthGuard의 최소 확장으로 구현한다. Authorization 헤더 자체가 없을 때만 통과하고, 빈 값·잘못된 스킴·만료·변조·Refresh 사용은 기존 Guard로 검증해 AUTH_INVALID_TOKEN 401을 반환한다. DB 장애를 인증 실패로 바꾸지 않는다. IdentityModule에서 export하고 사용하는 모듈에서 import한다.
2. 작품 상세·회차 재생 controller는 Query('userUuid')를 제거하고 검증된 request.user?.uuid만 서비스로 전달한다. 해당 method에 커스텀 인증 오류 filter를 적용한다. 잔존 userUuid 쿼리는 일반 미사용 쿼리처럼 무시하며 어떤 사용자 선택에도 사용하지 않는다. 형식 검증을 유지해 인증 입력처럼 보이게 하지 않는다.
3. 작품 상세는 익명에게 무료 회차만 unlocked, watchProgress는 null이다. 인증 사용자에게는 본인 entitlement/watchProgress만 제공한다. 공개 목록·genres·collection·preview는 기존 익명 접근을 유지한다.
4. 회차 조회의 공개 조건·단일 조인·서명 URL 정책을 유지한다. 공개 대상 조회 뒤 유료 익명은 InvalidTokenException, 유료 인증 미구매는 기존 EpisodeAccessDeniedException, 무료와 구매자는 기존 성공 응답으로 처리한다. 헤더 검증은 조회 전에 수행한다. 기존 개발 환경 재생 제한은 확장하지 않는다.
5. PointController base를 me로 바꾸고 필수 JwtAuthGuard를 적용한다. request.user.uuid를 서비스에 전달하며 userUuid path/body/query로 대체할 수 없게 한다. 실제 경로는 POST /me/points/increase와 POST /me/episodes/:episodeUuid/purchaseSingle이다. 기존 업무 로직·입력·성공 상태·개발 환경 제한을 보존한다. Guard가 인증을 먼저 검사하므로 비개발 환경의 404 보장은 인증을 통과한 요청에 적용됨을 문서에 정확히 적는다.
6. API 문서의 경로·요청·성공/오류·인증·노출 규칙과 오래된 UUID 전환 예정 설명을 갱신한다. 인증 문서에는 백엔드 전환 완료와 아직 task-2/3에서 구현 중인 프론트 부분을 구별한다. task-3이 최종 구현 상태를 정리한다.

### 주요 로직 코드 또는 변경 예시

아래는 기존 class에 맞춰 적용할 핵심 흐름이다. request.user는 검증된 UUID만 가진다.

```ts
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.headers.authorization === undefined) return true;
    return super.canActivate(context);
  }
}

@Get('dramas/:dramaId')
@UseGuards(OptionalJwtAuthGuard)
@UseFilters(AllExceptionFilter)
getDrama(
  @Param('dramaId') dramaId: string,
  @Req() request: Request & { user?: { uuid: string } },
) {
  return this.publicCatalogService.getDrama(dramaId, undefined, request.user?.uuid);
}

// getEpisodeVideo: 공개 리소스 조회 성공 뒤 기존 권한 분기를 변경한다.
if (Number(video.pricePoints) !== 0) {
  if (userUuid === undefined) throw new InvalidTokenException();
  if (video.entitlementId === null) throw new EpisodeAccessDeniedException();
}

// @Controller('me'), @UseGuards(JwtAuthGuard), 기존 filter 아래에 둔다.
@Post('episodes/:episodeUuid/purchaseSingle')
@HttpCode(200)
purchaseSingle(
  @Req() request: Request & { user: { uuid: string } },
  @Param('episodeUuid') episodeUuid: string,
) {
  this.assertDevelopment();
  return this.pointService.purchaseSingle(request.user.uuid, episodeUuid);
}
```

### 테스트와 데이터

- Postman에서 정상 로그인으로 Access를 얻는다. 다른 계정의 UUID를 보내는 기존 테스트는 각각 그 계정의 Access를 쓰도록 바꾼다. 환경 변수 이름은 entitledLoginId, entitledPassword, unentitledLoginId, unentitledPassword로 정하고 비밀을 컬렉션에 하드코딩하지 않는다. 새 로그인으로 얻은 사용자 UUID가 지정된 기존 fixture 사용자와 일치하는지도 확인한다. 테스트용 세션은 검증 후 logout한다. 테스트를 위해 보호되지 않은 우회 endpoint나 JWT 서명키를 제공하지 않는다.
- 기존 로그인 가능한 구매/미구매 계정과 기존 entitlement/watch-progress fixture가 없으면 명확히 실패로 보고한다. 읽기 검증을 위해 DB reset·seed·자격 정보 수정·entitlement 생성은 하지 않는다. README에 새 계정 환경 변수와 실행 전제를 적는다.
- 상세와 무료/유료 재생의 익명·구매·미구매, 잘못된/빈 Bearer·Refresh를 Access로 사용, 존재하지 않는 공개 리소스, 잔존 userUuid 조작에 따른 정보 유출 부재를 실제 HTTP로 확인한다. 유료 익명의 403 기대를 401로 바꾼다.
- /me 필수 인증, 이전 /users/:userUuid 경로 제거, 요청 body/query로 타인을 지정할 수 없음, 실제 POST 업무 오류와 성공을 검증한다. Authorization·Content-Type을 포함한 CORS preflight도 확인한다. preflight만으로 POST 검증을 대체하지 않는다.
- 읽기 검증 뒤 별도 마지막 요청에서 기존 개발 계정에 최소 포인트 지급/구매와 반복 구매 시 중복 차감 방지를 검증한다. 반복 실행 시 이미 구매한 상태도 허용하되 chargedPoints/availablePoints 정합성을 검증한다. 기존 미구매·잔액 부족 fixture의 상태를 바꾸지 않는다. 지급 idempotencyKey는 한 의도 안에서 동일하게 유지하고 독립 실행에는 새 키를 사용한다.
- HTTP로 안정적으로 만들기 어려운 만료된 정상 서명 Access는 기존 jwtStrategy 단위 테스트를 활용한다. 선택 인증의 헤더 유무와 DB 오류 보존, 개발 환경 경계 등 내부 규칙을 기존 단위 테스트에 최소 추가/수정한다. 기존 controller 직접 호출 signature도 변경한다. HTTP 행동을 단위 테스트로만 검증하지 않는다.

### 검증 명령

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

API 테스트 전에 localhost:3000에 HTTP 연결하고 현재 코드가 반영됐는지 확인한다. 서버가 없으면 검증 실패와 npm --prefix back run start:dev 안내를 출력한다. 자동 시작·다른 포트 우회·데이터 부족을 통과 처리하는 행동은 금지한다.

### 완료 조건

외부 UUID로 사용자를 바꿀 수 없고, 인증 정책·상태/문자열 errorCode·기존 개발 환경 제한이 코드·API 문서·실제 HTTP 테스트에 일치한다. 모든 checks가 통과하며 데이터/서버 문제는 실패로 기록한다.
