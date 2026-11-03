# task-2-video-watch-progress-api

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-49-video-watch-progress/plan.md`
- `_docs/plans/plan-49-video-watch-progress/task-1-video-watch-progress-migration.md`
- `back/README.md`
- `back/test/api/README.md`
- `back/src/playback/watchProgressController.ts`
- `back/src/playback/watchProgressService.ts`
- `back/src/playback/entities/userWatchProgress.entity.ts`
- `back/src/content/publicCatalogService.ts`
- `back/src/content/contentResponses.ts`
- `back/src/playback/savedVideoService.ts`
- `back/test/api/run.mjs`
- `back/test/api/fixtureContext.mjs`
- `back/test/api/verifyParallel.mjs`
- `back/test/api/watch-progress.postman_collection.json`
- `back/test/api/content.postman_collection.json`
- `back/test/api/saved-videos.postman_collection.json`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/api/04-playback/watch-progress.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/00-overview/authentication.md`

## 작업

시청 기록 Entity·저장 API·작품 상세 JOIN·테스트 fixture를 사용자/영상 키로 함께 전환한다. 프리뷰는 API에서 저장할 수 있도록 하되 프론트 자동 기록은 추가하지 않는다.

### 수정 허용 파일

- `back/.env.development` — 사용자 재시작 허용에 따른 `DB_SYNCHRONIZE=false` 변경만 허용. 비밀 값은 출력·커밋하지 않는다.
- `back/tmp/plan49-db-transition.mjs` — 로컬 DB 상태 확인·백업 복원/이관 리허설·적용용 임시 스크립트. 사용 후 제거한다.
- `back/tmp/plan49-server.ps1` — 기존 백엔드 중지·동일 포트 재시작용 임시 스크립트. 사용 후 제거한다.
- `back/README.md` — 별도 DB 연결의 실제 대상 확인 및 이미 이관된 스키마/이력 정합화 절차를 보완한다.
- `back/src/playback/entities/userWatchProgress.entity.ts`
- `back/src/playback/watchProgressController.ts`
- `back/src/playback/watchProgressService.ts`
- `back/src/content/publicCatalogService.ts`
- `back/test/api/run.mjs`
- `back/test/api/fixtureContext.mjs`
- `back/test/api/verifyParallel.mjs`
- `back/test/api/watch-progress.postman_collection.json`
- `back/test/api/content.postman_collection.json`
- `back/test/api/saved-videos.postman_collection.json`
- `back/test/api/README.md`
- `back/test/unit/entities/entities.spec.ts`
- `back/test/unit/content/publicCatalogService.spec.ts`
- `back/test/unit/api/fixtureIsolation.spec.ts`
- `_docs/api/04-playback/watch-progress.md`
- `_docs/api/04-playback/README.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/00-overview/authentication.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- `_docs/AI_DRAMA_data_model/00-overview/scope.md`
- `_docs/AI_DRAMA_data_model/04-playback/README.md`
- `_docs/AI_DRAMA_data_model/04-playback/user_watch_progress.md`
- `_docs/AI_DRAMA_data_model/04-playback/user_preview_feed_states.md`

### 의존성과 검증 명령

- `depends_on`: `["task-1"]`

```text
npm --prefix back run test:unit -- test/unit/entities/entities.spec.ts test/unit/content/publicCatalogService.spec.ts test/unit/api/fixtureIsolation.spec.ts
npm --prefix back run test:api -- --suite watch-progress --suite content --suite playback --suite saved-videos
npm --prefix back run test:api
npm --prefix back run test:api:parallel
```


### 실행 전제와 영향 범위

- task-1과 plan-48-common-pagination 실행·검증 완료 후 시작한다. 공유 문서와 saved-videos 컬렉션의 기존 변경을 보존한다.
- 실행 중 사용자가 `허용할게 재시작해`라고 명시해 로컬 설정 변경 및 기존 백엔드의 중지·재시작을 허용했다. 이 승인은 본 task의 서버 자동 재시작 금지에 우선한다. 기존 3000 서버만 대상으로 확인하고 다른 서버·포트는 사용하지 않는다. 숨김 창으로 실행하고, 백업과 리허설을 위한 DB는 실행별 소유 이름을 사용한다. 백업과 시크릿은 저장소 밖에 보관하고, 임시 스크립트는 apply_patch로만 작성·제거한다.
- task-1의 DB 전환 절차를 검토하고 실제 스키마·migration 이력·백업/리허설 결과를 확인한다. Entity 수정의 hot reload 전에 기존 서버의 DB_SYNCHRONIZE=false 적용과 쓰기 중지·이관을 조율한다. 미확인 상태에서 Entity부터 바꿔 자동 동기화시키지 않는다.
- 기존 3000 서버에 코드·스키마가 함께 반영된 뒤 API 테스트한다. 반영 여부를 확인할 수 없으면 사용자에게 확인한다. 추가 서버·다른 포트로 우회하지 않는다. 허용된 재시작이 실패하면 실패로 기록하고 npm --prefix back run start:dev를 안내한다.
- 선택 실행은 변경 동작/소비자, 무인자 전체 API 실행은 공통 runner 회귀, parallel은 fixture 소유권과 정리를 확인한다. 단위 테스트는 HTTP로 검증하기 어려운 메타데이터·기존 내부 경계와 fixture cleanup에 한정한다.

### 구현 지시: Entity와 저장 API

- userWatchProgress.entity.ts의 episodeId/episode_id를 videoId/video_id로 교체한다. INT UNSIGNED 복합 PK와 video_id 인덱스를 task-1 migration과 일치시킨다. 다른 진도/시간 열은 유지한다. 물리 FK는 추가하지 않는다.
- Controller를 PUT /me/videos/:videoUuid/watch-progress로 변경하고 이전 회차 route를 제거한다. 필수 Access JWT·204·기존 body 검증을 유지하고 잘못된 UUID는 400으로 검증한다. 사용자·길이·완료 여부를 caller가 선택하게 하지 않는다.
- 저장 서비스는 영상 UUID를 직접 조회한다. 허용 조합은 EPISODE/FULL 또는 DRAMA/PREVIEW다. 작품은 PUBLISHED이고 publishedAt <= UTC_TIMESTAMP(3), 본편은 회차도 같은 공개 조건을 만족해야 한다.
- 유료 본편은 해당 JWT 사용자의 episode entitlement를 검사한다. 프리뷰는 본편 가격/권한을 요구하지 않는다. 무료 본편도 기록 요청에는 로그인이 필요하다.
- positionMs는 요청된 해당 영상 자체의 durationMs 기준으로 기존 STARTED=0, COMPLETED >= 2/3, 길이 이내를 검사한다. 다른 대표 FULL의 길이를 대신 쓰지 않는다.
- STARTED는 기존 완료·위치를 보존하고 최근/변경 시각만 갱신한다. COMPLETED는 완료 true와 입력 위치를 저장한다. 사용자/영상 키로 원자적 upsert하고 모든 신규/갱신 시각은 UTC_TIMESTAMP(3)를 쓴다.
- DB 조회는 QueryBuilder를 사용한다. 조건부 원자 upsert에 기존 raw SQL을 유지한다면 표현상 이유를 해당 코드에 짧게 명시한다. DB 오류를 인증/미발견으로 숨기지 않는다.

### 주요 로직 코드 또는 변경 예시

Controller의 호출 지점은 파싱한 videoUuid와 JWT user를 save에 전달한다. 저장 서비스의 핵심 흐름은 다음과 같다. 기존 parseInput과 오류 타입을 재사용하고 필요한 내부 Row 타입은 해당 서비스 안에 정의한다.

```ts
const row = await this.dataSource.createQueryBuilder()
  .from(ContentVideo, 'video')
  .leftJoin(Episode, 'episode',
    "video.contentType = 'EPISODE' AND video.kind = 'FULL' AND episode.id = video.contentId")
  .innerJoin(Drama, 'drama',
    "((video.contentType = 'EPISODE' AND video.kind = 'FULL' AND drama.id = episode.dramaId) OR " +
    "(video.contentType = 'DRAMA' AND video.kind = 'PREVIEW' AND drama.id = video.contentId))")
  .innerJoin(User, 'appUser', 'appUser.uuid = :userUuid', { userUuid })
  .leftJoin(EpisodeEntitlement, 'entitlement',
    'entitlement.userId = appUser.id AND entitlement.episodeId = episode.id')
  .select('appUser.id', 'userId')
  .addSelect('video.id', 'videoId')
  .addSelect('video.durationMs', 'durationMs')
  .addSelect('episode.pricePoints', 'pricePoints')
  .addSelect('entitlement.id', 'entitlementId')
  .where('video.uuid = :videoUuid', { videoUuid })
  .andWhere("drama.status = 'PUBLISHED' AND drama.publishedAt <= UTC_TIMESTAMP(3)")
  .andWhere("((video.contentType = 'DRAMA' AND video.kind = 'PREVIEW') OR " +
    "(video.contentType = 'EPISODE' AND video.kind = 'FULL' AND " +
    "episode.status = 'PUBLISHED' AND episode.publishedAt <= UTC_TIMESTAMP(3)))")
  .getRawOne<{
    userId: number; videoId: number; durationMs: number | string;
    pricePoints: number | string | null; entitlementId: number | null;
  }>();
