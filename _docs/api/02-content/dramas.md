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

## 작품 상세 API

### GET /dramas/:dramaId

#### Path parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `dramaId` | 예 | string | 조회할 작품 식별자 |

#### 인증

불필요

#### 200 Response

응답 본문은 작품 상세 객체다. 공개된 회차는 `episodeNumber` 오름차순으로 반환한다.

```json
{
  "id": "00000002-0000-4000-8000-000000000001",
  "slug": "our-last-spring",
  "title": "우리의 마지막 봄",
  "shortDescription": "서로의 비밀을 간직한 두 사람의 봄날 로맨스",
  "synopsis": "서로 다른 비밀을 품은 두 사람이 마지막 봄에 다시 만난다.",
  "productionCompany": "라이트하우스 스튜디오",
  "genres": [
    { "id": 1, "code": "ROMANCE", "name": "로맨스" }
  ],
  "images": {
    "poster": "dramas/our-last-spring/images/poster.webp",
    "hero": "dramas/our-last-spring/images/hero.webp",
    "thumbnail": "dramas/our-last-spring/images/thumbnail.webp"
  },
  "episodes": [
    {
      "id": "00000002-0000-4000-8000-000000000101",
      "episodeNumber": 1,
      "title": "다시 만난 봄",
      "synopsis": "우연한 재회가 시작된다.",
      "durationMs": 420000,
      "pricePoints": 0
    },
    {
      "id": "00000002-0000-4000-8000-000000000102",
      "episodeNumber": 2,
      "title": "숨겨둔 편지",
      "synopsis": null,
      "durationMs": 435000,
      "pricePoints": 30
    }
  ]
}
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `id` | string | 작품 식별자 |
| `slug` | string | 공개 URL에 사용할 작품 slug |
| `title` | string | 작품명 |
| `shortDescription` | string | 카드·홈용 짧은 소개 |
| `synopsis` | string | 작품 상세 소개 |
| `productionCompany` | string \| null | 제작사명. 연결된 제작사가 없으면 `null` |
| `genres` | array | 연결된 장르의 식별자·코드·이름 |
| `genres[].id` | number | 장르 식별자 |
| `genres[].code` | string | 장르 코드 |
| `genres[].name` | string | 장르명 |
| `images.poster` | string \| null | 포스터 storage key |
| `images.hero` | string \| null | 히어로 이미지 storage key |
| `images.thumbnail` | string \| null | 썸네일 이미지 storage key |
| `episodes` | array | 공개된 회차 목록 |
| `episodes[].id` | string | 회차 식별자 |
| `episodes[].episodeNumber` | number | 회차 번호 |
| `episodes[].title` | string \| null | 회차명 |
| `episodes[].synopsis` | string \| null | 회차 소개 |
| `episodes[].durationMs` | number | 재생 시간(밀리초) |
| `episodes[].pricePoints` | number | 회차 해제에 필요한 포인트. `0`이면 무료이고, `0`보다 크면 해제에 포인트가 필요하다 |

#### 404 Response

작품이 없거나 공개 조건을 만족하지 않으면 반환한다.

```json
{
  "message": "Drama '00000002-0000-4000-8000-000000000001' was not found",
  "error": "Not Found",
  "statusCode": 404
}
```

#### 상세 API 노출 규칙

- 작품은 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하인 경우에만 반환한다.
- 회차는 `status = PUBLISHED`이고 `published_at`이 `null`이 아니며 현재 시각 이하인 경우에만 반환한다.
- 회차는 `episodeNumber` 오름차순으로 정렬한다.
- 이미지 필드는 객체 스토리지 내부 `storageKey`를 반환하며, 접근 가능한 URL이 아니다.
- 이 공개 API는 사용자별 구매·해제 여부를 조회하지 않는다. 따라서 `FREE`, `LOCKED`, `ENTITLED` 접근 상태도 응답에 포함하지 않는다.
- 사용자별 구매·해제 여부와 접근 상태는 인증된 후속 API의 범위로 정의한다.

## 관련 데이터 모델

- `dramas`
- `production_companies`
- `drama_genres`, `genres`
- `drama_images`
- `episodes`
