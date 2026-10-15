# task-2-콘텐츠-미디어-시드-재생성

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/src/content/entities/contentImage.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`
- `back/src/common/database/seed/initialData.ts`
- `back/src/common/database/seed.ts`
- `back/test/unit/database/initialData.spec.ts`

## 작업

Task 1의 새 Entity property 이름을 사용해 개발 시드를 재생성한다. 기존 `dramaImages`, `episodeVideos` 배열을 `contentImages`, `contentVideos`로 교체하고 seed 실행기가 새 Entity에 upsert하도록 바꾼다.

각 드라마에 `POSTER`, `HOME_HERO`, `DETAIL_COVER`를 만들고, 복수 `CAMPAIGN`을 최소 한 드라마에 넣어 `displayOrder` 정렬을 검증한다. 각 장르에 `GENRE_TILE`, 각 회차에 `EPISODE_COVER`를 만든다. 각 드라마에는 하나 이상의 `PREVIEW`를, 각 회차에는 하나의 `FULL`을 만든다.

단위 테스트는 새 행 수, 콘텐츠 대상 ID의 유효성, 종류별 소유 규칙, 캠페인·프리뷰의 순서, storage key 접두사 및 회차별 본편 하나를 검증한다. 실제 미디어 파일은 만들거나 업로드하지 않는다.

완료 조건: DB 연결 없이 새 시드가 Entity 타입과 새 미디어 규칙을 만족한다.

검증:

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
