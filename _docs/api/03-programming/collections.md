# 콘텐츠 컬렉션 API

## 목적

운영자가 정한 홈 추천과 편집 랭킹의 작품 편성·노출 순서를 제공한다. 현재 홈은 `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`, `HOME_CAMPAIGN` 코드를 사용한다.

## 인증

불필요

## Endpoint

### GET /collections/:code

#### Path parameter

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| `code` | string | 컬렉션 코드. 예: `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`, `HOME_CAMPAIGN` |

#### 200 Response

```json
{
  "code": "HOME_CAMPAIGN",
  "title": "로맨스 만나기",
  "description": "퇴근길을 채울 로맨스 한 편",
  "dramas": [
    {
      "displayOrder": 1,
      "uuid": "00000002-0000-4000-8000-000000000001",
      "slug": "our-last-spring",
      "title": "우리의 마지막 봄",
      "shortDescription": "서로의 비밀을 간직한 두 사람의 봄날 로맨스",
      "productionCompany": {
        "uuid": "00000001-0000-4000-8000-000000000001",
        "name": "라이트하우스 스튜디오"
      },
      "genres": [
        { "id": 1, "code": "ROMANCE", "name": "로맨스" }
      ],
      "imageUrls": {
        "poster": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/poster/image-1.webp",
        "posterLandscape": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/poster-landscape/image-1.webp",
        "homeHero": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/home-hero/image-1.webp",
        "detailCover": null,
        "campaigns": [
          "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/campaign/image-1.webp",
          "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/campaign/image-2.webp"
        ]
      },
      "previewVideos": [
        {
          "uuid": "00000002-0000-4000-8000-000000000201",
          "storageKey": "dramas/our-last-spring/videos/preview-1.mp4",
          "durationMs": 30000
        }
      ],
      "publishedEpisodeCount": 4,
      "freeEpisodeCount": 1
    }
  ]
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `code` | string | 컬렉션 코드 |
| `title` | string | 컬렉션 제목 |
| `description` | string \| null | 컬렉션 설명 |
| `dramas[].displayOrder` | number | 컬렉션 안의 노출 순서 |
| `dramas[].uuid`, `slug`, `title`, `shortDescription` | string | 작품 기본 정보. `uuid`는 작품 상세 경로의 `dramaId`에 사용 |
| `dramas[].productionCompany` | object \| null | 제작사의 공개 UUID와 이름 |
| `dramas[].genres` | array | 연결된 장르 목록 |
| `dramas[].imageUrls.poster` | string \| null | 포스터 공개 S3 URL. 이미지가 없거나 버킷 설정이 없으면 `null` |
| `dramas[].imageUrls.posterLandscape` | string \| null | 가로 포스터 공개 S3 URL |
| `dramas[].imageUrls.homeHero` | string \| null | 홈 히어로 공개 S3 URL |
| `dramas[].imageUrls.detailCover` | string \| null | 상세 커버 공개 S3 URL |
| `dramas[].imageUrls.campaigns` | string[] | 캠페인 공개 S3 URL. `display_order` 오름차순 |
| `dramas[].previewVideos` | array | 작품 프리뷰 영상 목록. `display_order` 오름차순 |
| `dramas[].previewVideos[].storageKey` | string | 프리뷰 영상 storage key |
| `dramas[].previewVideos[].uuid` | string | 프리뷰 영상 공개 식별자. 프리뷰 재생 API의 `videoId`로 사용 |
| `dramas[].previewVideos[].durationMs` | number | 프리뷰 영상 재생 시간(ms) |
| `dramas[].publishedEpisodeCount` | number | 공개된 회차 수 |
| `dramas[].freeEpisodeCount` | number | 공개 회차 중 무료 회차 수 |

#### 404 Response

존재하지 않거나 비활성인 컬렉션은 `404 Not Found`를 반환한다.

```json
{
  "message": "Content collection 'UNKNOWN' was not found",
  "error": "Not Found",
  "statusCode": 404
}
```

## 노출 규칙

- 컬렉션은 `is_active = true`여야 한다.
- 컬렉션 항목은 `starts_at`이 없거나 현재 시각 이하이고, `ends_at`이 없거나 현재 시각보다 이후여야 한다.
- 연결된 작품과 회차는 `PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 노출한다.
- 작품은 `display_order` 오름차순으로 반환한다.
- `HOME_CAMPAIGN`은 홈 캠페인 배너에 사용할 작품과 `campaigns` 이미지 목록을 반환한다.
- `imageUrls`에는 공개 S3 URL을 반환한다. 공개 읽기는 `dramas/*/images/*/*.webp`, `dramas/*/episodes/*/images/*.webp`, `genres/*/images/*.webp` 키에만 허용한다. 응답에는 자동 증가 숫자 `id`를 노출하지 않는다. `previewVideos`에는 재생 API 경로에 전달할 영상 `uuid`, 저장소 `storageKey`, 재생 시간 `durationMs`를 반환한다. 숫자 `id`는 내부 관계와 조인에 사용하고 장르 응답의 숫자 `id`는 유지한다.

`POSTER_LANDSCAPE` 이미지 키는 `poster-landscape` 디렉터리에서 제공한다.

## 관련 데이터 모델

- `content_collections`
- `collection_dramas`
- `dramas`, `production_companies`
- `drama_genres`, `genres`
- `content_images` (`content_type = 'DRAMA'`)
- `content_videos` (`content_type = 'DRAMA'`, `kind = 'PREVIEW'`)
- `episodes`
