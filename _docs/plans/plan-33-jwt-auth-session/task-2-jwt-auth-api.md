# task-2-jwt-auth-api

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `back/test/api/README.md`
- `back/src/identity/entities/authSession.entity.ts`
- `back/src/identity/entities/refreshToken.entity.ts`
- [RFC 9700 §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2)
- `back/src/identity/loginService.ts`
- `back/src/common/error/error.filter.ts`
- `back/src/app.module.ts`

## 작업

task-1의 AuthSession/RefreshToken을 사용해 JWT 발급·갱신·폐기를 구현하고 Access Token용 Passport Strategy/Guard를 준비한다. 기존 userUuid API에는 적용하지 않는다.

### 정확한 수정 파일 범위
- `back/package.json`
- `back/package-lock.json`
- `back/README.md`
- `back/.env.development` (Git-ignored 로컬 설정, 커밋 제외)
- `back/src/identity/identity.module.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/loginService.ts`
- `back/src/identity/tokenService.ts`
- `back/src/identity/jwtStrategy.ts`
- `back/src/identity/jwtAuthGuard.ts`
- `back/src/common/error/error.enum.ts`
- `back/src/common/error/error.customExceptions.ts`
- `back/test/unit/loginController.spec.ts`
- `back/test/unit/identity/tokenService.spec.ts`
- `back/test/unit/identity/jwtStrategy.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/01-identity/README.md`
- `_docs/api/01-identity/login.md`
- `_docs/api/01-identity/refresh.md`
- `_docs/api/01-identity/logout.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/ARCHITECTURE.md`

