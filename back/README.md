# Backend

NestJS API와 MySQL. 명령은 저장소 루트에서 실행한다. 기준 환경·작업 지침은 [AGENTS.md](../AGENTS.md), 구조는 [아키텍처](../_docs/ARCHITECTURE.md), 요청·응답은 [API 문서](../_docs/api/README.md)를 따른다.

## 환경·실행

```powershell
npm --prefix back ci
npm --prefix back run start:dev
```

개발 API는 `http://localhost:3000`이다. `.env.development`·`.env.production`을 분리하고 공통 `.env`는 사용하지 않는다. 환경 파일·자격 증명은 Git과 로그에 남기지 않는다.

| 설정 | 기준 |
| --- | --- |
| `NODE_ENV` | 실행 전에 지정. 미지정은 `development`. 파일 내부 값만으로 읽을 파일이 선택되지는 않음 |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` | 대상 MySQL 연결 |
| `DB_SYNCHRONIZE` | 로컬 개발만 `true` 허용·기본값. 마이그레이션 리허설·운영은 `false` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `WEB_CORS_ORIGINS` | 운영 값 입력. 키 생성·교체와 쿠키·origin 조건은 [인증 문서](../_docs/api/00-overview/authentication.md) 참고 |
| `AWS_REGION`, `S3_BUCKET` | 이미지 URL·개발 영상 서명 설정 |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | 개발 액세스 키 사용 시 `.env.development`에 설정. SDK 기본 자격 증명 체인 사용 |

운영 실행·마이그레이션 전 PowerShell에서 `$env:NODE_ENV = 'production'`을 설정하고 `.env.production`의 실제 값을 채운다.

이미지는 공개 S3 URL, FULL·PREVIEW 영상과 자막은 비공개다. 영상 서명 URL은 개발 환경에서만 발급하며 1시간 후 만료된다. 재생 권한은 [회차 계약](../_docs/api/04-playback/episodes.md), URL 노출은 [공통 규칙](../_docs/api/00-overview/conventions.md#미디어와-인증)을 따른다.

이미지 키는 `src/content/mediaStorage.ts`로 생성하고 public ACL 없이 업로드한다. 허용 패턴은 `dramas/*/images/*/*.webp`, `dramas/*/episodes/*/images/*.webp`, `genres/*/images/*.webp`다. 로컬 이미지 API는 없다.

DB 저장·비교와 API 전달은 UTC다. 세션 시간대·드라이버·기존 기본값 확인은 [DB 시간 규칙](../_docs/AI_DRAMA_data_model/00-overview/common-rules.md#시간-저장비교-기준)을 따른다.

## Seed·마이그레이션

```powershell
npm --prefix back run db:seed
```

seed는 수동 개발 명령이며 서버 시작·빌드·마이그레이션·API 테스트가 자동 실행하지 않는다. 운영 배포에 포함하지 않는다. 카탈로그는 고정 UUID로 upsert한다. 개발 `admin`(`00000010-0000-4000-8000-000000000001`, `OPERATOR`)·지갑·최초 100포인트는 없을 때만 생성하고 기존 잔액·지급은 보존한다. 지급 원장 키는 `seed:admin:initial-points:v1`이다.

키·관계 변경 전 복원 가능한 백업을 만들고, 별도 복원 DB에서 up·down·up을 리허설한다. 행 수·UUID·관계·미디어 `storage_key` 보존을 비교한 뒤 대상 DB에 적용하고 스키마·애플리케이션을 확인한다. 백업·자격 증명은 저장소 밖에 둔다.

**MySQL DDL은 암묵적으로 커밋된다.** 실패 시 실제 스키마를 조사하고 필요하면 검증된 백업을 복원한다. 부분 적용을 전체 롤백으로 간주하거나 재실행·down이 안전하다고 가정하지 않는다.

```powershell
npm --prefix back run build
npm --prefix back run db:migration:show
npm --prefix back run db:migration:run
npm --prefix back run start:prod
```

### 시청 진행률 키 이관

`ReplaceWatchProgressEpisodeWithVideo20261103000000`: `user_watch_progress`의 `(user_id, episode_id)`를 `(user_id, video_id)`로 변경하며 `video_id`는 `content_videos.id`다.

- 쓰기를 중단하고 실행 중인 백엔드의 `DB_SYNCHRONIZE=false`를 확인한다. 실제 스키마와 이력을 대조하며 synchronize가 이미 바꾼 스키마에 과거 pending 마이그레이션을 자동 실행하지 않는다.
- up은 기존 키·사용자별 최근 재생 인덱스·위치 CHECK를 검사한다. MySQL TypeORM `getTable()`은 CHECK를 노출하지 않아 `information_schema`로 실제 제약을 확인한다. Entity 선언만으로 충분하지 않다.
- 공개 상태와 관계없이 회차의 `display_order`가 가장 낮은 `EPISODE`/`FULL` 영상으로 매핑한다. 회차·영상 누락은 첫 DDL 전에 실패한다.
- 위치·완료 여부·`last_played_at`·`created_at`·`updated_at`과 기존 인덱스·CHECK를 보존한다. `video_id` 인덱스를 추가하며 물리 외래 키는 만들지 않는다. 양방향 리허설에서 사용자별 매핑·행 수·보존 값을 비교한다.
- down은 부모 회차가 있는 `EPISODE`/`FULL`만 허용한다. PREVIEW·누락 참조·사용자별 한 회차의 여러 영상 행은 데이터 손실 때문에 거부한다. DDL 실패 후 열·인덱스·기본 키를 확인한다.
- 리허설 DB 이름으로 새 DataSource를 만들고 DDL 전 `SELECT DATABASE()`, `dataSource.options.database`, `dataSource.driver.database`가 모두 해당 DB인지 확인한다. 초기화된 source의 `setOptions()`만으로 MySQL 연결 대상은 바뀌지 않는다.
- 실제 스키마·백업 값이 이관 결과와 정확히 일치하고 해당 마이그레이션만 이력에 누락됐을 때만 TypeORM fake migration으로 이력을 맞춘다. 변환된 스키마에 DDL을 재실행하지 않는다.

## 검증

```powershell
npm --prefix back run lint
npm --prefix back run test
npm --prefix back run test:unit
npm --prefix back run test:api -- --suite saved-videos
npm --prefix back run test:api -- --suite content --suite playback
npm --prefix back run test:api:parallel
npm --prefix back run build
```

test는 단위 테스트와 전체 HTTP suite를 실행한다. API 테스트는 **현재 코드를 반영한 기존 개발 서버와 같은 MySQL**을 사용한다. Postman CLI가 PATH에 필요하며 로컬 실행에 로그인은 필요 없다. 서버가 없으면 실패로 보고 사용자에게 실행을 안내한다. runner·에이전트는 서버를 자동 시작하거나 포트를 바꾸지 않는다.

Harness의 작업별 검사·최종 전체 검증은 [플랜 규칙](../_docs/plans/README.md#finish-검증)을 따른다.

### API suite

`test:api`에 `--suite`가 없으면 아래 순서대로 전체 실행한다. 중복 선택은 한 번만 실행하며 잘못된 이름·누락 인자·형식은 API/DB 변경 전에 실패한다.

| 순서·suite | 검사 | Content lock |
| --- | --- | --- |
| 1. `http` | 루트·허용/거부 CORS·JWT preflight | shared |
| 2. `identity` | 로그인 검증·Refresh 회전/재사용/동시성/폐기·로그아웃·웹 쿠키/CSRF/익명 | shared |
| 3. `content` | 장르·드라마 목록 필터/페이징·상세·소유권·`userUuid` 위조 | shared |
| 4. `drama-pagination` | 공개 작품 0/30/31 경계·검색/장르·정렬·사용자별 프리뷰 저장 | exclusive |
| 5. `programming` | 홈 컬렉션 4종·정렬·없는 컬렉션 | shared |
| 6. `playback` | 무료/유료/프리뷰·권한·잘못된 인증·미디어 누락·사용자 위조 | shared |
| 7. `economy` | 포인트 지급·멱등성·잔액 부족·구매/재구매 | shared |
| 8. `watch-progress` | 무료/유료 FULL의 영상 UUID 저장·입력·UTC·완료 임계값·기록 보존 | shared |
| 9. `saved-videos` | 저장/해제·0/30/31 페이지·동일 시각·숨김·사용자 격리·FULL/PREVIEW 진행률·응답 flags | exclusive |
| 10. `watch-history` | 본인 STARTED 기록·0/30/31 페이지·동일 시각·숨김/미래/종류 오류 제외·FULL/PREVIEW 분리 | exclusive |
| 11. `point-history` | 본인 원장·0/30/31 페이지·동일 시각·전체 거래 유형·회차 공개·인증/페이지 | exclusive |

- 요청·assertion 원본은 suite별 컬렉션이며 `suites.mjs`가 선택·잠금을 관리한다. 기존 public 컬렉션은 사용하지 않는다. 응답·오류의 정확한 키를 검사하고 `pm.sendRequest` 응답은 collection event가 적용되지 않으므로 직접 assert한다.
- 실행마다 컬렉션·환경을 전용 임시 디렉터리에 복사한다. credentials·JWT는 출력하거나 컬렉션에 저장하지 않는다. 서명 미디어는 URL metadata만 검사하며 다운로드하지 않는다.
- catalog/detail/collection 일관성 검사 중 다른 테스트가 공유 콘텐츠를 바꾸면 안 된다. lock 대기는 완료가 아니며 획득 후 실행한다. 연결·필수 데이터·잠금 획득·timeout·assertion·cleanup 실패는 모두 실패다. 준비/검사 실패는 cleanup도 실패했다고 덮어쓰지 않는다.
- 응답 계약 변경 전후 관련 suite로 성공·업무 오류 shape를 비교한다. 전역 오류 처리 변경은 전체 suite를 실행하고 문서화된 일반 Nest 오류만 공통 body로 전환한다. assertion을 약화하지 않으며 토큰·비밀번호·쿠키·서명 URL을 담은 응답 캡처는 저장하지 않는다.

### 기본 데이터·fixture

managed 모드는 `.env.development`를 읽고 명시적인 비어 있지 않은 `DB_HOST/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_DATABASE`를 요구한다. 코드상 `.env` fallback도 지원한다. DB 초기화·seed는 하지 않는다.

필수 공개 데이터:

- 장르 1개 이상·공개 드라마 2개 이상. 한 드라마에 PREVIEW·무료 회차·FULL이 있는 유료 회차 2개 이상, 구매 검사용 별도 유료 회차까지 총 서로 다른 유료 회차 3개가 필요하다.
- `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`, `HOME_CAMPAIGN`이 모두 활성 상태여야 하며 배열은 비어 있어도 된다. 재생 검사는 개발 S3 서명 설정이 필요하다.
- economy는 별도 유료 회차와 0포인트 사용자를 사용한다. watch-progress는 API에서 찾은 무료 회차·권한 있는 유료 회차를 사용한다.

기본 fixture는 실행별 UUID의 사용자 2명·자격 증명·지갑과 임시 유료 권한이다. identity는 사용자만, http/programming은 사용자·DB fixture 없이 실행한다. 공개 작품·회차·미디어 ID는 API에서 찾으며 기존 사용자·잔액·자격 증명·기록은 변경하지 않는다.

| suite | 추가 fixture·검증 |
| --- | --- |
| `content` | 유료 회차 대표 FULL의 기준 진행률 |
| `drama-pagination` | 실행별 공개 작품 31개와 숨김·미래·미지정 공개 시각 작품, 전용 장르 2개 및 다중 장르 관계, 공개 프리뷰. 같은 공개 시각의 정렬·0/30/31 경계·필터·사용자별 저장 상태를 검사한 뒤 소유 데이터를 제거 |
| `saved-videos` | HOME_FEATURED에 연결한 실행 전용 공개 드라마·복제 이미지·PREVIEW·무료/유료 FULL. 무료 회차의 두 번째 FULL과 PREVIEW 진행률로 영상별 분리를 검증. 저장할 유료 FULL은 미구매인지 사전 확인 |
| `watch-history` | 공개 드라마를 복제해 FULL 31개·PREVIEW·대체/유료 FULL·poster-only/image-less PREVIEW·숨김/미래/종류 오류 데이터 생성. PUT으로 0/30/31 경계를 검사한 뒤 해당 실행 기록만 같은 과거 UTC로 바꿔 두 번째 pass에서 `video_id DESC` 동률 순서·인증/입력 검증 |
| `point-history` | 권한 사용자 31건·경계 사용자 30건·미권한 사용자 빈 원장. 동일/삽입순서와 다른 UTC·5가지 거래 유형·공개/숨김/미래 회차/드라마. 읽기 전후 지갑·원장·권한 snapshot 비교. 기존 공개 드라마의 제작사 ID만 읽기 전용 template으로 사용 |

UUID는 삽입 전에 기록한다. 정리는 소유한 user/video 쌍·콘텐츠만 제거하고 Refresh 이력·권한·저장·진행률·거래·지갑을 정리한 후 사용자를 삭제한다. 숨김 영상 DELETE 성공은 fixture 제거 전에 확인한다.

`test:api:parallel`은 서로 다른 사용자/UUID의 watch-progress 두 실행이 HTTP 기록을 소유하고, 한쪽 정리가 다른 쪽을 보존하며 최종 잔여 데이터가 없는지 검사한다. content reader가 있는 동안 saved-videos writer가 exclusive lock을 기다리고 해제 후 완료하는지도 검사한다.

### 외부 Postman 환경

`API_TEST_ENVIRONMENT_FILE`로 선택한다. runner는 MySQL 연결·fixture 생성/수정/정리를 하지 않으며 Postman 옵션·credentials를 전달한다. 환경의 실제 `baseUrl`(`--env-var baseUrl=...` 포함)에 exclusive lock을 건다. 환경 파일은 Git 밖에 두고 비밀번호를 명령행 인자로 전달하지 않는다. 준비·정리와 실패 후 남은 저장/쓰기 제거는 외부 환경 소유자 책임이다.

공통으로 권한/미권한 사용자 로그인 쌍과 해당 suite의 사용자 UUID를 준비한다. 추가 계약은 다음과 같다.

| suite | 필수 변수·관계 |
| --- | --- |
| `saved-videos` 조회·유료 | `savedLookupEpisodeUuid`, `savedLookupEpisodeVideoUuid`는 무료 회차와 대표 FREE FULL. `savedPaidEpisodeUuid`, `savedPaidVideoUuid`는 유료 회차와 PAID FULL. 두 회차는 `savedOtherUserVideoUuid`가 식별하는 드라마에 속함 |
| `saved-videos` 진행률 | `savedProgressDramaUuid`, `savedProgressEpisodeUuid`, `savedProgressPrimaryVideoUuid`, `savedProgressAlternateVideoUuid`, `savedProgressPreviewVideoUuid`, `savedProgressWrongKindVideoUuid`, `savedHiddenVideoUuid`: 공개 드라마·잠금 해제된 무료 회차·대표/대체 FULL·공개 PREVIEW·DRAMA/FULL 오류·숨김 PREVIEW. 대표 FULL/PREVIEW 60000ms, 대체 FULL 90000ms. 저장 전에 상세 응답으로 UUID·가격 관계 확인 |
| `watch-history` | `entitledUserUuid`, `unentitledUserUuid`, `historyPhase=verify`, `historyDramaUuid`, `historyPreviewVideoUuid`, `historyVideoUuids`, `historyExpectedVideoUuids`, `historyHiddenVideoUuids`, `historyRecentVideoUuid`, `historyNoImageVideoUuid`, `historyPosterOnlyVideoUuid`, `historyPaidVideoUuid`, `historyAlternateVideoUuid` |
| `point-history` | 권한/미권한 로그인·UUID, `pointHistoryBoundaryLoginId`, `pointHistoryBoundaryPassword`, `pointHistoryExpectedItems` 31건, `pointHistoryBoundaryExpectedItems` 30건. 정렬은 `created_at DESC, id DESC`, 각 item의 키는 `uuid/transactionType/amount/balanceAfter/createdAt/episode`만 허용 |
| `drama-pagination` | `catalogAllQuery`, `catalogThirtyQuery`, `catalogEmptyQuery`, `catalogTailQuery`, `catalogLiteralQuery`, `catalogGenreCodeA`, `catalogGenreCodeB`, `catalogGenreName`, `catalogExpectedUuids`, `catalogThirtyExpectedUuids`, `catalogGenreExpectedUuids`, `catalogLiteralExpectedUuids`, `catalogExcludedUuids`, `catalogPreviewVideoUuid`, `catalogPreviewDramaUuid`. 기대 UUID 값은 정렬된 JSON 배열이다. 외부 환경은 fixture를 직접 준비·정리한다 |

watch-history는 사용자·공개 영상·권한 사용자의 유료 FULL 구매·진행률과 제외할 숨김/미래/종류 오류 기록을 미리 준비한다. `historyVideoUuids`는 최초 30개와 나머지를 생성한 순서, `historyExpectedVideoUuids`는 시각 동률 적용 후 전체 기대 순서다. `historyPreviewVideoUuid`는 대표 드라마 이미지 assertion에 쓴다. verify 모드는 준비된 기록을 검사하고 fixture를 생성·정리하지 않는다.

point-history는 세 사용자의 원장과 회차 공개 조건을 미리 준비하며 페이지 경계·소유권·잘못된 JWT/페이지·비공개 내부 필드 누락을 검사한다.
