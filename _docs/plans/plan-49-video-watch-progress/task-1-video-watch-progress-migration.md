# task-1-video-watch-progress-migration

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/README.md`
- `back/src/common/database/databaseConfig.ts`
- `back/src/common/database/dataSource.ts`
- `back/src/common/database/migrations/20261022000000UseNumericPrimaryKeys.ts`
- `back/src/common/database/migrations/20261101000000ReplaceUserSavedDramasWithVideos.ts`
- `back/src/playback/entities/userWatchProgress.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`
- `back/test/unit/database/userSavedVideosMigration.spec.ts`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`

## 작업

신규 migration과 down, 데이터 보존 검증 및 적용 절차를 작성한다. 이 task에서는 Entity·API를 변경하지 않는다.

### 수정 허용 파일

- `back/src/common/database/migrations/20261103000000ReplaceWatchProgressEpisodeWithVideo.ts`
- `back/test/unit/database/videoWatchProgressMigration.spec.ts`
- `back/README.md`

### 의존성과 검증 명령

- `depends_on`: `[]`

```text
npm --prefix back run test:unit -- test/unit/database/videoWatchProgressMigration.spec.ts
npm --prefix back run build
```


### 실행 전제

plan-48-common-pagination의 실행·검증이 끝난 뒤 시작한다. dev에서만 작업하고 다른 plan 상태나 편집을 바꾸지 않는다. build 출력 back/dist/를 다른 build/DB/API 검증과 겹쳐 생성하지 않는다.

### 구현 지시

- 신규 클래스명은 ReplaceWatchProgressEpisodeWithVideo20261103000000을 사용한다. 기존 migration은 수정하지 않는다.
- up 전에 테이블·열·PK가 기존 user_id/episode_id 상태인지 확인한다. 이미 전환됐거나 혼합 상태면 DDL 없이 실패한다.
- 공개 여부와 관계없이 회차 EPISODE/FULL의 최소 display_order 영상으로 매핑한다. 영상·회차가 없는 행은 DDL 전에 탐지한다.
- video_id는 INT UNSIGNED NOT NULL이고 PK는 (user_id, video_id)다. 사용자/최근 재생 인덱스와 위치 CHECK를 보존하며 video_id 인덱스를 추가한다. 물리 FK는 추가하지 않는다.
- position_ms, is_completed, last_played_at, created_at, updated_at을 재계산하지 않는다. 영상 길이에 맞춰 위치를 자르지 않는다.
- down은 모든 기록이 존재하는 EPISODE/FULL과 회차로 역매핑되고 사용자/회차별 한 행일 때만 허용한다. 프리뷰·삭제/잘못된 영상·같은 사용자/회차의 다중 기록은 DDL 전에 거부한다.
- 테스트는 빈 테이블, 대표 영상 매핑·진도/시각 보존, 예상 밖 스키마와 미매핑 행의 DDL 전 거부, 안전한 down·손실 위험 down 거부, PK·인덱스·CHECK를 검증한다. SQL 문자열 비교에만 의존하지 말고 순서·보존 값·거부 시 무변경을 확인한다.
- README에 mapping, 사전 상태, backfill/PK 교체, rollback 한계, MySQL DDL 부분 적용 복구를 기록한다.
- 실제 DB 전환 전에는 DB_SYNCHRONIZE=false가 기존 서버에 적용된 상태와 쓰기 중지를 확인하고, 백업 복원 및 별도 MySQL DB의 up/down/up 리허설을 완료한다. 이 조건을 task-2 Entity 반영 전에 인계한다. 서버 자동 시작·재시작은 하지 않는다.
- migration 이력과 실제 스키마를 비교하고 과거 pending migration을 무조건 실행하지 않는다. reset·seed를 하지 않는다. 백업 파일·시크릿은 저장소 밖에서 관리한다.
- 이 task의 명령은 migration 코드 검증이다. 실제 DB 리허설·적용 여부를 별도로 기록하고 단위 통과만으로 실DB 이관 완료를 주장하지 않는다.

### 주요 로직 코드 또는 변경 예시

up의 주요 흐름은 아래와 같다. 실제 migration에는 이 코드 앞의 예상 스키마 검사와 완전한 down도 구현한다.

```ts
const [{ missing }] = await queryRunner.query(`
  SELECT COUNT(*) AS missing
  FROM user_watch_progress progress
  LEFT JOIN episodes episode ON episode.id = progress.episode_id
  LEFT JOIN content_videos video
    ON video.content_type = 'EPISODE'
    AND video.content_id = episode.id AND video.kind = 'FULL'
    AND video.display_order = (
      SELECT MIN(candidate.display_order) FROM content_videos candidate
      WHERE candidate.content_type = 'EPISODE'
        AND candidate.content_id = episode.id AND candidate.kind = 'FULL'
    )
  WHERE episode.id IS NULL OR video.id IS NULL
`);
if (Number(missing) !== 0) {
  throw new Error('Cannot map every watch-progress row to a FULL video.');
}
await queryRunner.query(`
  ALTER TABLE user_watch_progress
  ADD COLUMN video_id INT UNSIGNED NULL AFTER user_id
`);
await queryRunner.query(`
  UPDATE user_watch_progress progress
  INNER JOIN content_videos video
    ON video.content_type = 'EPISODE'
    AND video.content_id = progress.episode_id AND video.kind = 'FULL'
    AND video.display_order = (
      SELECT MIN(candidate.display_order) FROM content_videos candidate
      WHERE candidate.content_type = 'EPISODE'
        AND candidate.content_id = progress.episode_id AND candidate.kind = 'FULL'
    )
  SET progress.video_id = video.id
`);
await queryRunner.query(`
  ALTER TABLE user_watch_progress
    DROP PRIMARY KEY,
    DROP COLUMN episode_id,
    MODIFY COLUMN video_id INT UNSIGNED NOT NULL,
    ADD PRIMARY KEY (user_id, video_id),
    ADD INDEX idx_user_watch_progress_video_id (video_id)
`);
```

down은 예상 스키마·참조 영상과 회차의 존재·영상 종류를 검사하고, 아래 중복 역매핑도 DDL 전에 거부한다.

```sql
SELECT progress.user_id, video.content_id
FROM user_watch_progress progress
INNER JOIN content_videos video ON video.id = progress.video_id
GROUP BY progress.user_id, video.content_id
HAVING COUNT(*) > 1;
```

안전한 down은 nullable episode_id 추가 → video.content_id backfill → user_id/episode_id PK 복원 → video_id 인덱스/열 제거 순서다. 진도와 모든 시각을 보존하며, 전체 preflight 이후에만 DDL을 시작한다.

### 완료 조건

- 신규 migration up/down과 사전 실패 규칙의 focused 테스트 및 build 통과.
- 기존 migration·Entity·제품 API·개발 데이터 변경 없음.
- README가 실제 mapping·복구·적용 제약과 일치하고, 실DB 리허설/운영자 전제의 확인 상태를 task-2에 인계함.