### 검증 명령
```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

### 구현 지시
- 이 Task는 [RFC 9700 §4.14.2](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14.2)의 Refresh Token rotation + 재사용 탐지를 적용한다. 전체 OAuth 서버나 OAuth 표준 토큰 endpoint를 구현하는 작업은 아니다. HTTP 오류는 기존 프로젝트의 커스텀 형식을 유지한다.
- NestJS 12 호환 @nestjs/jwt, @nestjs/passport, passport, passport-jwt와 필요한 타입 의존성 및 lockfile을 추가한다. identity.module.ts에 JwtModule, PassportModule, 두 Entity repository, TokenService, JwtStrategy, JwtAuthGuard를 등록하고 Guard를 export한다. LocalStrategy는 추가하지 않는다.
- JWT_ACCESS_SECRET/JWT_REFRESH_SECRET은 ConfigService로 읽고 누락·공백·동일 키는 시작 시 실패시킨다. 사용자의 추가 지시에 따라 서로 다른 암호학적 난수 기반 개발용 키를 생성해 Git-ignored back/.env.development에 설정한다. 기존 환경 값은 유지하고 비밀 값은 출력·커밋하지 않는다. back/README.md에 추후 키 교체 절차를 적는다. 파일 수정은 apply_patch로 수행한다.
- HS256만 허용한다. Access: sub=user UUID, tokenType='access', 900초. Refresh: sub=user UUID, tokenType='refresh', jti=randomUUID(), 1209600초. 라이브러리 iat/exp를 사용한다. 별도 로그인 UUID와 DB 내부 로그인 ID는 payload에 넣지 않는다.
- 생성은 generateTokens(userUuid) 하나다. saveRefreshToken(userId, refreshToken, expiresAt)은 새 로그인 기록과 첫 토큰 해시 행만 트랜잭션으로 저장한다. 토큰을 생성하는 래퍼 함수는 만들지 않는다.
- LoginService.login은 기존 활성 사용자/지갑 조회 후 generateTokens → saveRefreshToken 순으로 호출한다. DB 내부 id는 저장에만 사용한다. 로그인 컨트롤러의 강제 admin/admin 치환을 제거하되 입력 검증과 프론트 개발 경로 기본 계정은 유지한다.
- POST /auth/login 및 POST /auth/refresh 성공은 HTTP 200과 기존 uuid/displayName/accountType/availablePoints + accessToken/refreshToken/expiresIn:900. 원문 토큰은 성공 응답과 런타임 메모리에만 두고 로그·정적 테스트 값·DB에는 남기지 않는다.
- 갱신 body는 { refreshToken: 비어 있지 않은 문자열 }. 먼저 Refresh 전용 키로 서명·알고리즘·용도·필수 클레임을 검증한다. 재사용 탐지를 위해 이미 만료된 과거 토큰도 서명 검증 후 해시를 찾을 수 있게 ignoreExpiration=true를 사용하되, 새 토큰 발급 전 JWT exp와 DB expiresAt를 직접 검사한다. 서명되지 않은 decode 값으로 DB 폐기하지 않는다.
- token_hash 고유 인덱스로 토큰 이력을 찾고 내부 auth_session_id로 로그인 기록을 조회한다. 모든 refresh/logout은 로그인 기록 행을 먼저 FOR UPDATE로 잠근다. 이후 토큰 행을 다시 잠금 조회한다. 모든 경로의 잠금 순서를 동일하게 유지한다.
- 토큰의 사용자 sub가 해당 로그인 기록의 user_id와 일치하는지 확인한다. 활성 사용자만 갱신할 수 있다. 알 수 없는 해시/잘못된 서명/소유자 불일치는 401이며 다른 로그인을 폐기하지 않는다.
- 정상 갱신은 이전 행을 덮어쓰지 않는다. 이전 행의 used_at 설정 + 같은 auth_session_id의 새 토큰 행 추가를 하나의 트랜잭션으로 커밋한다. 새 Refresh 만료는 새 발급 시점부터 14일이다.
- 이미 used_at이 있는 과거 토큰을 다시 제출하면 auth_sessions.revoked_at을 설정한다. 이전 토큰이 만료됐더라도 서명과 소유자가 맞고 이력이 있으면 같은 재사용 탐지를 수행한다. 이 로그인에서 발급한 최신 Refresh까지 모두 거부되며 다른 기기의 로그인은 유지된다.
- 폐기 상태 저장 후 트랜잭션 내부에서 예외를 던지면 rollback된다. 재사용 분기는 실패 결과를 반환해 폐기를 커밋한 뒤 바깥에서 InvalidTokenException을 던진다. JWT 검증 실패와 일반 DB 장애를 같은 것으로 뭉개지 않는다.
- 동시에 같은 토큰을 갱신하면 한 요청만 성공하고 후행 요청은 재사용으로 로그인을 폐기한다. 따라서 먼저 성공한 응답의 새 Refresh도 이후 401이다. 유예 시간이나 이전 토큰 재시도 허용은 두지 않는다.
- POST /auth/logout: 서명/용도/클레임과 exp를 검증하고, 해시로 찾은 이력의 로그인 기록을 잠근 뒤 revoked_at을 설정한다. 이전에 사용한 유효 토큰으로도 같은 로그인 전체를 폐기한다. 이미 폐기되었거나 기록이 없으면 204, 잘못된/만료 토큰은 401, 잘못된 body는 400이다. 행을 삭제하지 않는다.
- 로그인 전체 폐기는 Refresh만 막는다. 기존 Access Token은 최대 15분 유효하다. 과거 토큰 재사용 전까지 공격자의 최초 사용을 식별할 수 없다는 한계도 문서화한다.
- AUTH_INVALID_TOKEN_INPUT(400, InvalidTokenInput), AUTH_INVALID_TOKEN(401, InvalidToken)을 기존 error.enum.ts/error.customExceptions.ts에 추가하고 AllExceptionFilter JSON 형식을 따른다. 재사용 탐지 후에도 외부 응답은 일반 인증 실패로 통일한다. 기존 AUTH_LOGIN_FAILED는 유지한다.
- JwtStrategy는 Bearer Access 검증(ignoreExpiration=false, HS256, Access 전용 키) 후 sub/tokenType/exp와 활성 사용자를 확인하고 { uuid }를 반환한다. JwtAuthGuard extends AuthGuard('jwt')에서 인증 실패를 InvalidTokenException으로 변환한다. 기존 UUID 기반 제품 API에는 아직 Guard를 적용하지 않는다.
- 기존 loginController.spec.ts는 변경된 생성자와 실제 계정 입력으로 갱신한다. 새 단위 테스트는 만료/서명/용도/이력 보존/폐기 커밋과 잠금 순서 등 내부 경계에 집중한다. 같은 시각에 발급한 Refresh가 jti 때문에 서로 다른지도 검증한다.
- 만료 단위 테스트는 미사용 만료 토큰으로 발급 불가, 사용된 만료 과거 토큰의 재사용으로 최신 토큰 폐기, Access 만료 거부를 각각 검증한다. ignoreExpiration=true가 만료된 토큰의 재발급 허용으로 이어지지 않음을 확인한다.
- Postman은 정상 로그인/갱신/로그아웃, 입력 400, 계정·변조·용도·미등록 토큰 401을 검증한다. 기존 임의 계정 admin 치환 기대는 실제 로그인 실패로 수정한다.
- 핵심 HTTP 재사용 시나리오: T0→T1 정상 갱신, T1→T2 추가 갱신, T0 재사용 401, T2 갱신도 401. 공격자 선행 갱신/정상 사용자 선행 갱신 양쪽 순서를 확인한다. 재사용 분기 후 다른 HTTP 요청에서도 폐기가 유지되어 rollback되지 않았음을 증명한다.
- 동시 갱신 HTTP 테스트는 두 요청 중 정확히 하나 200/하나 401인지, 성공 응답의 Refresh로도 후속 갱신이 401인지 검증한다. 테스트 불가/실패를 통과로 대체하지 않는다.
- 다른 로그인 B는 A의 재사용 탐지·로그아웃 후에도 갱신되어야 한다. 로그아웃 직후, 이미 폐기된 로그인, 이전 사용 토큰으로 로그아웃한 경우도 검증한다.
- 테스트는 자기 실행에서 생성한 로그인/이력만 생성·사용·폐기한다. 기록을 실제로 보존하므로 테스트 종료 정리는 행 삭제가 아니라 로그인 폐기다. 기존 콘텐츠·잔액·권한·시청 기록은 변경하지 않는다.
- API 문서와 back/test/api/README.md에 재사용 연쇄 폐기, 동시 요청/응답 유실 후 재시도의 재로그인 가능성, 과거 토큰 이력 보존, 로그아웃 멱등성과 오류를 적는다.
- conventions.md는 신규 인증 계약과 기존 UUID API의 미전환 상태를 구분한다. ARCHITECTURE.md에는 두 테이블의 책임과 DB 내부 연결, Passport, 프론트 저장/복원 및 재사용 탐지 한계를 기록한다.

### 주요 로직 코드 또는 변경 예시
토큰 생성은 하나만 둔다. JWT payload에 로그인 기록 ID를 넣지 않는다.
```ts
async generateTokens(userUuid: string) {
  const [accessToken, refreshToken] = await Promise.all([
    this.jwt.signAsync(
      { sub: userUuid, tokenType: 'access' },
      { secret: this.accessSecret, algorithm: 'HS256', expiresIn: 900 },
    ),
    this.jwt.signAsync(
      { sub: userUuid, tokenType: 'refresh' },
      {
        secret: this.refreshSecret,
        algorithm: 'HS256',
        expiresIn: 1209600,
        jwtid: randomUUID(),
      },
    ),
  ]);
  const claims = this.jwt.decode<{ exp: number }>(refreshToken);
  return {
    accessToken,
    refreshToken,
    refreshExpiresAt: new Date(claims.exp * 1000),
  };
}

