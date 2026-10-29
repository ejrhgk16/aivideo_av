# task-1-backend-watch-progress-api

## 읽어야 할 파일

- `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`, `.agents/skills/api-and-interface-design/SKILL.md`
- `_docs/plans/plan-35-episode-watch-progress/plan.md`
- `back/src/playback/entities/userWatchProgress.entity.ts`, `back/src/common/entities/auditedEntity.entity.ts`
- `back/src/content/publicCatalogService.ts`, `back/src/content/content.module.ts`
- `back/src/identity/jwtAuthGuard.ts`, `back/src/identity/identity.module.ts`
- `back/src/economy/pointController.ts`, `back/src/common/error/error.filter.ts`
- `back/test/api/README.md`, `back/test/api/public.postman_collection.json`
- `_docs/api/04-playback/episodes.md`, `_docs/api/00-overview/conventions.md`

## 작업

담당 범위는 아래 9개 파일에 한정한다. 다른 작업자가 존재할 수 있으므로 다른 변경을 되돌리지 않는다.

```text
back/src/app.module.ts
back/src/playback/playback.module.ts
back/src/playback/watchProgressController.ts
back/src/playback/watchProgressService.ts
back/test/api/public.postman_collection.json
back/test/api/README.md
_docs/api/04-playback/README.md
_docs/api/04-playback/watch-progress.md
_docs/ARCHITECTURE.md
```

`PlaybackModule`에 JWT guard와 저장 service/controller를 등록하고 AppModule에서 import한다. ORM 조회에 필요한 기존 엔티티를 등록한다. 기존 공개 카탈로그의 책임을 이동하거나 리팩토링하지 않는다. 아키텍처 문서에는 playback 모듈의 저장 책임과 새 JWT 필수 endpoint를 명시한다.

### API 계약

- `PUT /me/episodes/:episodeUuid/watch-progress`, Access JWT 필수. 요청 사용자는 JWT uuid로만 결정한다. body/query의 사용자 식별자로 다른 사용자를 선택할 수 없다.
- body: `{ event: 'STARTED' | 'COMPLETED', positionMs: number }`. positionMs는 0 이상 정수이며 선택된 FULL 영상 durationMs 이하여야 한다. STARTED는 positionMs=0만 허용한다. COMPLETED는 `positionMs * 3 >= durationMs * 2`일 때만 허용한다. 영상 길이와 완료 여부는 클라이언트가 지정하지 않는다.
- 성공: `204 No Content`, 신규·기존 행 모두 동일하다.
- 입력 오류·범위를 벗어난 위치·2/3 미만 완료 요청: NestJS 기본 400. 없는/비공개/예약 공개 작품·회차 또는 FULL 영상 없음: 기본 404.
- JWT 없음/무효: 기존 `AUTH_INVALID_TOKEN` 401. 유료 회차 미구매: 기존 `EPISODE_ACCESS_DENIED` 403. 기존 필터와 예외를 재사용하고 새 전역 오류 규칙은 만들지 않는다.
- 이 API에는 새 환경 제한을 추가하지 않는다. 저장은 공개·권한 검증을 따르며, 재생 URL의 개발 환경 제한은 기존 그대로다. S3 서명 발급이나 다운로드는 저장에 필요하지 않다.
- STARTED: 새 행은 position=0, incomplete. 기존 행은 위치와 완료를 그대로 보존. last_played_at과 updated_at은 서버 시각 갱신.
- COMPLETED: 행이 없어도 생성 가능. positionMs 저장, 완료 true. 기존 완료를 false로 되돌리는 경로 없음. 중복·동시 요청에도 PK별 한 행이며 늦은 STARTED가 완료 위치를 초기화하면 안 된다.

### 주요 로직 코드 또는 변경 예시

다음은 service의 검증·원자적 저장 흐름이다. 실제 파일의 DI와 타입은 기존 NestJS/TypeORM 스타일에 맞추되 핵심 동작을 유지한다. controller는 unknown body를 검사해 아래 Input을 만들고, guard/filter를 적용한 뒤 service 호출 후 204를 반환한다.

