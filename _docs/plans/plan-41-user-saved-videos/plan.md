# plan-41-user-saved-videos

## 목표

사용자 저장 대상을 영상으로 한정한다. `user_saved_dramas`를 `user_saved_videos`로 전환하고 `EPISODE` 본편과 `PREVIEW` 미리보기를 모두 `content_videos.id`로 참조한다.

## 승인된 범위와 결정

- 사용자는 범위와 단일 task 구성을 승인했으며, 기존 저장 행을 모두 삭제해도 된다고 명시했다.
- 테이블명은 `user_saved_videos`, 엔티티명은 `UserSavedVideo`다.
- `user_id`, `video_id`는 INT UNSIGNED이고 PK는 `(user_id, video_id)`다. 같은 영상을 다른 타입으로 중복 저장할 수 없다.
- `content_type`은 VARCHAR(16) NOT NULL이며 `EPISODE`, `PREVIEW`만 허용한다. `DRAMA` 저장은 지원하지 않는다.
- `video_id`는 두 타입 모두 `content_videos.id`다. `EPISODE`는 회차 FULL, `PREVIEW`는 드라마 PREVIEW를 뜻한다.
- `saved_at`은 기존 DATETIME(3) 열 정의와 기본값을 유지한다. 기존 사용자별 최신 저장 조회 인덱스는 새 테이블명으로 유지한다.
- 마이그레이션은 빈 새 테이블을 만들고 기존 저장 테이블을 제거한다. 기존 저장을 임의 영상으로 변환하지 않는다. 사용자·작품·영상 등 다른 데이터는 삭제하지 않는다.
- 과거 마이그레이션은 수정하지 않고 새 마이그레이션을 추가한다.
- 대상 영상과 타입의 일치 검증은 향후 저장 API의 책임이다. 이번에는 엔티티·스키마·내부 검증·데이터 모델 문서만 변경한다.

## 비목표

- 저장·해제·목록 REST API, 프론트 화면과 API 연결 추가.
- `content_videos` 구조, 영상 업로드·삭제·교체 기능 변경.
- 다른 DB 테이블 초기화, 개발 DB 전체 리셋, 읽기 API 테스트를 위한 시드 재작성.
- 프로젝트 전체 시각 기본값 정비, 무관한 문서 오류나 과거 완료 plan 변경.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 사용자 저장 영상 모델 전환 | 아래 정확한 파일 목록 참조 | 테이블·엔티티명 변경, 영상 ID·타입·PK 정의, 기존 저장 삭제 마이그레이션, 내부 테스트와 데이터 모델 문서 동기화 |

정확한 변경 파일:

1. `back/src/playback/entities/userSavedDrama.entity.ts` (삭제)
2. `back/src/playback/entities/userSavedVideo.entity.ts` (추가)
3. `back/src/playback/entities/index.ts`
4. `back/src/common/database/entities.ts`
5. `back/src/common/database/migrations/20261101000000ReplaceUserSavedDramasWithVideos.ts` (추가)
6. `back/test/unit/entities/entities.spec.ts`
7. `back/test/unit/database/userSavedVideosMigration.spec.ts` (추가)
8. `_docs/AI_DRAMA_data_model/04-playback/user_saved_dramas.md` (삭제)
9. `_docs/AI_DRAMA_data_model/04-playback/user_saved_videos.md` (추가)
10. `_docs/AI_DRAMA_data_model/04-playback/README.md`
11. `_docs/AI_DRAMA_data_model/00-overview/README.md`
12. `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
13. `_docs/AI_DRAMA_data_model/00-overview/scope.md`

## 실행 순서 및 병렬 작업

- `task-1`의 `depends_on`은 `[]`다. 선행 task는 없다.
- 단일 task이므로 병렬 실행할 다른 task가 없다. 엔티티, 마이그레이션, 테스트, 문서를 하나의 변경으로 일치시킨다.
- 실행은 기존 `dev`에서 하고 새 branch나 worktree는 만들지 않는다.

## 검증

- 엔티티 테스트: 새 테이블 등록, 영상 정수 키, 타입 CHECK, 복합 PK와 저장일 인덱스 확인.
- 마이그레이션 단위 테스트: 새 스키마 생성과 기존 저장 테이블 제거 순서, 잘못된 초기 상태에서 무변경 실패, 빈 테이블 롤백, 영상 저장이 있는 롤백 거절을 확인한다. DB DDL은 QueryRunner 경계에서 검증하며 실제 MySQL 적용 검증과 구분한다.
- 실제 개발 DB에 적용할 때 자동 synchronize와 충돌하지 않도록 작업 지시의 사전 확인을 따른다. 기존 저장 행만 삭제하도록 범위를 제한한다.
- 필수 checks는 `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`다.
- `test`는 기존 단위 테스트와 실제 HTTP Postman 검증을 포함한다. 기존 `http://localhost:3000` 서버와 실제 개발 MySQL을 사용한다. 서버가 없으면 실패 처리하고 `npm --prefix back run start:dev`를 안내한다. 에이전트는 서버를 자동 실행하거나 다른 포트를 사용하지 않는다.
- REST 계약을 변경하지 않으므로 API 문서와 Postman 컬렉션 수정은 없다.

## 검증 결과

- 계획 생성 단계다. 제품 코드 수정, 실제 DB 삭제·마이그레이션, 제품 테스트는 아직 수행하지 않았다.
