# 작품 목록 API

## 목적

홈 화면의 최신 작품 목록을 제공한다.

## 인증

불필요

## Endpoint

### GET /dramas

#### Query parameter

| 이름 | 필수 | 허용 값 | 기본값 | 설명 |
| --- | --- | --- | --- | --- |
| `sort` | 아니요 | `latest` | `latest` | 작품 공개일 기준 최신순 정렬 |

`sort`에 `latest` 외 값을 전달하면 `400 Bad Request`를 반환한다.

#### 200 Response

응답 본문은 작품 배열이다.

```json
[
  {
    "id": "00000002-0000-4000-8000-000000000001",
    "slug": "our-last-spring",
    "title": "우리의 마지막 봄",
    "shortDescription": "서로의 비밀을 간직한 두 사람의 봄날 로맨스",
    "productionCompany": "라이트하우스 스튜디오",
    "genres": [
      { "id": 1, "code": "ROMANCE", "name": "로맨스" }
    ],
    "images": {
      "poster": "dramas/our-last-spring/images/poster.webp",
      "hero": "dramas/our-last-spring/images/hero.webp",
      "thumbnail": "dramas/our-last-spring/images/thumbnail.webp"
    },
    "episodeCount": 4,
    "freeEpisodeCount": 1
  }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 작품 식별자 |
| `slug` | string | 공개 URL에 사용할 작품 slug |
| `title` | string | 작품명 |
| `shortDescription` | string | 카드·홈용 짧은 소개 |
| `productionCompany` | string \| null | 제작사명. 연결된 제작사가 없으면 `null` |
| `genres` | array | 연결된 장르의 식별자·코드·이름 |
| `images.poster` | string \| null | 포스터 storage key |
| `images.hero` | string \| null | 히어로 이미지 storage key |
| `images.thumbnail` | string \| null | 썸네일 storage key |
| `episodeCount` | number | 공개된 회차 수 |
| `freeEpisodeCount` | number | 공개 회차 중 `pricePoints = 0`인 회차 수 |

#### 400 Response

```json
{
  "message": "sort must be latest",
  "error": "Bad Request",
  "statusCode": 400
}
```

## 노출 규칙

- 작품은 `PUBLISHED`이고 `published_at`이 현재 시각 이하인 경우에만 반환한다.
- 작품은 `published_at` 내림차순으로 정렬한다.
- 회차 수와 무료 회차 수에는 같은 공개 조건을 만족하는 회차만 포함한다.

## 관련 데이터 모델

- `dramas`
- `production_companies`
- `drama_genres`, `genres`
- `drama_images`
- `episodes`