async saveRefreshToken(userId: number, refreshToken: string, expiresAt: Date) {
  await this.dataSource.transaction(async (manager) => {
    const sessions = manager.getRepository(AuthSession);
    const session = await sessions.save(sessions.create({
      userId,
      revokedAt: null,
    }));
    const tokens = manager.getRepository(RefreshToken);
    await tokens.save(tokens.create({
      authSessionId: session.id,
      tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt,
      usedAt: null,
    }));
  });
}
```

verifyRefresh는 서명 검증과 클레임 검증을 수행한다. 만료 검사를 이 메서드에서 생략하는 이유는 사용된 과거 토큰을 찾아 폐기하기 위해서다. 새 토큰 발급은 아래 refresh 메서드의 exp 검사 이후에만 가능하다.
```ts
private async verifyRefresh(token: string) {
  try {
    const claims = await this.jwt.verifyAsync<{
      sub: string; jti: string; exp: number; tokenType: string;
    }>(token, {
      secret: this.refreshSecret,
      algorithms: ['HS256'],
      ignoreExpiration: true,
    });
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (claims.tokenType !== 'refresh' ||
        typeof claims.sub !== 'string' || !uuid.test(claims.sub) ||
        typeof claims.jti !== 'string' || !uuid.test(claims.jti) ||
        typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)) {
      throw new InvalidTokenException();
    }
    return claims;
  } catch {
    throw new InvalidTokenException();
  }
}
```

사용 기록은 삭제·교체하지 않고, 같은 로그인 기록의 폐기 상태로 새 토큰까지 막는다.
```ts
async refresh(refreshToken: string) {
  const claims = await this.verifyRefresh(refreshToken);
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  const found = await this.refreshTokens.findOneBy({ tokenHash });
  if (!found) throw new InvalidTokenException();

  const result = await this.dataSource.transaction(async (manager) => {
    const sessions = manager.getRepository(AuthSession);
    const tokens = manager.getRepository(RefreshToken);
    const session = await sessions.createQueryBuilder('session')
      .where('session.id = :id', { id: found.authSessionId })
      .setLock('pessimistic_write').getOne();
    if (!session || session.revokedAt !== null) return null;

    const stored = await tokens.createQueryBuilder('token')
      .where('token.id = :id', { id: found.id })
      .andWhere('token.authSessionId = :sessionId', { sessionId: session.id })
      .setLock('pessimistic_write').getOne();
    const user = await manager.getRepository(User).findOneBy({
      id: session.userId,
      uuid: claims.sub,
    });
    if (!stored || !user) return null;

    const now = new Date();
    if (stored.usedAt !== null) {
      session.revokedAt = now;
      session.updatedAt = now;
      await sessions.save(session);
      return null;
    }
    if (user.status !== 'ACTIVE' ||
        claims.exp * 1000 <= now.getTime() ||
        stored.expiresAt.getTime() <= now.getTime()) return null;

    const generated = await this.generateTokens(user.uuid);
    stored.usedAt = now;
    stored.updatedAt = now;
    await tokens.save(stored);
    await tokens.save(tokens.create({
      authSessionId: session.id,
      tokenHash: createHash('sha256').update(generated.refreshToken).digest('hex'),
      expiresAt: generated.refreshExpiresAt,
      usedAt: null,
    }));
    const wallet = await manager.getRepository(Wallet)
      .findOneBy({ userId: user.id });
    return {
      uuid: user.uuid,
      displayName: user.displayName,
      accountType: user.accountType,
      availablePoints: wallet?.availablePoints ?? 0,
      accessToken: generated.accessToken,
      refreshToken: generated.refreshToken,
      expiresIn: 900,
    };
  });

  // 트랜잭션 밖에서 던져야 재사용 탐지에 의한 폐기가 커밋된다.
  if (result === null) throw new InvalidTokenException();
  return result;
}

