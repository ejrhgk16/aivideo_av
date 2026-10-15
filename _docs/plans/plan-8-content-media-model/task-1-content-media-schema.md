# task-1-콘텐츠-미디어-스키마-교체

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/02-content/README.md`
- `_docs/AI_DRAMA_data_model/00-overview/ERD.md`
- `back/src/content/entities/dramaImage.entity.ts`
- `back/src/content/entities/episodeVideo.entity.ts`
- `back/src/common/database/migrations/20261005000000-initAiDrama.ts`

## 작업

`drama_images`와 `episode_videos`를 각각 `content_images`와 `content_videos`로 교체한다. 최초 migration은 수정하지 않고, 새 migration의 up에서 기존 두 테이블을 삭제한 뒤 새 테이블을 생성한다. down은 새 테이블을 삭제하고 기존 테이블 정의를 복원해 되돌릴 수 있게 한다. 기존 예시 데이터는 이관하지 않는다.

`content_images` Entity는 `contentType`, `contentId`, `kind`, `storageKey`, nullable `altText`, `displayOrder`, 감사 시각을 가진다. `contentType`은 `DRAMA`, `GENRE`, `EPISODE`만 허용하고, `kind`는 `POSTER`, `HOME_HERO`, `DETAIL_COVER`, `CAMPAIGN`, `GENRE_TILE`, `EPISODE_COVER`만 허용한다. `(content_type, content_id, kind, display_order)` 유니크와 `(content_type, content_id)` 인덱스를 둔다.

`content_videos` Entity는 `contentType`, `contentId`, `kind`, `storageKey`, `durationMs`, `displayOrder`, 감사 시각을 가진다. `contentType`은 `DRAMA`, `EPISODE`만, `kind`는 `FULL`, `PREVIEW`만 허용하며, `duration_ms > 0`, `display_order > 0`, `(content_type, content_id, kind, display_order)` 유니크와 `(content_type, content_id)` 인덱스를 둔다. 영상의 대표 이미지는 `content_images`에서 관리하므로 영상별 썸네일 키는 두지 않는다.

`dramaImage.entity.ts`, `episodeVideo.entity.ts`와 대응 데이터 모델 문서는 제거하고 새 Entity·문서를 등록한다. ERD와 content README는 새 테이블이 장르·드라마·회차를 다형적으로 참조한다는 점을 반영한다. Entity registry 단위 테스트는 문서화된 정확한 22개 테이블과 새 Entity를 검증한다.

완료 조건: Entity registry, migration의 up/down, 데이터 모델 문서가 같은 테이블·컬럼·제약을 표현한다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
