# task-1-episode-playback-single-query

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- back/src/content/public-catalog.service.ts
- back/src/content/entities/episode.entity.ts
- back/src/content/entities/drama.entity.ts
- back/src/content/entities/contentVideo.entity.ts
- back/src/content/local-video.controller.ts
- back/test/unit/content/public-catalog.service.spec.ts
- _docs/api/04-playback/episodes.md
- _docs/AI_DRAMA_data_model/02-content/content_videos.md

## 작업

변경 파일은 _docs/plans/plan-14-episode-playback-single-query/index.json의 task-1.files에 선언된 4개 파일로 한정한다. 모든 파일 수정은 apply_patch로 수행한다.

1. PublicCatalogService의 회차 영상 조회가 episodes, dramas, content_videos를 명시적 조건으로 조인하는 단일 SQL 조회를 사용하도록 바꾼다. 작품과 회차의 공개 상태 및 공개 시각, 영상의 EPISODE/FULL 조건을 쿼리에서 적용한다. display_order 오름차순으로 한 영상을 선택한다.
2. 회차명과 회차 번호는 episodes에서, storage_key와 duration_ms는 선택된 content_videos 행에서 얻는다. 기존 재생 응답과 개발용 파일 제공 메서드는 같은 조회를 사용하며 404 및 개발 환경 제한을 유지한다. 불필요해진 기존 조회와 임포트는 제거한다.
3. 단위 테스트에서 단일 조인 조회 조건, 가장 낮은 display_order 영상의 응답, 공개 조건을 만족하지 않거나 본편 영상이 없는 경우의 404를 확인한다. 기존 테스트의 주변 코드는 불필요하게 바꾸지 않는다.
4. 재생 API 문서에 조회 연결 조건과 응답 필드의 출처를 명시하고 content_videos 데이터 모델 문서에 회차 영상의 다형성 연결과 기본 본편 선택 규칙을 정확히 적는다. API 계약이나 DB 제약이 바뀐 것으로 서술하지 않는다.

검증 명령: npm --prefix back run lint, npm --prefix back run test, npm --prefix back run build.

완료 조건: 개발 환경의 공개 회차 재생 URL과 영상 제공 경로가 한 번의 조인 조회로 기존 값을 반환한다. 없는 또는 비공개 작품·회차, 본편 영상 없음은 404를 유지한다. 세 검증 명령이 모두 통과한다.
