# task-1-user-saved-videos

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-41-user-saved-videos/plan.md`
- `_docs/plans/plan-41-user-saved-videos/index.json`
- `back/src/playback/entities/userSavedDrama.entity.ts`
- `back/src/playback/entities/index.ts`
- `back/src/common/database/entities.ts`
- `back/src/common/database/databaseConfig.ts`
- `back/src/common/database/dataSource.ts`
- `back/src/common/database/migrations/20261005000000InitAiDrama.ts`
- `back/src/common/database/migrations/20261022000000UseNumericPrimaryKeys.ts`
- `back/src/content/entities/contentVideo.entity.ts`
- `back/test/unit/entities/entities.spec.ts`
- `back/test/api/README.md`
- `_docs/AI_DRAMA_data_model/04-playback/user_saved_dramas.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`

변경 대상 하위에는 추가 AGENTS.md가 없다. 프론트는 작업 범위가 아니다.

## 작업

기존 작품 저장을 영상 저장으로 전환한다. 사용자는 기존 `user_saved_dramas`의 모든 행 삭제를 승인했다. 드라마 저장을 본편이나 프리뷰로 임의 변환하지 않는다.

### 정확한 파일 범위

- 삭제: `back/src/playback/entities/userSavedDrama.entity.ts`
- 추가: `back/src/playback/entities/userSavedVideo.entity.ts`
- 수정: `back/src/playback/entities/index.ts`
- 수정: `back/src/common/database/entities.ts`
- 추가: `back/src/common/database/migrations/20261101000000ReplaceUserSavedDramasWithVideos.ts`
- 수정: `back/test/unit/entities/entities.spec.ts`
- 추가: `back/test/unit/database/userSavedVideosMigration.spec.ts`
- 삭제: `_docs/AI_DRAMA_data_model/04-playback/user_saved_dramas.md`
- 추가: `_docs/AI_DRAMA_data_model/04-playback/user_saved_videos.md`
- 수정: `_docs/AI_DRAMA_data_model/04-playback/README.md`
- 수정: `_docs/AI_DRAMA_data_model/00-overview/README.md`
- 수정: `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- 수정: `_docs/AI_DRAMA_data_model/00-overview/scope.md`

다른 작업자와 사용자도 같은 저장소를 사용할 수 있다. 다른 변경을 되돌리지 말고 현재 변경과 맞추어 작업한다. 수정은 apply_patch로 수행한다. 과거 마이그레이션과 완료 plan은 변경하지 않는다.

### 스키마와 참조

- 테이블 `user_saved_videos`, 엔티티 `UserSavedVideo`.
- `user_id`, `video_id`: INT UNSIGNED NOT NULL, PK `(user_id, video_id)`.
- `content_type`: VARCHAR(16) NOT NULL, CHECK `content_type IN ('EPISODE','PREVIEW')`.
- `saved_at`: 기존 DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) 유지.
- 인덱스 `IDX_user_saved_videos_user_id_saved_at`: `(user_id, saved_at)`. 기존 인덱스와 같은 열 순서다.
- `user_id`는 `users.id`, `video_id`는 언제나 `content_videos.id`다. 기존 프로젝트 규칙대로 실제 FK나 TypeORM 객체 relation은 추가하지 않는다.
- `EPISODE`는 `content_videos.content_type='EPISODE' AND kind='FULL'`, `PREVIEW`는 `content_type='DRAMA' AND kind='PREVIEW'`에 대응한다. 이 교차 테이블 규칙은 문서에 명시하되 API나 쓰기 서비스를 이번에 추가하지 않는다.
- `content_type`은 PK에 넣지 않는다. 같은 사용자와 영상에 타입만 다른 중복 행도 PK로 막는다.
- 새 엔티티를 playback barrel과 공용 엔티티 배열에 등록하고 기존 엔티티 참조를 대체한다. 별도 UUID나 자동 증가 ID를 추가하지 않는다.
- 저장 시각의 기존 기본값은 이번 변경에서 정비하지 않는다. 향후 쓰기 API는 아키텍처의 UTC 저장 규칙에 맞게 명시적으로 시각을 전달해야 함을 문서화한다.