```ts
type Input = { event: 'STARTED' | 'COMPLETED'; positionMs: number };

async function saveProgress(db: DataSource, userUuid: string, episodeUuid: string, input: Input) {
  const rows = await db.query(`
    SELECT u.id AS userId, e.id AS episodeId, e.price_points AS pricePoints,
           v.duration_ms AS durationMs, en.id AS entitlementId
    FROM episodes e
    JOIN dramas d ON d.id = e.drama_id
    JOIN content_videos v ON v.content_type = 'EPISODE'
      AND v.content_id = e.id AND v.kind = 'FULL'
    JOIN users u ON u.uuid = ?
    LEFT JOIN episode_entitlements en ON en.user_id = u.id AND en.episode_id = e.id
    WHERE e.uuid = ? AND e.status = 'PUBLISHED' AND e.published_at <= CURRENT_TIMESTAMP(3)
      AND d.status = 'PUBLISHED' AND d.published_at <= CURRENT_TIMESTAMP(3)
    ORDER BY v.display_order ASC LIMIT 1
  `, [userUuid, episodeUuid]);
  const row = rows[0];
  if (!row) throw new NotFoundException();
  if (Number(row.pricePoints) > 0 && row.entitlementId === null) {
    throw new EpisodeAccessDeniedException();
  }
  const completed = input.event === 'COMPLETED';
  if (!Number.isInteger(input.positionMs) || input.positionMs < 0 ||
      input.positionMs > Number(row.durationMs) ||
      (!completed && input.positionMs !== 0) ||
      (completed && input.positionMs * 3 < Number(row.durationMs) * 2)) {
    throw new BadRequestException('Invalid watch progress');
  }
  await db.query(`
    INSERT INTO user_watch_progress
      (user_id, episode_id, position_ms, is_completed, last_played_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3))
    ON DUPLICATE KEY UPDATE
      position_ms = IF(? = 1, ?, position_ms),
      is_completed = GREATEST(is_completed, ?),
      last_played_at = CURRENT_TIMESTAMP(3), updated_at = CURRENT_TIMESTAMP(3)
  `, [row.userId, row.episodeId, input.positionMs, Number(completed),
      Number(completed), input.positionMs, Number(completed)]);
}
```

조회 후 존재 여부에 따라 INSERT/UPDATE를 나누지 않고 복합 PK와 단일 upsert로 경쟁을 처리한다. controller의 body 검증은 객체/배열 구분, event enum, 정수 positionMs를 포함한다. SQL은 반드시 parameter binding을 사용한다. db에서 얻은 내부 정수 ID만 저장하며 외부 UUID를 숫자 컬럼에 넣지 않는다. created_at은 기존 행 갱신 때 보존한다.

### HTTP 검증과 문서

기존 Postman 컬렉션의 읽기·시청기록 fixture 검증을 보존한다. mutation은 읽기 검증 뒤 실행하고 기존 고정 progress fixture와 다른 전용 사용자/회차 조합을 사용한다. README에 별도 fixture 준비·로그인 환경 변수·필수 데이터·재실행 조건을 명시하며 비밀 값을 컬렉션에 넣지 않는다. 신규 행 검증을 매 실행 반복할 수 있도록 테스트 전용 사용자/회차의 기록만 실행 전 SQL로 확인·정리하는 준비 절차를 README에 명시한다. 테스트가 소유한 전용 기록만 정리할 수 있고 일반 사용자 기록·기존 읽기 fixture는 삭제하지 않는다. 준비 후에도 신규 행 검증 대상에 기록이 있으면 조용히 건너뛰지 않고 데이터 조건 실패로 보고한다. worker와 finish의 전체 검증 실행 전 이 준비 절차가 필요함을 결과에 기록한다. 허용된 개발 DB에서 테스트 전용 사용자 준비는 가능하되 DB 초기화·기존 콘텐츠 수정·기존 읽기 fixture 변경은 하지 않는다.

실제 PUT 후 GET 작품 상세로 position/isCompleted/lastPlayedAt와 다른 사용자·익명의 null을 확인한다. 필요 시 DB SELECT로 복합키별 행 수와 created_at 보존을 추가 확인한다. 최소 사례:

1. 익명/잘못된 토큰 401, 유료 미구매 403, 없는 회차 404, 잘못된 body·음수·소수·길이 초과·2/3 미만 완료 400.
2. 최초 STARTED → incomplete/0, 같은 요청 반복 → 한 행. 무료와 구매된 유료 회차 양쪽의 성공 검증.
3. 서버 길이 기준 ceil(2*durationMs/3) 경계의 완료 요청 → true/요청 위치. 바로 아래 정수 위치는 400.
4. COMPLETED 반복, 완료 후 STARTED 및 가능한 동시 STARTED/COMPLETED → 완료 유지/위치 초기화 없음/한 행.
5. 사용자 식별자 spoofing이 다른 사용자의 기록을 수정하지 않음. 기존 사용자 fixture·포인트·권한에 영향 없음.

API 정의서는 경로·body·204·각 오류 형식·인증·공개 조건·중복/시각 정책·2/3 완료 의미를 모두 포함한다. 기존 공통 규칙 자체는 바꾸지 않는다.

### 검증 명령과 완료 조건

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`

기존 localhost:3000 서버에 HTTP로 접속하고 현재 코드 반영 여부를 확인한 뒤 실행한다. 코드 반영을 확인할 수 없으면 사용자에게 확인한다. 서버가 없으면 실패 처리하고 `npm --prefix back run start:dev`를 안내한다. 별도 서버·포트 우회는 금지한다. 필수 데이터 부족 역시 실패다. 공개 시각 경계 전체를 기존 HTTP fixture만으로 검증했다고 주장하지 않는다.

완료 조건: 새 PUT의 실제 DB 저장·중복·완료 유지·권한·입력 오류 검증 및 전체 백엔드 checks 통과, 문서와 구현 일치, 기존 상세 조회 계약 보존. 범위 밖 파일이 필요하면 임의 수정하지 말고 보고한다.
