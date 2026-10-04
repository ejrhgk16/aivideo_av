# AI DRAMA TypeORM Entity 구조

## 목표

`_docs/AI_DRAMA_data_model/`의 22개 테이블 문서를 기준으로 NestJS 백엔드의 TypeORM Entity를 도메인별 폴더에 생성한다. Entity는 문서의 컬럼명, MySQL 타입, 기본값, PK, UNIQUE, CHECK, 인덱스를 반영하고, 이후 DB 연결 설정에서 재사용할 수 있도록 하나의 registry로 export한다.

## 범위와 비목표

- 범위: `identity`, `content`, `programming`, `playback`, `economy` 5개 도메인의 Entity 22개, 도메인별 barrel, 전체 Entity registry, 메타데이터 단위 테스트, 아키텍처 문서 갱신.
- 비목표: `TypeOrmModule.forRoot` 연결 설정, 환경변수 추가, migration 생성·실행, seed, repository/service/controller/API 구현.
- 문서의 외래 키 비사용 원칙에 따라 Entity에도 `@ManyToOne`, `@OneToMany`, `@JoinColumn`을 추가하지 않고 관계 ID 컬럼과 인덱스만 정의한다.
- UUID는 애플리케이션에서 생성하므로 `@PrimaryGeneratedColumn` 대신 `@PrimaryColumn`을 사용한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | entity-conventions | `back/src/shared/entities/audited.entity.ts` | 공통 생성·수정 시각 Entity 기반 정의 |
| 2 | identity-content | identity 3개, content 9개 Entity 파일 | 사용자·콘텐츠 도메인 Entity와 도메인 barrel 생성 |
| 3 | programming-playback | programming 3개, playback 4개 Entity 파일 | 편성·재생 도메인 Entity와 도메인 barrel 생성 |
| 4 | economy | economy 8개 Entity 파일 | 포인트·결제·광고 보상 도메인 Entity와 도메인 barrel 생성 |
| 5 | registry-test-docs | `back/src/shared/database/entities.ts`, `back/test/unit/entities/entities.spec.ts`, `_docs/ARCHITECTURE.md` | 22개 registry, 메타데이터 테스트, 새 폴더 책임 문서화 |
| 6 | esm-import-paths | programming/playback Entity 5개 파일 | NodeNext ESM 상대 import에 `.js` 확장자 추가 |
| 7 | class-named-entity-files | Entity 23개와 도메인 barrel 5개 파일 | Entity 파일명을 클래스명 PascalCase로 통일하고 import 경로 갱신 |
| 8 | lower-camel-entity-files | Entity 23개와 도메인 barrel 5개 파일 | Entity 파일명의 첫 글자를 소문자로 통일하고 import 경로 갱신 |

## 실행 순서 및 병렬 작업

- `task-1`을 먼저 실행한다. 나머지 도메인 Entity가 공통 `AuditedEntity`를 import한다.
- `task-2`, `task-3`, `task-4`는 `task-1` 완료 후 서로 병렬 실행 가능하다. 파일 목록이 겹치지 않는다.
- `task-6`은 `task-2`, `task-3`, `task-4` 완료 후 실행한다. NodeNext의 ESM module resolution에 맞게 programming/playback의 상대 import 경로를 보정한다.
- `task-5`는 `task-6` 완료 후 실행한다. 전체 registry와 22개 Entity 메타데이터 테스트가 모든 도메인 파일과 빌드 가능한 import 경로를 필요로 한다.
- `task-7`은 `task-5`, `task-6` 완료 후 실행한다. Entity 파일명과 NodeNext ESM 상대 import 경로를 함께 바꾼 뒤 전체 검증을 다시 수행한다.
- `task-8`은 `task-7` 완료 후 실행한다. PascalCase 파일명의 첫 글자를 소문자로 바꾸고 전체 검증을 다시 수행한다.

## 검증 결과

계획 생성 시점에는 제품 코드가 변경되지 않았으므로 실행 검증은 아직 수행하지 않는다. 실행 완료 조건은 `task-5`의 lint, unit test, build가 모두 통과하는 것이다.
