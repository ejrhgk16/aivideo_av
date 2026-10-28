# task-1-auth-session-storage

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `back/src/identity/entities/user.entity.ts`
- `back/src/common/entities/auditedEntity.entity.ts`
- `back/src/common/database/databaseConfig.ts`
- `back/src/common/database/migrations/20261027000000AddUserLoginCredentials.ts`
- `back/test/api/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`

## 작업

로그인별 폐기 상태를 저장하는 auth_sessions와 Refresh Token 사용 이력을 보존하는 refresh_tokens를 추가한다. task-2의 선행 작업이다.

### 정확한 수정 파일 범위
- `back/src/identity/entities/authSession.entity.ts`
- `back/src/identity/entities/refreshToken.entity.ts`
- `back/src/identity/entities/index.ts`
- `back/src/common/database/entities.ts`
- `back/src/common/database/migrations/20261028000000AddAuthSessions.ts`
- `back/test/unit/entities/entities.spec.ts`
- `_docs/AI_DRAMA_data_model/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/scope.md`
- `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- `_docs/AI_DRAMA_data_model/01-identity/README.md`
- `_docs/AI_DRAMA_data_model/01-identity/auth_sessions.md`
- `_docs/AI_DRAMA_data_model/01-identity/refresh_tokens.md`

### 검증 명령
```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

### 구현 지시
- AuthSession/RefreshToken 두 Entity와 두 테이블을 새로 추가한다. 아직 제품 구현 전이므로 기존 데이터 전환은 필요하지 않다.
- auth_sessions: id unsigned int 자동 증가, user_id unsigned int, revoked_at nullable datetime(3), AuditedEntity의 created_at/updated_at. user_id에 인덱스. 별도 UUID 열은 만들지 않는다.
- refresh_tokens: id unsigned int 자동 증가, auth_session_id unsigned int, token_hash unique char(64), expires_at datetime(3), used_at nullable datetime(3), AuditedEntity의 created_at/updated_at. auth_session_id와 expires_at에 인덱스.
- auth_session_id는 DB 내부 정수 로그인 기록 ID다. 모든 교체 토큰이 같은 로그인 기록을 참조하므로 과거 토큰 해시로도 현재 토큰의 폐기 여부를 결정할 수 있다. API나 JWT payload에는 넣지 않는다.
- token_hash는 발급한 Refresh Token 전체의 SHA-256 hex 해시다. 갱신 시 기존 해시를 덮어쓰거나 행을 삭제하지 않는다. 기존 행의 used_at을 설정하고 새 해시 행을 추가한다.
- revoked_at은 해당 로그인에서 발급한 모든 Refresh Token에 적용된다. 다른 로그인 기록에는 영향을 주지 않는다. 이미 사용한 토큰이라도 기록을 보존해 재사용을 감지한다.
- 로그인 기록이 유효한 동안 토큰 이력을 삭제하지 않는다. 만료된 과거 토큰 이력도 해당 로그인의 재사용 탐지에 필요하므로 expires_at만 보고 삭제하지 않는다. 자동 정리 작업은 이번 범위에 추가하지 않는다.
- 기존 모델처럼 Entity 객체 관계와 물리 외래 키는 만들지 않고 내부 정수 참조와 인덱스로 관리한다. 원문 토큰은 저장하지 않는다.
- 두 Entity를 identity barrel과 aiDramaEntities registry에 한 번씩 등록한다.
- AddAuthSessions20261028000000 마이그레이션의 up에서 두 테이블과 인덱스를 생성하고 down은 refresh_tokens → auth_sessions 순으로 신규 테이블만 제거한다. 기존 테이블/데이터 초기화와 자동 migrationsRun 변경은 하지 않는다.
- Entity 테스트: 총 22 → 24개 테이블, auth_sessions/refresh_tokens 추가. 정수 키/참조, 해시 고유성, nullable 사용·폐기 시각과 인덱스를 검증한다. 두 Entity는 공개 UUID를 가진 Entity 목록에 넣지 않는다.
- 데이터 모델 루트/범위 문서는 총 24개, identity는 4개로 갱신한다. ERD는 users → auth_sessions → refresh_tokens 일대다 관계를 추가한다.
- auth_sessions.md는 로그인 단위 폐기, refresh_tokens.md는 불변 해시·사용 이력·같은 로그인 연결과 보존 조건을 정의한다. 도메인 README/전체 표도 맞춘다.

### 주요 로직 코드 또는 변경 예시
이 Task는 아래 선언과 같은 스키마를 추가한다. 실제 갱신·폐기 로직은 task-2에서 구현한다.
```ts
@Entity({ name: 'auth_sessions' })
@Index('idx_auth_sessions_user_id', ['userId'])
export class AuthSession extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @Column({ name: 'revoked_at', type: 'datetime', precision: 3, nullable: true })
  revokedAt!: Date | null;
}

@Entity({ name: 'refresh_tokens' })
@Index('idx_refresh_tokens_auth_session_id', ['authSessionId'])
@Index('idx_refresh_tokens_expires_at', ['expiresAt'])
export class RefreshToken extends AuditedEntity {
  @PrimaryGeneratedColumn({ type: 'int', unsigned: true })
  id!: number;

  @Column({ name: 'auth_session_id', type: 'int', unsigned: true })
  authSessionId!: number;

  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 3 })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'datetime', precision: 3, nullable: true })
  usedAt!: Date | null;
}
```

### 완료 조건과 검증 환경
Entity・DDL・문서・registry가 일치하고 전체 백엔드 검증이 통과해야 한다. DB_SYNCHRONIZE=false에서는 기존 마이그레이션 절차를 따르고 테스트를 위해 DB reset/seed하지 않는다. 기존 API 계약은 아직 바뀌지 않아야 한다.
서버 HTTP 연결 확인·실패 처리·실행 안내는 plan.md와 back/test/api/README.md를 따른다.