### 주요 로직 코드 또는 변경 예시

엔티티의 핵심 선언은 다음과 같다. 기존 프로젝트 import와 포맷을 따른다.

```ts
import { Check, Column, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity({ name: 'user_saved_videos' })
@Index('IDX_user_saved_videos_user_id_saved_at', ['userId', 'savedAt'])
@Check('CHK_user_saved_videos_content_type', "content_type IN ('EPISODE','PREVIEW')")
export class UserSavedVideo {
  @PrimaryColumn({ name: 'user_id', type: 'int', unsigned: true })
  userId!: number;

  @PrimaryColumn({ name: 'video_id', type: 'int', unsigned: true })
  videoId!: number;

  @Column({ name: 'content_type', type: 'varchar', length: 16 })
  contentType!: 'EPISODE' | 'PREVIEW';

  @Column({
    name: 'saved_at',
    type: 'datetime',
    precision: 3,
    default: () => 'CURRENT_TIMESTAMP(3)',
  })
  savedAt!: Date;
}
```

새 TypeORM 마이그레이션의 핵심 흐름은 다음과 같다. MySQL DDL은 암묵적으로 커밋되므로 사전 확인과 새 테이블 생성을 기존 테이블 삭제보다 먼저 수행한다.

```ts
import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReplaceUserSavedDramasWithVideos20261101000000
  implements MigrationInterface {
  name = 'ReplaceUserSavedDramasWithVideos20261101000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const oldExists = await queryRunner.hasTable('user_saved_dramas');
    const newExists = await queryRunner.hasTable('user_saved_videos');
    if (!oldExists || newExists) {
      throw new Error('Expected user_saved_dramas only; inspect schema before migration.');
    }
    await queryRunner.query(`
      CREATE TABLE user_saved_videos (
        user_id INT UNSIGNED NOT NULL,
        video_id INT UNSIGNED NOT NULL,
        content_type VARCHAR(16) NOT NULL,
        saved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (user_id, video_id),
        INDEX IDX_user_saved_videos_user_id_saved_at (user_id, saved_at),
        CONSTRAINT CHK_user_saved_videos_content_type
          CHECK (content_type IN ('EPISODE','PREVIEW'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.dropTable('user_saved_dramas');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const oldExists = await queryRunner.hasTable('user_saved_dramas');
    const newExists = await queryRunner.hasTable('user_saved_videos');
    if (oldExists || !newExists) {
      throw new Error('Expected user_saved_videos only; inspect schema before rollback.');
    }
    const rows: Array<{ total: number | string }> = await queryRunner.query(
      'SELECT COUNT(*) AS total FROM user_saved_videos',
    );
    if (Number(rows[0].total) !== 0) {
      throw new Error('Cannot restore drama-only schema while saved videos exist.');
    }
    await queryRunner.query(`
      CREATE TABLE user_saved_dramas (
        user_id INT UNSIGNED NOT NULL,
        drama_id INT UNSIGNED NOT NULL,
        saved_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (user_id, drama_id),
        INDEX IDX_user_saved_dramas_user_id_saved_at (user_id, saved_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
    `);
    await queryRunner.dropTable('user_saved_videos');
  }
}
```

위 예시는 실제 up/down 동작이다. 새 영상 저장 데이터 삭제는 승인 범위에 포함시키지 않는다. down은 새 저장이 없을 때만 빈 옛 스키마를 복원하며, up에서 삭제한 기존 저장 행은 복원할 수 없다는 점을 문서에 명시한다. up/down 실행 중 저장 쓰기가 발생하지 않는 상태에서 적용한다. 새 API를 만드는 작업은 아니다.

### 문서 수정

- `user_saved_videos.md`에 컬럼, PK, 타입별 영상 참조, 중복 방지, 인덱스, 저장 시각, FK 미사용과 서비스 검증 책임을 명시한다.
- playback README의 링크와 설명을 저장한 본편·프리뷰 영상으로 바꾼다.
- overview README의 테이블 목록, scope의 관련 화면·조회 인덱스, ERD의 저장 관계를 새 이름으로 바꾼다.
- ERD에는 사용자와 영상 양쪽의 저장 관계를 표현하고 실제 FK가 아닌 논리 관계임을 기존 설명과 일치시킨다.
- 대상 문서에 남아 있는 `user_saved_dramas` 참조를 제거한다. 다른 무관한 구형 명칭이나 문구를 정비하지 않는다.
- 테이블 개수는 기존 24개를 유지한다. 아키텍처의 디렉터리 책임은 바뀌지 않으므로 ARCHITECTURE.md 변경은 없다.

### 검증 명령과 실행 전제

필수 checks:

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

- 기존 `entities.spec.ts`에서 테이블명, 클래스 import, `dramaId` 참조를 바꾸고 새 PK·CHECK·인덱스 검증을 추가한다. 테이블 수는 24개다.
- 새 `userSavedVideosMigration.spec.ts`는 QueryRunner를 모사해 데이터가 있던 옛 테이블도 삭제하는 up 순서, 새 테이블 생성 실패 시 옛 테이블 보존, 잘못된 초기 스키마에서 DDL 미실행, 빈 새 테이블에서 down, 저장이 있는 down의 무변경 실패를 검증한다. 이는 공개 HTTP 경로가 없는 내부 마이그레이션 규칙에 대한 최소 단위 테스트다.
- 실제 DB의 제약 적용을 단위 테스트만으로 검증했다고 보고하지 않는다.
- 실제 적용 전 개발 API가 HTTP로 응답하는지 확인하고, 설정상 synchronize 여부와 마이그레이션 이력을 확인한다. `createDatabaseOptions`는 개발 환경에서 synchronize=true가 기본이므로 새 엔티티가 자동으로 새 테이블을 만들기 전에 적용 순서를 맞춰야 한다. 서버를 자동 종료·재시작하지 않는다. 현재 서버의 자동 동기화 여부나 코드 반영을 확인할 수 없으면 그 실행 조건을 사용자에게 확인한다.
- 실제 DB 적용 명령이 필요하면 먼저 build하고 해당 CLI 프로세스에 `DB_SYNCHRONIZE=false`를 설정한 뒤 `npm --prefix back run db:migration:show`로 이력을 확인한다. 다른 미적용 마이그레이션이 없음을 확인한 경우에만 `npm --prefix back run db:migration:run`으로 이 작업을 적용한다. 환경 파일을 수정하거나 DB 전체를 리셋하지 않는다. 새·옛 테이블이 함께 존재하면 새 테이블을 임의로 삭제하지 말고 원인을 확인한다.
- 실제 적용 후 SELECT와 스키마 조회로 옛 테이블 제거, 새 테이블의 빈 상태, PK·타입 제약·인덱스를 확인한다. 개발 DB에서 down으로 되돌리는 파괴적 검증은 하지 않는다.
- 전체 `test`는 기존 서버 `http://localhost:3000`과 MySQL에 대한 Postman 검증을 포함한다. 코드 반영을 확인하고 기존 서버에서 실행한다. 서버가 없으면 검증 실패로 보고하며 사용자에게 `npm --prefix back run start:dev`를 안내한다. 에이전트가 서버를 실행하거나 다른 포트로 우회하지 않는다.
- 읽기 API 테스트를 위해 DB 리셋·시드를 하지 않는다. 테스트 데이터 조건은 `back/test/api/README.md`를 따른다.

### 완료 조건

- 제품 코드의 활성 엔티티와 레지스트리에서 UserSavedDrama가 UserSavedVideo로 대체된다.
- 저장 대상은 영상 ID로 통일되고 DRAMA 타입은 허용하지 않는다. 기존 저장 테이블 행의 삭제만 승인된 변경으로 구현된다.
- 과거 마이그레이션을 수정하지 않고 새 up/down 경계와 엔티티 제약을 테스트한다.
- 승인된 파일 범위 안에서 데이터 모델 문서와 코드가 일치한다.
- 필수 checks가 통과한다. 실제 DB 적용 여부와 단위 테스트·HTTP 검증 결과를 구분해서 보고한다. 서버 부재나 필수 데이터 부족은 통과로 처리하지 않는다.
