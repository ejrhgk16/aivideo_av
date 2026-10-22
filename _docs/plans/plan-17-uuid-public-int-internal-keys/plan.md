# 공개 UUID 유지와 내부 정수 기본키 전환

## 목표

- MySQL/InnoDB에서 UUID `CHAR(36)` 단일 `id` 기본키를 가진 14개 테이블의 기본키를 `INT UNSIGNED AUTO_INCREMENT`로 바꾼다. 기존 값은 `uuid CHAR(36) NOT NULL UNIQUE`에 그대로 보존한다.
- 부모를 참조하는 모든 열과 내부 조인은 새 정수 기본키를 사용한다. `content_images`와 `content_videos`의 다형성 `content_id`도 `content_type`별 부모 정수 키를 담는다. `genres.id SMALLINT`는 유지한다.
- 독립된 UUID가 없는 복합키 테이블 5개와 1:1 테이블 2개는 참조 열을 정수로 바꾸고 기존 기본키의 유일성 의미를 유지한다. 이 행들에는 새 UUID나 자동 증가 열을 추가하지 않는다.
- 공개 API 응답에서 UUID 식별자의 필드명을 `uuid`로 통일하고, 프런트는 이 값을 URL 경로에 전달한다. 장르의 숫자 `id`는 유지한다. URL 경로 형태, 기존 S3 `storage_key`, 업무 데이터와 논리적 관계를 유지한다. 과거 마이그레이션과 `web-prototype/`은 변경하지 않는다.

## 범위와 비목표

- 변경 레이어: TypeORM 마이그레이션·엔티티·시드, 공개 콘텐츠 조회 서비스, 백엔드 단위 테스트, 프런트 API 타입·UUID 소비 코드·테스트, 데이터 모델·API·운영 문서.
- API URL 경로 형태는 유지하되 UUID 식별자의 JSON 필드명은 `id`에서 `uuid`로 변경한다. 신규 인증·결제 기능이나 DB 외래 키 제약은 추가하지 않는다.
- 실제 운영 DB 적용은 이 계획 실행의 범위가 아니다. 적용 전 복원 가능한 백업과 별도 테스트 DB 검증을 요구한다.

## 성공 기준과 검증

1. 복원한 별도 MySQL 8.4 테스트 DB에서 마이그레이션 전후 22개 테이블의 행 수, 기존 UUID, 업무 열 및 `storage_key`가 일치한다. 부모 참조가 정확한 정수 행을 가리키고 미매핑 참조가 0건이다. 유니크·CHECK·조회 인덱스도 보존된다.
2. `DB_SYNCHRONIZE=false`에서 신규 DB의 기존 마이그레이션 연속 적용과 기존 데이터 DB의 전환을 각각 확인한다. MySQL DDL은 중간 실패 시 전체 롤백되지 않으므로, 백업·복원 절차를 먼저 확인한다.
3. 작품·회차·제작사·프리뷰 영상의 공개 UUID는 응답의 `uuid` 필드에 있고, 새 정수 DB `id`는 노출되지 않는다. 프런트는 `uuid` 값을 작품·회차 요청 경로에 넣는다. 기존 공개 UUID로 요청하면 같은 콘텐츠와 저장 키를 얻고, 내부 관계 조회는 정수 키를 사용한다.
4. `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`, `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`가 모두 통과한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 데이터 보존 마이그레이션 | `back/src/common/database/migrations/20261022000000UseNumericPrimaryKeys.ts` | UUID→정수 키 매핑, 스키마·데이터 전환, 참조 검증 및 되돌리기 |
| 2 | 엔티티·시드 | 21개 `back/src/*/entities/*.entity.ts`, `back/src/common/database/seed.ts`, `back/src/common/database/seed/initialData.ts`, 관련 단위 테스트 | UUID 외부 식별자·정수 내부 키 메타데이터와 재실행 가능한 시드 |
| 3 | 공개 조회 서비스 | `back/src/content/publicCatalogService.ts`, `back/src/programming/publicCollectionService.ts`, 관련 단위 테스트 | 공개 `uuid` 응답과 정수 관계 조회·조인 |
| 4 | 데이터 모델 문서 | `_docs/AI_DRAMA_data_model/00-overview/common-rules.md`, 관련 21개 테이블 정의 | 실제 열 타입·PK·UUID 고유성·관계 설명 정합화 |
| 5 | API·운영 문서 | 관련 `_docs/api/` 문서 4개, `back/README.md` | 공개 `uuid` 필드 계약, 내부 조인 설명과 안전한 적용 절차 |
| 6 | 프런트 UUID 소비 | `front/src/features/`, `front/src/screens/`, 관련 `front/tests/unit/` | 응답 `uuid`로 작품·회차를 식별하고 기존 경로로 요청 |

정확한 변경 파일과 실행 가능한 검증 명령은 이 plan의 `index.json` 및 각 task 문서에 선언한다.

## 실행 순서 및 병렬 작업

- `task-1`은 선행 작업 없이 시작한다. 데이터 전환 스키마가 후속 작업의 기준이다.
- `task-2`는 `task-1` 완료 후 실행한다. 엔티티와 시드가 마이그레이션 스키마와 일치해야 한다.
- `task-3`과 `task-4`는 `task-2` 완료 후 병렬 실행 가능하다. 코드·테스트와 데이터 모델 문서의 대상 파일이 겹치지 않는다.
- `task-5`와 `task-6`은 `task-3` 완료 후 병렬 실행 가능하다. API·운영 문서와 프런트 코드·테스트의 대상 파일이 겹치지 않는다. 둘 다 백엔드의 `uuid` 응답 계약에 의존한다.
- `task-4`는 `task-5`·`task-6`과도 대상 파일이 겹치지 않아 병렬 실행 가능하다.
