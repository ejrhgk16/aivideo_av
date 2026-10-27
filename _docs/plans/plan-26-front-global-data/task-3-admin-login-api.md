# task-3-admin-login-api

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `.agents/skills/database-schema-designer/SKILL.md`
- `back/src/identity/entities/user.entity.ts`
- `back/src/economy/entities/wallet.entity.ts`
- `back/src/economy/pointController.ts`
- `back/src/common/error/error.baseException.ts`
- `back/src/common/error/error.enum.ts`
- `back/src/common/error/error.customExceptions.ts`
- `back/src/common/error/error.filter.ts`
- `back/src/common/database/seed.ts`
- `back/src/common/database/seed/initialData.ts`
- `back/src/common/database/databaseConfig.ts`
- `back/test/unit/database/seed.spec.ts`
- `back/test/unit/database/initialData.spec.ts`
- `back/test/api/README.md`
- `back/test/api/public.postman_collection.json`
- `_docs/api/00-overview/conventions.md`
- `_docs/AI_DRAMA_data_model/01-identity/users.md`

## 작업

task-1 완료 후 실행한다. 허용 파일은 아래 22개뿐이다. 다른 작업자의 변경을 되돌리지 않고 apply_patch로 수정한다.

- `back/src/identity/identity.module.ts`
- `back/src/identity/loginController.ts`
- `back/src/identity/loginService.ts`
- `back/src/common/error/error.enum.ts`
- `back/src/common/error/error.customExceptions.ts`
- `back/src/app.module.ts`
- `back/test/unit/loginController.spec.ts`
- `back/test/api/public.postman_collection.json`
- `back/test/api/README.md`
- `_docs/api/01-identity/login.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/01-identity/README.md`
- `_docs/api/README.md`
- `_docs/ARCHITECTURE.md`
- `back/src/identity/entities/user.entity.ts`
- `back/src/common/database/migrations/20261027000000AddUserLoginCredentials.ts`
- `back/src/common/database/seed.ts`
- `back/src/common/database/seed/initialData.ts`
- `back/test/unit/database/seed.spec.ts`
- `back/test/unit/database/initialData.spec.ts`
- `back/test/unit/entities/entities.spec.ts`
- `_docs/AI_DRAMA_data_model/01-identity/users.md`

### 스키마와 시드

기존 내부 숫자 id, 공개 uuid, 표시용 displayName은 유지한다. 로그인용 엔티티 속성 loginId와 password를 users에 추가한다. DB 컬럼은 기존 snake_case 규칙에 맞춰 login_id VARCHAR(100) NULL, password VARCHAR(255) NULL이다. login_id에는 uq_users_login_id 고유 인덱스를 둔다. password는 select:false로 선언하고 현재 단계에서는 요청한 비밀번호 원문을 저장한다. 해시·암복호화는 구현하지 않는다. 기존 사용자와 게스트는 두 값이 null일 수 있으며 로그인할 수 없다. 기존 사용자에 임의 자격 증명을 채우지 않는다.

20261027000000AddUserLoginCredentials.ts의 up은 위 두 컬럼과 고유 인덱스를 추가하고 down은 그 인덱스와 컬럼만 제거한다. 기존 사용자·지갑·원장 데이터는 유지한다. DB_SYNCHRONIZE와 마이그레이션을 중복 적용하지 않는다. 실행 중 서버가 이미 synchronize한 경우 실제 스키마를 확인하고 기존 데이터 삭제 없이 동일 변경이 안전하게 적용되도록 마이그레이션을 작성한다. 부분 적용 시에도 컬럼·인덱스 정의가 목표와 일치하는지 검사하며 오류를 무시하지 않는다.

hashPassword, verifyPassword, derive 및 관련 파일·테스트·의존성은 추가하지 않는다.

initialData.ts에 adminLogin: { loginId: 'admin', password: 'admin' } 개발 시드 설정을 추가한다. 시드 설정 자체를 API 런타임에서 import하지 않는다. 컨트롤러의 임시 admin/admin 치환과 별도로 DB 계정을 준비한다. seedData에서 adminLogin 값을 그대로 저장한다. 신규 admin에는 loginId=admin, password=admin을 저장하고 기존 admin의 두 컬럼이 모두 null이면 동일 자격 증명을 채운다. 이미 자격 증명이 있으면 비밀번호를 재설정하지 않는다. admin UUID·역할·기존 포인트와 최초 지급 원장의 중복 방지 동작은 유지한다. 시드를 다시 실행해도 포인트가 추가 지급되거나 기존 구매 데이터가 변경되면 안 된다.

### API 계약

POST /auth/login은 JSON { loginId: string, password: string }를 필수로 받는다. 누락·빈 문자열·공백뿐인 값·비문자열·loginId 100자 초과는 InvalidLoginInputException(400)이다. 요청값은 정상 검증하되 현재 개발 단계에서는 컨트롤러에서 서비스에 넘길 loginId/password를 admin/admin으로 임시 덮어쓴다. 이 치환은 아래 예시의 두 대입문에만 두고 서비스에는 admin 분기를 넣지 않는다.

