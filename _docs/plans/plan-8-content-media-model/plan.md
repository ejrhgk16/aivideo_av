# 콘텐츠 이미지·영상 미디어 모델 전환

## 목표

고정 이미지와 반복 캠페인 이미지를 하나의 `content_images` 테이블로 관리하고, 드라마 프리뷰 복수 운영과 회차 본편을 `content_videos` 테이블로 관리한다. 기존 공개 콘텐츠·컬렉션 API가 새 미디어 모델을 일관된 응답으로 반환하게 한다.

## 범위

- `drama_images`, `episode_videos`를 각각 `content_images`, `content_videos`로 교체한다.
- 장르 타일, 회차 커버, 드라마의 고정 이미지와 복수 캠페인 이미지를 `content_images`로 저장한다.
- 드라마의 복수 `PREVIEW`와 회차의 단일 `FULL` 영상을 `content_videos`로 저장한다.
- 개발용 예시 데이터는 이관하지 않고 새 구조에 맞춰 다시 생성한다.
- 기존 공개 API 네 개의 이미지·프리뷰 영상 응답과 API 문서를 새 구조에 맞춘다.

## 비목표

- 실제 이미지·영상 객체를 생성하거나 업로드하지 않는다.
- 프론트엔드의 목업 데이터 또는 API 연결은 변경하지 않는다.
- 새 관리용 콘텐츠 CRUD API나 별도 프리뷰 피드 endpoint를 추가하지 않는다.
- 기존 예시 데이터의 `THUMBNAIL`을 새 데이터로 이관하지 않는다.

## 승인된 데이터 규칙

- `content_images`는 `DRAMA`, `GENRE`, `EPISODE` 콘텐츠를 대상으로 한다.
- 드라마 `POSTER`, `HOME_HERO`, `DETAIL_COVER`는 각각 한 장이며, `CAMPAIGN`은 `displayOrder` 순서로 여러 장일 수 있다.
- 장르 `GENRE_TILE`, 회차 `EPISODE_COVER`는 각각 한 장이다.
- `content_videos`는 `DRAMA`, `EPISODE` 콘텐츠를 대상으로 하며, 드라마 `PREVIEW`는 여러 개, 회차 `FULL`은 한 개다.
- 영상의 대표 이미지는 별도 `content_images` 행으로 관리하며, `content_videos`에는 썸네일 키를 두지 않는다.

## API 계약

- 작품 요약과 상세의 `images`는 `poster`, `homeHero`, `detailCover`, `campaigns`를 사용한다. `campaigns`는 `storageKey` 배열이다.
- 작품 요약과 상세의 `previewVideos`는 `storageKey`, `durationMs`를 가진 정렬된 배열이다.
- 장르 목록은 `tileImage`를 포함한다.
- 작품 상세의 각 회차는 `image`를 포함한다.
- 컬렉션의 작품 요약도 같은 `images`와 `previewVideos` 계약을 사용한다.
- 이전 `hero`, `thumbnail`, 대문자 이미지 키는 제거한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 콘텐츠 미디어 스키마 교체 | Entity, migration, 데이터 모델 문서 | 기존 미디어 테이블을 대체할 Entity·DDL·문서를 정의한다. |
| 2 | 콘텐츠 미디어 시드 재생성 | seed, seed test | 새 미디어 테이블의 예시 데이터를 생성하고 관계·순서를 검증한다. |
| 3 | 콘텐츠 공개 API 미디어 매핑 | content service, API 문서, test | 작품·장르·회차의 새 미디어 응답을 구현한다. |
| 4 | 컬렉션 공개 API 미디어 매핑 | programming service, API 문서, test | 컬렉션 작품 요약의 새 미디어 응답을 구현한다. |

## 실행 순서 및 병렬 작업

- `task-1`은 모든 후속 task의 선행 작업이다. 새 Entity와 테이블 계약이 먼저 확정되어야 한다.
- `task-2`, `task-3`, `task-4`는 `task-1` 완료 후 병렬 실행 가능하다. 서로 다른 seed, content API, programming API 파일만 수정한다.
- 모든 task는 `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`로 검증한다.