if (!row) throw new NotFoundException('Watch-progress video was not found');
if (Number(row.pricePoints) > 0 && row.entitlementId === null) {
  throw new EpisodeAccessDeniedException();
}
const durationMs = Number(row.durationMs);
const completed = input.event === 'COMPLETED';
if (input.positionMs > durationMs ||
    (!completed && input.positionMs !== 0) ||
    (completed && input.positionMs * 3 < durationMs * 2)) {
  throw new BadRequestException('Invalid watch progress');
}
// 완료 상태/위치를 보존하는 조건부 원자 upsert를 위해 raw SQL을 사용한다.
await this.dataSource.query(`
  INSERT INTO user_watch_progress
    (user_id, video_id, position_ms, is_completed,
     last_played_at, created_at, updated_at)
  VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
  ON DUPLICATE KEY UPDATE
    position_ms = IF(VALUES(is_completed) = 1, VALUES(position_ms), position_ms),
    is_completed = GREATEST(is_completed, VALUES(is_completed)),
    last_played_at = UTC_TIMESTAMP(3),
    updated_at = UTC_TIMESTAMP(3)
`, [row.userId, row.videoId, input.positionMs, Number(completed)]);
```

작품 상세는 기존 대표 FULL 선정 조인을 그대로 사용하고 그 영상에만 progress를 연결한다. 존재 판정의 progressEpisodeId를 progressVideoId로 바꾸며 반환 API 키는 유지한다.

```ts
.leftJoin(UserWatchProgress, 'progress',
  'progress.videoId = video.id AND progress.userId = :userId', { userId })