loginId로 실제 DB 사용자를 조회하며 ACTIVE 사용자만 허용한다. OPERATOR 제한이나 admin UUID/displayName 조건은 두지 않는다. 사용자와 지갑은 LEFT JOIN하여 DB 쿼리 한 번으로 조회하며 WHERE에서 user.loginId, user.password, ACTIVE 상태를 함께 비교한다. password는 SELECT에 포함하지 않는다. 사용자 부재·비활성·저장 비밀번호 부재·비밀번호 불일치는 모두 LoginFailedException(401)이다. 자격 증명이 일치하면 로그인에 성공하며 조회된 availablePoints가 null이면 0으로 응답한다. 지갑 누락 예외를 만들거나 지갑을 자동 생성하지 않는다. 지갑 부재나 잔액 0으로 비밀번호 검증을 생략하지 않는다.

응답은 { uuid, displayName, accountType, availablePoints }만 반환한다. password, 내부 id, 상태, 임의 인증 토큰을 반환하거나 로그로 남기지 않는다. DB 오류를 로그인 실패로 숨기지 않는다. 로그인은 조회만 수행하며 사용자·지갑을 생성하거나 포인트를 지급하지 않는다.

개발 환경 전용 404 판정은 두지 않는다. 컨트롤러의 임시 admin/admin 치환 후에도 서비스는 전달받은 자격 증명을 DB와 실제 대조한다. 나중에 컨트롤러의 두 대입문만 제거하면 요청값이 그대로 검증되는 구조다. 토큰·쿠키·서버 세션·회원가입·다른 API 접근 제어는 이번 범위가 아니다. 따라서 자격 증명 확인과 사용자·잔액 반환을 구현한 것이며 전체 운영 인증 체계가 완료됐다고 보고하지 않는다.

IdentityModule은 TypeOrmModule.forFeature([User, Wallet])와 LoginController/LoginService를 등록하고 AppModule에 연결한다. 기존 오류 필터를 @UseFilters(AllExceptionFilter)로 적용한다.

| 예외 클래스 | ErrorCodeEnum 키 / 값 | errorName | HTTP |
| --- | --- | --- | --- |
| InvalidLoginInputException | InvalidLoginInput / AUTH_INVALID_LOGIN_INPUT | InvalidLoginInput | 400 |
| LoginFailedException | LoginFailed / AUTH_LOGIN_FAILED | LoginFailed | 401 |

BaseException 상속으로 구현하며 응답은 기존 { errorCode, errorName, statusCode, timestamp, path }를 따른다. error.filter.ts 자체와 기존 포인트 오류는 바꾸지 않는다.

### 주요 로직 코드 또는 변경 예시


```ts
async login(input: { loginId: string; password: string }) {
  const row = await this.users.createQueryBuilder('user')
    .leftJoin(Wallet, 'wallet', 'wallet.userId = user.id')
    .select('user.uuid', 'uuid')
    .addSelect('user.displayName', 'displayName')
    .addSelect('user.accountType', 'accountType')
    .addSelect('wallet.availablePoints', 'availablePoints')
    .where('user.loginId = :loginId', { loginId: input.loginId })
    .andWhere('CAST(user.password AS BINARY) = CAST(:password AS BINARY)', { password: input.password })
    .andWhere('user.status = :status', { status: 'ACTIVE' })
    .getRawOne<{
      uuid: string;
      displayName: string | null;
      accountType: string;
      availablePoints: number | null;
    }>();
  if (!row) {
    throw new LoginFailedException();
  }
  return {
    uuid: row.uuid, displayName: row.displayName,
    accountType: row.accountType, availablePoints: row.availablePoints ?? 0,
  };
}
```

Controller는 아래처럼 입력을 검사하고 서비스 입력 객체를 만든 뒤 admin/admin으로 임시 치환한다. 이 두 대입문을 제거하면 다른 코드 변경 없이 요청값을 서비스로 전달한다. trim은 공백뿐인지 검사할 때만 사용한다. 비밀번호의 SQL 비교는 BINARY로 수행해 DB collation이 대소문자나 뒤 공백 차이를 무시하지 않게 한다. admin/ADMIN, admin과 뒤 공백이 붙은 비밀번호는 서로 다른 값이다.

```ts
@Controller('auth')
@UseFilters(AllExceptionFilter)
export class LoginController {
  constructor(private readonly loginService: LoginService) {}

  @Post('login')
  @HttpCode(200)
  login(@Body() body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new InvalidLoginInputException();
    }
    const input = body as Record<string, unknown>;
    if (typeof input.loginId !== 'string' || !input.loginId.trim()
      || input.loginId.length > 100
      || typeof input.password !== 'string' || !input.password.trim()) {
      throw new InvalidLoginInputException();
    }
    const loginInput = { loginId: input.loginId, password: input.password };
    loginInput.loginId = 'admin';
    loginInput.password = 'admin';
    return this.loginService.login(loginInput);
  }
}
```

