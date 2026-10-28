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
    "uuid": "00000002-0000-4000-8000-000000000001",
    "slug": "our-last-spring",
    "title": "우리의 마지막 봄",
    "shortDescription": "서로의 비밀을 간직한 두 사람의 봄날 로맨스",
    "productionCompany": "라이트하우스 스튜디오",
    "genres": [
      { "id": 1, "code": "ROMANCE", "name": "로맨스" }
    ],
  "imageUrls": {
    "poster": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/poster/image-1.webp",
    "posterLandscape": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/poster-landscape/image-1.webp",
    "homeHero": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/home-hero/image-1.webp",
    "detailCover": null,
    "campaigns": []
  },
  "previewVideos": [
    {
      "uuid": "00000002-0000-4000-8000-000000000201",
      "storageKey": "dramas/our-last-spring/videos/preview-1.mp4",
      "durationMs": 30000
    }
  ],
    "episodeCount": 4,
    "freeEpisodeCount": 1
  }
]
```

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `uuid` | string | 작품 공개 식별자. 작품 상세 경로의 `dramaId`에 사용 |
| `slug` | string | 공개 URL에 사용할 작품 slug |
| `title` | string | 작품명 |
| `shortDescription` | string | 카드·홈용 짧은 소개 |
| `productionCompany` | string \| null | 제작사명. 연결된 제작사가 없으면 `null` |
| `genres` | array | 연결된 장르의 식별자·코드·이름 |
| `imageUrls.poster` | string \| null | 포스터의 공개 S3 URL. 이미지가 없거나 버킷 설정이 없으면 `null` |
| `imageUrls.posterLandscape` | string \| null | 가로 포스터의 공개 S3 URL |
| `imageUrls.homeHero` | string \| null | 홈 히어로의 공개 S3 URL |
| `imageUrls.detailCover` | string \| null | 상세 커버의 공개 S3 URL |
| `imageUrls.campaigns` | string[] | 캠페인 공개 S3 URL. `displayOrder` 오름차순 |
| `previewVideos` | array | 작품 프리뷰 영상. `displayOrder` 오름차순 |
| `previewVideos[].storageKey` | string | 프리뷰 영상 storage key |
| `previewVideos[].uuid` | string | 프리뷰 영상 공개 식별자. 프리뷰 재생 API의 `videoId`로 사용 |
| `previewVideos[].durationMs` | number | 프리뷰 영상 재생 시간(밀리초) |
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
| `dramaId` | 예 | string | 조회할 작품 UUID. 작품 목록의 `uuid` 값 사용 |

#### Query parameter

없음. 기존 `userUuid` query는 무시하며 사용자를 선택하지 않는다.

#### 인증

선택적 JWT 인증. `Authorization` 헤더가 없으면 익명이며, 있으면 유효한 Access JWT가 필요하다. 빈 값·잘못된 스킴·만료·변조·Refresh token은 `AUTH_INVALID_TOKEN`(401)이다.

#### 200 Response

응답 본문은 작품 상세 객체다. 공개된 회차는 DB에서 `episodeNumber` 오름차순으로 반환한다. Access가 있으면 토큰 사용자 본인의 회차 권한과 시청기록만 포함한다.

```json
{
  "uuid": "00000002-0000-4000-8000-000000000001",
  "slug": "our-last-spring",
  "title": "우리의 마지막 봄",
  "shortDescription": "서로의 비밀을 간직한 두 사람의 봄날 로맨스",
  "synopsis": "서로 다른 비밀을 품은 두 사람이 마지막 봄에 다시 만난다.",
  "productionCompany": "라이트하우스 스튜디오",
  "genres": [
    { "id": 1, "code": "ROMANCE", "name": "로맨스" }
  ],
    "imageUrls": {
      "poster": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/poster/image-1.webp",
      "posterLandscape": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/poster-landscape/image-1.webp",
      "homeHero": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/dramas/00000002-0000-4000-8000-000000000001/images/home-hero/image-1.webp",
      "detailCover": null,
      "campaigns": []
    },
    "previewVideos": [
      {
        "uuid": "00000002-0000-4000-8000-000000000201",
        "storageKey": "dramas/our-last-spring/videos/preview-1.mp4",
        "durationMs": 30000
      }
    ],
  "episodes": [
    {
      "uuid": "00000002-0000-4000-8000-000000000101",
      "episodeNumber": 1,
      "title": "다시 만난 봄",
      "synopsis": "우연한 재회가 시작된다.",
      "durationMs": 420000,
      "pricePoints": 0,
      "image": "dramas/our-last-spring/episodes/episode-1.webp",
      "isUnlocked": true,
      "watchProgress": null
    },
    {
      "uuid": "00000002-0000-4000-8000-000000000102",
      "episodeNumber": 2,
      "title": "숨겨둔 편지",
      "synopsis": null,
      "durationMs": 435000,
      "pricePoints": 30,
      "image": null,
      "isUnlocked": false,
      "watchProgress": {
        "positionMs": 12000,
        "isCompleted": false,
        "lastPlayedAt": "2026-10-08T12:34:56.789Z"
      }
    }
  ]
}
```

익명 요청이거나 기록이 없으면 `null`이다. `positionMs`가 `0`이거나 `isCompleted`가 `false`여도 기록이 존재하면 객체를 반환한다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `uuid` | string | 작품 공개 식별자 |
| `slug` | string | 공개 URL에 사용할 작품 slug |
| `title` | string | 작품명 |
| `shortDescription` | string | 카드·홈용 짧은 소개 |
| `synopsis` | string | 작품 상세 소개 |
| `productionCompany` | string \| null | 제작사명. 연결된 제작사가 없으면 `null` |
| `genres` | array | 연결된 장르의 식별자·코드·이름 |
| `genres[].id` | number | 장르 식별자 |
| `genres[].code` | string | 장르 코드 |
| `genres[].name` | string | 장르명 |
| `imageUrls.poster` | string \| null | 포스터의 공개 S3 URL. 이미지가 없거나 버킷 설정이 없으면 `null` |
| `imageUrls.posterLandscape` | string \| null | 가로 포스터의 공개 S3 URL |
| `imageUrls.homeHero` | string \| null | 홈 히어로의 공개 S3 URL |
| `imageUrls.detailCover` | string \| null | 상세 커버의 공개 S3 URL |
| `imageUrls.campaigns` | string[] | 캠페인 공개 S3 URL. `displayOrder` 오름차순 |
| `previewVideos` | array | 작품 프리뷰 영상. `displayOrder` 오름차순 |
| `previewVideos[].storageKey` | string | 프리뷰 영상 storage key |
| `previewVideos[].uuid` | string | 프리뷰 영상 공개 식별자. 프리뷰 재생 API의 `videoId`로 사용 |
| `previewVideos[].durationMs` | number | 프리뷰 영상 재생 시간(밀리초) |
| `episodes` | array | 공개된 회차 목록 |
| `episodes[].uuid` | string | 회차 공개 식별자. 회차 재생 API 경로의 `episodeId`에 사용 |
| `episodes[].episodeNumber` | number | 회차 번호 |
| `episodes[].title` | string \| null | 회차명 |
| `episodes[].synopsis` | string \| null | 회차 소개 |
| `episodes[].durationMs` | number | 재생 시간(밀리초) |
| `episodes[].pricePoints` | number | 회차 해제에 필요한 포인트. `0`이면 무료이고, `0`보다 크면 해제에 포인트가 필요하다 |
| `episodes[].image` | string \| null | 회차 커버 이미지 storage key |
| `episodes[].isUnlocked` | boolean | 무료 회차이거나 인증된 사용자가 권한을 보유하면 `true`. 익명은 무료 회차만 `true` |
| `episodes[].watchProgress` | object \| null | 인증된 사용자의 시청기록. 익명 요청 또는 기록이 없으면 `null` |
| `episodes[].watchProgress.positionMs` | number | 마지막 재생 위치(밀리초) |
| `episodes[].watchProgress.isCompleted` | boolean | 회차 완주 여부 |
| `episodes[].watchProgress.lastPlayedAt` | string | 마지막 재생 시각(UTC ISO 8601) |

작품 상세의 `userUuid` query는 인증 입력이 아니며 결과의 사용자 선택에도 사용되지 않는다.

#### 401 Response

Authorization 헤더가 있지만 Access JWT가 비어 있거나 잘못됐거나 만료됐거나 Refresh token인 경우 반환한다. 응답은 `{ errorCode, errorName, statusCode, timestamp, path }` 형식이다.

```json
{
  "errorCode": "AUTH_INVALID_TOKEN",
  "errorName": "InvalidToken",
  "statusCode": 401,
  "timestamp": "2026-10-29T00:00:00.000Z",
  "path": "/dramas/00000002-0000-4000-8000-000000000001"
}
```

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
- 회차의 공개 조건과 `episodeNumber` 오름차순은 DB 조회에서 처리한다.
- 회차 권한은 검증된 Access 사용자와 `episode_entitlements`를 회차 조회에 `LEFT JOIN`해서 표시한다. 사용자 조건은 JOIN에 있어 미보유 회차도 목록에 남는다. 권한 취득 종류에 따른 구분은 없다.
- 익명 요청은 사용자 권한 행을 조회하지 않으며 무료 회차만 `isUnlocked: true`다.
- 시청기록은 검증된 Access 사용자와 `user_watch_progress`를 회차 조회에 `LEFT JOIN`해서 표시한다. 기록이 없는 회차도 목록에 남고, 다른 사용자의 기록은 노출되지 않는다.
- 익명 요청이거나 시청기록이 없으면 `watchProgress`는 `null`이다. 시청기록은 회차 수, 공개 조건, 정렬, `isUnlocked`에 영향을 주지 않는다.
- `imageUrls`에는 버킷과 리전 설정이 있을 때 공개 이미지의 직접 S3 URL을 제공한다. 이미지가 없으면 `null` 또는 빈 배열이다. 공개 URL은 `dramas/*/images/*/*.webp`, `dramas/*/episodes/*/images/*.webp`, `genres/*/images/*.webp` 키에만 허용한다.
- 사용자별 구매·해제 여부는 재생 API 접근을 제한하지 않는다. 재생 API의 공개 규칙은 별도 정의를 따른다.

## 프리뷰 재생 API

### GET /dramas/:dramaId/previews/:videoId/playback

개발 환경에서 공개 작품에 속한 `content_type = DRAMA`, `kind = PREVIEW` 영상의 S3 객체에 대해 3600초 유효한 서명 GET URL을 반환한다. 작품 또는 프리뷰가 없거나 공개 조건을 만족하지 않으면, 또는 개발 환경이 아니면 `404 Not Found`를 반환한다. 인증과 구매 여부는 확인하지 않는다.

성공 응답은 `{ "url": "https://...", "durationMs": 30000 }`이며 URL은 S3의 절대 서명 URL이다. 경로의 `dramaId`는 작품 UUID, `videoId`는 작품 목록·상세 응답의 `previewVideos[].uuid`에서 전달한다.

## 관련 데이터 모델

- `dramas`
- `production_companies`
- `drama_genres`, `genres`
- `content_images`
- `content_videos`
- `episodes`
