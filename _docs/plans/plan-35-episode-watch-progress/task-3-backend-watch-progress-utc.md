# task-3-backend-watch-progress-utc

## 읽어야 할 파일

- `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `_docs/plans/plan-35-episode-watch-progress/plan.md`
- `back/src/common/database/databaseConfig.ts`
- `back/src/playback/watchProgressService.ts`, `back/src/playback/entities/userWatchProgress.entity.ts`
- `back/src/content/entities/episode.entity.ts`, `back/src/content/entities/drama.entity.ts`
- `back/src/content/publicCatalogService.ts`
- `back/test/api/README.md`, `back/test/api/public.postman_collection.json`
- `_docs/api/04-playback/watch-progress.md`

## 작업 범위

담당 파일은 다음 4개뿐이다. 다른 작업자의 변경을 되돌리지 않고 기존 스타일을 따른다. 파일 수정은 `apply_patch`만 사용한다.

```text
back/src/playback/watchProgressService.ts
back/test/api/public.postman_collection.json
back/test/api/README.md
_docs/api/04-playback/watch-progress.md
```

현재 SQL은 MySQL 세션 시간대의 `CURRENT_TIMESTAMP(3)`을 사용한다. 반면 드라이버는 `timezone: 'Z'`로 DATETIME을 해석한다. 세션 시간대가 UTC가 아니어도 공개 시점 비교와 시청 시각 저장이 UTC 기준으로 일치하도록 수정한다. 현재 DB가 특정 시간대라고 가정하지 않는다.

## 구현

### 조회는 TypeORM QueryBuilder로 전환

`WatchProgressService.save`의 회차·작품·FULL 영상·사용자·구매권 조회는 직접 SELECT SQL을 제거하고 TypeORM QueryBuilder로 작성한다. 기존 `PublicCatalogService`의 QueryBuilder 사용 방식과 실제 엔티티 위치를 확인해 따른다. 기존 DataSource의 `createQueryBuilder()` 또는 `getRepository()`를 활용하며 이 변경만을 위해 모듈 DI 구성을 늘리지 않는다.

조회 결과의 내부 사용자/회차 ID, 가격, 영상 길이, 구매권 ID를 보존한다. JWT 사용자 UUID와 회차 UUID는 named parameter로 바인딩한다. 작품·회차의 공개 상태와 공개 시점 조건, FULL 영상 선택, `display_order ASC`의 첫 영상, 무료/구매 여부 판정을 그대로 유지한다. 구매권은 LEFT JOIN을 유지하고 공개·사용자·영상 필수 조건을 느슨하게 바꾸지 않는다.

공개 시점 조건은 QueryBuilder에서도 다음처럼 DB UTC를 사용한다.

```ts
.andWhere('episode.publishedAt <= UTC_TIMESTAMP(3)')
.andWhere('drama.publishedAt <= UTC_TIMESTAMP(3)')
```

실제 별칭·속성명과 join 방식은 기존 엔티티에 맞춘다. 공개 회차 필터를 조회 후 애플리케이션에서 처리하지 않는다.

### 저장은 단일 원자적 upsert 유지, 시간은 UTC로 통일

저장은 기존 `dataSource.query()`의 단일 `INSERT ... ON DUPLICATE KEY UPDATE`를 유지한다. 이번 변경은 조회를 QueryBuilder로 전환하는 것이며 저장까지 Repository `save()`로 대체하는 것은 아니다. 기존 upsert는 동시 요청에서 한 행 유지, 완료 true 유지, 늦은 STARTED의 완료 위치 보존을 보장해야 한다. `findOne()` 후 INSERT/UPDATE 또는 `save()`로 나누지 않는다.

조회와 저장의 다음 시간 표현식을 모두 `UTC_TIMESTAMP(3)`으로 통일한다.

- 작품과 회차의 `published_at` 비교 2곳.
- 신규 행의 `last_played_at`, `created_at`, `updated_at` 3곳.
- 기존 행의 `last_played_at`, `updated_at` 2곳.

```sql
AND drama.published_at <= UTC_TIMESTAMP(3)
AND episode.published_at <= UTC_TIMESTAMP(3)

