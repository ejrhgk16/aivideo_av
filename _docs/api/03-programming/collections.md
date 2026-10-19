# 콘텐츠 컬렉션 API

## 목적

운영자가 정한 홈 추천과 편집 랭킹의 작품 편성·노출 순서를 제공한다. 현재 홈은 `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY` 코드를 사용한다.

## 인증

불필요

## Endpoint

### GET /collections/:code

#### Path parameter

| 이름 | 타입 | 설명 |
| --- | --- | --- |
| `code` | string | 컬렉션 코드. 예: `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY` |

#### 200 Response

```json
{
  "code": "HOME_FEATURED",
  "title": "오늘의 추천",
  "description": "지금 만나보세요",
  "dramas": [
    {
      "displayOrder": 1,
      "id": "00000002-0000-4000-8000-000000000001",
      "slug": "our-last-spring",
      "title": "우리의 마지막 봄",
      "shortDescription": "서로의 비밀을 간직한 두 사람의 봄날 로맨스",
      "productionCompany": {
        "id": "00000001-0000-4000-8000-000000000001",
        "name": "라이트하우스 스튜디오"
      },
      "genres": [
        { "id": 1, "code": "ROMANCE", "name": "로맨스" }
      ],
      "images": {
        "poster": "dramas/our-last-spring/images/poster.webp",
        "homeHero": "dramas/our-last-spring/images/home-hero.webp",
        "detailCover": "dramas/our-last-spring/images/detail-cover.webp",
        "campaigns": [
          "dramas/our-last-spring/images/campaign-1.webp",
          "dramas/our-last-spring/images/campaign-2.webp"
        ]
      },
      "imageUrls": {
        "poster": "/media/images/dramas/00000002-0000-4000-8000-000000000001/images/poster/image-1.webp",
        "homeHero": "/media/images/dramas/00000002-0000-4000-8000-000000000001/images/home-hero/image-1.webp",
        "detailCover": null,
        "campaigns": []
      },
      "previewVideos": [
        {
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
| `dramas[].id`, `slug`, `title`, `shortDescription` | string | 작품 기본 정보 |
| `dramas[].productionCompany` | object \| null | 제작사 식별자와 이름 |
| `dramas[].genres` | array | 연결된 장르 목록 |
| `dramas[].images.poster` | string \| null | 포스터 storage key |
| `dramas[].images.homeHero` | string \| null | 홈 히어로 이미지 storage key |
| `dramas[].images.detailCover` | string \| null | 상세 커버 이미지 storage key |
| `dramas[].images.campaigns` | string[] | 캠페인 이미지 storage key 목록. `display_order` 오름차순 |
| `dramas[].imageUrls.poster` | string \| null | 개발 환경에서 사용할 이미지 URL 경로. 해당 이미지가 없거나 개발 환경이 아니면 `null` |
| `dramas[].imageUrls.homeHero` | string \| null | 홈 히어로 이미지 URL 경로 |
| `dramas[].imageUrls.detailCover` | string \| null | 상세 커버 이미지 URL 경로 |
| `dramas[].imageUrls.campaigns` | string[] | 캠페인 이미지 URL 경로. `display_order` 오름차순 |
| `dramas[].previewVideos` | array | 작품 프리뷰 영상 목록. `display_order` 오름차순 |
| `dramas[].previewVideos[].storageKey` | string | 프리뷰 영상 storage key |
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
- `images`의 storage key는 유지하고, `imageUrls`에는 개발 환경에서 API 서버 기준 `/media/images/` URL 경로를 반환한다. 운영 환경에는 로컬 파일 URL을 반환하지 않으며 향후 signed URL을 사용한다.

## 관련 데이터 모델

- `content_collections`
- `collection_dramas`
- `dramas`, `production_companies`
- `drama_genres`, `genres`
- `content_images` (`content_type = 'DRAMA'`)
- `content_videos` (`content_type = 'DRAMA'`, `kind = 'PREVIEW'`)
- `episodes`
