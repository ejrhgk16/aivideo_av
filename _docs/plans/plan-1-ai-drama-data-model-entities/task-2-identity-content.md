# task-2-identity-content

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`
- `_docs/AI_DRAMA_data_model/01-identity/*.md`
- `_docs/AI_DRAMA_data_model/02-content/*.md`
- `back/src/shared/entities/audited.entity.ts`
- `back/tsconfig.json`

## 작업

문서의 identity와 content 영역을 1개 테이블당 1개 TypeORM Entity로 만든다. 파일명은 Nest 관례에 따라 단수 kebab-case를 사용하고, `@Entity({ name: '<문서 테이블명>' })`에는 문서의 snake_case 테이블명을 그대로 쓴다.

### identity

- `users` → `back/src/identity/entities/user.entity.ts`
- `user_preferences` → `back/src/identity/entities/user-preference.entity.ts`
- `back/src/identity/entities/index.ts`

### content

- `production_companies` → `back/src/content/entities/production-company.entity.ts`
- `dramas` → `back/src/content/entities/drama.entity.ts`
- `genres` → `back/src/content/entities/genre.entity.ts`
- `drama_genres` → `back/src/content/entities/drama-genre.entity.ts`
- `drama_images` → `back/src/content/entities/drama-image.entity.ts`
- `episodes` → `back/src/content/entities/episode.entity.ts`
- `episode_videos` → `back/src/content/entities/episode-video.entity.ts`
- `episode_subtitles` → `back/src/content/entities/episode-subtitle.entity.ts`
- `back/src/content/entities/index.ts`

각 문서의 모든 컬럼과 제약을 빠짐없이 반영한다. UUID PK는 `@PrimaryColumn`, `drama_genres`는 `(drama_id, genre_id)` 복합 PK, 문서에 기재된 상태·종류·형식 값은 `@Check`, 검색·조인용 필드는 `@Index`, `public_slug`, 제작사명, 장르 code/name 등 UNIQUE 항목은 TypeORM unique metadata로 정의한다. 관계는 scalar ID 컬럼으로만 표현한다.

공통 `created_at`, `updated_at`이 있는 테이블은 `task-1`의 `AuditedEntity`를 상속하고, 나머지 시간 열은 문서의 기본값과 nullable 여부를 직접 반영한다. 문서에 없는 인증·개인정보·추가 컬럼은 만들지 않는다.

### 검증 및 완료 조건

- `npm --prefix back run lint`
- 위 10개 테이블이 각각 정확히 하나의 Entity 파일과 연결되고, 각 도메인 `index.ts`가 해당 Entity만 export한다.