```ts
export class LoginFailedException extends BaseException {
  constructor() {
    super(ErrorCodeEnum.LoginFailed, 'LoginFailed', HttpStatus.UNAUTHORIZED);
  }
}

// seedData 내부의 admin 처리:
const credentials = {
  loginId: initialData.adminLogin.loginId,
  password: initialData.adminLogin.password,
};
await userRepository.createQueryBuilder().insert()
  .values({ ...initialData.adminUser, ...credentials })
  .orIgnore().updateEntity(false).execute();
const admin = await userRepository.findOneOrFail({
  where: { uuid: initialData.adminUser.uuid },
  select: { id: true, uuid: true, loginId: true, password: true },
});
if (admin.loginId === null && admin.password === null) {
  await userRepository.update({ id: admin.id }, credentials);
}
// 이후 기존 지갑·최초 포인트 지급 로직을 유지한다.
```

시드 자격 증명 준비 과정에서 실제 불일치·고유키 충돌을 orIgnore로 숨기지 않는다. 조회된 admin 자격 증명이 이미 있는 경우에는 보존한다. 위 select는 password의 select:false를 명시적으로 해제하므로 기존 admin의 두 컬럼이 null인지 검사할 수 있다. .orIgnore() 이후 고정 UUID의 admin이 실제로 존재하는지 확인하며 다른 사용자의 loginId=admin 충돌로 조회되지 않으면 명확히 실패한다.

### 문서와 검증

users.md에 컬럼·고유 인덱스·원문 비밀번호 저장·게스트 null 정책을 갱신하고 기존 인증 미정 문구를 현재 계약에 맞게 수정한다. API 문서와 README에 loginId/password 요청, 성공 응답, custom 오류, admin/admin 개발 시드와 토큰/세션 미발급을 명시한다. conventions.md에 로그인 custom 오류 형식을 반영하고 아키텍처 문서의 task-1 내용을 보존하며 identity/비밀번호·시드 책임을 기록한다.

Postman은 admin/admin으로 실제 POST 성공, 반복 성공, 포인트 0 이상 정수, 공개 필드만 반환, password/Set-Cookie 미노출을 확인한다. 다른 형식상 유효한 loginId/password도 임시 치환으로 admin 로그인이 되는지 확인한다. 입력 누락·빈 값·비문자열은 custom 400을 검사한다. 잘못된 자격 증명의 custom 401은 서비스 직접 단위 테스트로 확인한다. HTTP 401 검증은 임시 치환 제거 후 요청값 기반으로 전환한다. timestamp/path/errorCode/errorName도 검증한다. admin UUID는 응답에서 얻어 후속 검증에 사용하고 로그인 쿼리가 UUID로 고정되지 않게 한다.

컨트롤러 테스트는 서로 다른 유효 입력에도 서비스가 admin/admin을 전달받고 입력 오류 시 서비스가 호출되지 않는지 검증한다. 서비스 단위 테스트는 잘못된 loginId/password에 해당하는 결과 행 부재의 custom 401, 사용자 부재·비활성 조회 제외·비밀번호 미설정, 지갑 누락으로 availablePoints=null일 때 성공 응답 0, 실제 0 잔액과 양수 잔액 보존, 엔티티 nullable/unique/select:false, 마이그레이션의 신규 컬럼·인덱스(필요 시 entities.spec.ts에 위치), 시드 신규/기존 admin 보완·기존 자격 증명 보존·재실행 시 포인트 미증가를 검증한다. null 잔액 검증을 위해 기존 admin 지갑을 삭제하지 않고 query builder 대역을 사용한다. 시드 대역도 명시 select를 지원하고 password를 읽지 못해 null 보완이 누락되는 회귀를 확인한다. 서비스 조회 조건이 입력 loginId/password와 ACTIVE를 함께 사용하며 admin UUID/displayName/OPERATOR 제한이 없다는 것도 검토한다. 기존 테스트 대역은 필요한 부분만 수정한다. HTTP 동작 테스트를 mock 단위 테스트로 대체하지 않는다.

실행 시 개발 API localhost:3000 HTTP 연결과 코드 반영 여부를 확인한다. 서버가 없으면 실패와 `npm --prefix back run start:dev`를 안내하고 자동 실행·다른 포트 우회는 하지 않는다. 이번 요청은 컬럼·시드 변경을 포함하므로 계획 실행 중 기존 데이터 삭제 없이 스키마 적용과 명시적인 admin 시드 보완을 허용한다. 기존 synchronize 상태를 확인해 중복 DDL을 피하고 API 검증 전 admin/admin 로그인이 가능한지 확인한다. DB reset은 하지 않는다.

검증 명령:
- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`

완료 조건: 두 컬럼과 고유 인덱스가 구현되고 admin/admin으로 로그인 가능하며 DB에는 이번 단계에서 원문 password를 저장한다. 로그인은 입력 loginId/password를 WHERE에서 함께 비교하고 단일 JOIN으로 실제 잔액을 반환한다. custom 오류, 시드 재실행의 데이터 보존, API 문서·테스트·빌드가 검증된다. 컨트롤러의 두 임시 대입문 외에는 서비스·쿼리에 admin 자격 증명/UUID/displayName 고정 조건이 없다. 두 대입문만 제거하면 실제 요청값 검증으로 전환된다.