.addSelect('progress.videoId', 'progressVideoId')
```

```ts
watchProgress: progressVideoId === null ? null : {
  positionMs: Number(positionMs),
  isCompleted: Number(isCompleted) === 1,
  lastPlayedAt: lastPlayedAt!.toISOString(),
}
```

### 구현 지시: fixture와 HTTP 검증

- run.mjs는 API-visible 대표 FULL UUID에서 숫자 video.id를 확인한다. paid/free episode.id는 entitlement에 계속 필요하므로 그 키까지 바꾸지 않는다.
- progressPairs의 두 번째 값, trackProgressPair 인자·조회·정리, baseline content 진도 INSERT, 검증 SELECT와 verifyParallel의 SQL을 모두 video_id로 바꾼다. 고정 길이의 pair 검증에 새 프리뷰/영상 fixture가 누락되지 않게 추적 목록을 기준으로 검증한다.
- HTTP로 기록할 소유 쌍은 요청 전에 등록한다. 실패한 요청·부분 준비·부분 정리에서도 소유 키만 정리하고 오류를 전파한다. 사용자·영상 쌍을 다른 실행과 공유하지 않는다.
- watch-progress 컬렉션은 playback 응답의 videoUuid로 PUT한다. 무료·구매·미구매 유료, 입력/UUID/없는 대상, 인증 누락·잘못된 토큰·사용자 위조 무시, STARTED/COMPLETED·중복/동시·UTC·완료 보존과 이전 회차 경로 404를 확인한다.
- content 컬렉션은 그 회차의 대표 FULL에 baseline 기록이 연결되고 익명·타 사용자에는 null인 것을 확인한다. existing episodes[].watchProgress의 정확한 응답 키를 유지한다.
- 기존 shared content suite에서 공개 콘텐츠를 변경하지 않는다. 같은 회차의 다른 FULL·서로 다른 길이·프리뷰 기록/공개 상태 경계는 saved-videos가 이미 소유한 콘텐츠 fixture를 확장해 검증한다. alternate FULL은 대표 영상보다 큰 display_order를 사용한다.
- saved-videos 컬렉션에서 두 FULL을 각각 PUT하고, alternate FULL 완료가 대표 FULL의 상세 watchProgress를 바꾸지 않는지 확인한다. 대표 FULL을 완료하면 상세 표시가 바뀌고, 프리뷰 완료는 본편 완료와 분리되는지 확인한다. 같은 영상의 사용자별 기록도 독립이어야 한다.
- run.mjs는 HTTP 후 실제 DB에서 요청한 소유 user/video 행들의 위치·완료·행 수를 확인한다. 프리뷰 기록을 확인하려고 조회 API를 추가하지 않는다. 숨김/종류 불일치 요청 실패 뒤 새 기록이 없어야 한다.
- saved-videos fixture는 기존 exclusive lock·실행별 drama/episode/video/image 소유권을 유지한다. 추가 progress를 콘텐츠 삭제 전에 정리하고 잔여 행이 없는지 확인한다. 기존 개발 콘텐츠 reset·seed·변경을 하지 않는다.
- 외부 환경 모드는 기존처럼 환경 제공자가 준비/정리를 소유한다. 새로 필요한 실제 영상 UUID·boundary fixture 조건을 README에 명시하고 collection에 자격 증명 값을 넣지 않는다.
- parallel 검증은 두 run의 user/video 쌍 분리, 첫 정리가 둘째 기록을 보존, 양쪽 최종 무잔여, 기존 shared reader/exclusive writer 순서를 계속 검증한다. lock selector나 전체 suite 순서를 바꾸지 않는다.

### 문서 변경

- back/README.md: 별도 DB 리허설은 해당 DB 옵션으로 새 DataSource를 만들고, 초기화 후 SELECT DATABASE()와 driver/options의 database가 모두 같은 별도 DB인지 DDL 전에 확인한다. 기존 DataSource.setOptions의 database 변경만으로 대상 전환을 가정하지 않는다. 실제 스키마와 백업 값이 정확히 이관 결과와 일치하고 신규 migration만 미기록임을 확인한 경우에만 DDL 없는 이력 정합화를 허용한다. 시각 열은 last_played_at/created_at/updated_at 세 개로 정확히 기술한다.
- watch-progress API 문서/목록과 인증 문서: 새 영상 경로·UUID·body·204·400/401/403/404·본편/프리뷰 공개/권한·기존 경로 제거·UTC·중복 처리.
- dramas.md: episodes[].videoUuid의 대표 FULL 기록을 조회하며 다른 FULL·프리뷰는 합산하지 않음.
- ARCHITECTURE.md: playback의 사용자/영상 키와 조회/프론트 경로, fixture의 영상 소유 쌍으로 정정. plan-48 공통 pagination 설명 보존.
- user_watch_progress.md·playback README·ERD·scope.md: video_id 관계·PK·인덱스·영상별 진도와 본편/프리뷰 범위로 정정.
- user_preview_feed_states.md: 피드 복귀 위치와 영상별 시청 기록을 구별한다. 실제 피드 저장 기능을 구현했다고 쓰지 않는다. 프리뷰 자동 전송은 아직 후속 작업임을 명시한다.
- 기존 API 공통 오류 형식이나 재생 응답 타입은 바꾸지 않는다. 문서가 코드·컬렉션과 같은 규칙을 설명하는지 직접 대조한다.

### 완료 조건

- 사용자/영상별 저장, 같은 회차 다중 영상·프리뷰 분리, 대표 FULL 상세 조회와 기존 계약이 검증됨.
- focused unit, selected API, 무인자 전체 API, parallel이 현재 코드와 스키마가 반영된 기존 서버에서 모두 통과함. 연결·데이터·정리 실패를 통과로 처리하지 않음.
- 현재 기록 코드/fixture의 episode_id 참조가 없어지고, 과거 migration·entitlement의 episode_id는 유지됨.
- 실제 DB 이관의 전후 비교 결과와 API/fixture 검증 결과를 각각 기록함.