VALUES (?, ?, ?, ?, UTC_TIMESTAMP(3), UTC_TIMESTAMP(3), UTC_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE
  position_ms = IF(VALUES(is_completed) = 1, VALUES(position_ms), position_ms),
  is_completed = GREATEST(is_completed, VALUES(is_completed)),
  last_played_at = UTC_TIMESTAMP(3),
  updated_at = UTC_TIMESTAMP(3)
```

시간은 계속 DB에서 구한다. 기존 원자적 upsert, 시작 시 위치 보존, 완료 상태 유지, 권한·입력 검증은 보존한다. 드라이버 설정이나 DB 전역/세션 시간대는 바꾸지 않는다. 마이그레이션·기존 행의 시간 보정·프론트 수정·다른 도메인의 시간 처리 정비는 하지 않는다.

API 문서에 공개 시점 비교와 시청기록 시각은 DB UTC 기준이며 응답 시각은 UTC ISO 문자열이라는 점을 명시한다. endpoint 경로·요청·응답 형식은 유지한다.

## 검증

기존 Postman 시청기록 쓰기 시나리오를 보강한다. 전용 fixture의 STARTED와 COMPLETED PUT 직전 클라이언트 시각을 기록하고, 직후 GET 작품 상세의 `lastPlayedAt`을 파싱해 요청 시작 시각부터 조회 완료 시각 사이에 있는지 확인한다. 로컬 서버와 실행 기기의 작은 시계 차이를 위한 허용 오차는 양끝 각 5초로 한정한다. 단순히 문자열이 Z로 끝나는지 검사하는 것으로 대체하지 않는다. 최초 저장과 갱신 양쪽을 검증하고 기존 인증·임계값·완료 유지·동시 요청 테스트를 보존한다.

README에 검증 범위와 전제(로컬 기기/DB 시계 동기화, 기존 쓰기 전용 fixture 준비)를 기록한다. 기존 개발 서버와 실제 MySQL에서 전체 테스트를 수행한다. UTC 세션에서 성공한 HTTP 테스트만으로 비UTC 세션의 회귀 재현까지 검증했다고 주장하지 않는다. 별도 읽기 전용 DB 연결에서 세션 시간대를 `+09:00`으로 지정해 `CURRENT_TIMESTAMP(3)`과 `UTC_TIMESTAMP(3)`의 차이를 확인할 수 있으나, 앱의 연결 풀이나 전역 설정을 변경하지 않는다. 이 진단은 실제 API 동작 검증을 대체하지 않는다.

```text
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run build
```

`back/test/api/README.md`의 로그인 환경 변수·전용 progress fixture 준비 절차를 따른다. 기존 읽기 fixture를 변경하지 않고 테스트가 소유한 기록만 정리한다. 임시 로그인 설정을 사용하면 종료 시 복구한다. 비밀 값은 출력하거나 커밋하지 않는다.

검증 전 기존 `http://localhost:3000`에 HTTP로 연결하고 현재 코드 반영 여부를 확인한다. 서버가 없으면 검증을 실패로 기록하고 `npm --prefix back run start:dev`를 안내한다. 서버 자동 실행·다른 포트 우회는 금지한다. 필수 데이터 부족도 실패이며 생략을 통과로 처리하지 않는다.

## 완료 조건

- 서비스의 공개 시점 비교와 모든 명시적 기록 시각이 `UTC_TIMESTAMP(3)`을 사용한다.
- DB 시간 기준을 유지하면서 기존 UTC 드라이버 설정과 일치한다.
- 회차·공개·권한 조회는 TypeORM QueryBuilder를 사용하고, 직접 SQL은 단일 원자적 upsert에만 남는다.
- 중복·동시 STARTED/COMPLETED 요청 후 한 행 및 완료 위치·상태 보존을 기존 실제 HTTP 테스트로 검증한다.
- 신규·갱신 시각 HTTP 검증과 전체 백엔드 checks가 통과하고 문서가 실제 동작과 일치한다.
- 기존 데이터·DB 설정·프론트 동작은 변경하지 않는다. 범위 밖 수정이 필요하면 보고한다.