async logout(refreshToken: string) {
  const claims = await this.verifyRefresh(refreshToken);
  if (claims.exp * 1000 <= Date.now()) throw new InvalidTokenException();
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
  const found = await this.refreshTokens.findOneBy({ tokenHash });
  if (!found) return;

  await this.dataSource.transaction(async (manager) => {
    const sessions = manager.getRepository(AuthSession);
    const session = await sessions.createQueryBuilder('session')
      .where('session.id = :id', { id: found.authSessionId })
      .setLock('pessimistic_write').getOne();
    if (!session || session.revokedAt !== null) return;
    const stored = await manager.getRepository(RefreshToken)
      .createQueryBuilder('token')
      .where('token.id = :id', { id: found.id })
      .andWhere('token.authSessionId = :sessionId', { sessionId: session.id })
      .setLock('pessimistic_write').getOne();
    if (!stored) return;
    const user = await manager.getRepository(User).findOneBy({
      id: session.userId,
      uuid: claims.sub,
    });
    if (!user) throw new InvalidTokenException();
    session.revokedAt = new Date();
    session.updatedAt = session.revokedAt;
    await sessions.save(session);
  });
}
```

로그인 호출은 LoginService.login의 계정 검증 이후에 둔다. saveRefreshToken이 실패하면 응답을 반환하지 않는다.
```ts
const tokens = await this.tokenService.generateTokens(row.uuid);
await this.tokenService.saveRefreshToken(
  row.id, tokens.refreshToken, tokens.refreshExpiresAt,
);
return {
  uuid: row.uuid,
  displayName: row.displayName,
  accountType: row.accountType,
  availablePoints: row.availablePoints ?? 0,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  expiresIn: 900,
};
```

### 완료 조건과 검증 환경
백엔드 checks 전체 통과, 위 HTTP 재사용/동시성/로그인 독립성 시나리오 통과, 폐기 후 후속 요청 401, DB에 원문 미저장, API·문서·Entity 일치. Access 검증은 아직 실제 제품 API에 연결하지 않으므로 Strategy/Guard 단위 테스트로 검증하고 그 한계를 적는다.
기존 localhost:3000에 HTTP로 연결하고 새 응답으로 현재 코드 반영을 확인한다. 서버 불가 시 실패와 npm --prefix back run start:dev를 안내하고 별도 서버를 시작하지 않는다. 반영 여부가 불확실하면 사용자에게 확인한다.
