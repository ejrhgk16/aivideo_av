# 회차 재생 API

## 회차 재생 URL

### GET /episodes/:episodeId/playback

공개 회차의 본편 영상 재생 URL을 반환한다.

#### Path parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `episodeId` | 예 | string | 재생할 회차 UUID. 작품 상세 응답의 회차 `uuid` 값 사용 |

#### 인증

불필요

#### 공개 및 재생 조건

- 요청의 `episodeId` UUID로 회차를 조회한 뒤 내부 숫자 키를 사용해 `episodes.drama_id = dramas.id`로 작품을 조인하고, `content_videos.content_type = 'EPISODE'`, `content_videos.content_id = episodes.id`, `content_videos.kind = 'FULL'`인 영상 행을 조인한다. 이 관계 컬럼은 모두 자동 증가 정수 키 비교다. `content_videos.content_id`는 다형성 참조이므로 대상 종류 조건도 함께 적용한다.
- 작품과 회차가 모두 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 URL을 발급한다.
- 해당 회차의 `contentType = EPISODE`, `kind = FULL` 영상 중 `displayOrder`가 가장 낮은 영상을 선택한다.
- 회차 가격이나 사용자별 구매·해제 여부를 확인하지 않는다. 공개 회차라면 가격과 무관하게 URL을 제공한다.
- 영상이나 회차 또는 공개 작품이 없거나 공개 조건을 만족하지 않으면 `404 Not Found`를 반환한다.
- S3 GET 서명 URL은 개발 환경에서만 발급하며 3600초 후 만료된다. 개발 환경 이외에서는 `404 Not Found`를 반환한다.

#### 200 Response

```json
{
  "url": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/...?...",
  "title": "첫 번째 이야기",
  "episodeNumber": 1,
  "durationMs": 420000
}
```

`url`은 선택된 FULL 영상 S3 객체의 절대 서명 URL이며 3600초 후 만료된다.
`title`은 회차명이며, 회차명 데이터가 없으면 `null`이다. `episodeNumber`는 작품 내 회차 번호다.
`durationMs`는 선택된 `FULL` 영상의 재생 시간(밀리초)이다.
`title`과 `episodeNumber`는 `episodes`에서, `durationMs`와 서명에 사용하는 `storage_key`는 조인된 `content_videos` 행에서 가져온다. 작품 공개 여부는 조인된 `dramas` 행에서 확인한다.

로컬 회차 영상 파일 API `GET /media/videos/episodes/:episodeId`는 제거했다. 프리뷰 영상은 [작품 API 정의](../02-content/dramas.md#프리뷰-재생-api)의 개발용 프리뷰 재생 API를 사용한다.
