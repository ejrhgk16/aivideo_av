# 회차 재생 API

## 회차 재생 URL

### GET /episodes/:episodeId/playback

공개 회차의 본편 영상 재생 URL을 반환한다.

#### Path parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `episodeId` | 예 | string | 재생할 회차 식별자 |

#### 인증

불필요

#### 공개 및 재생 조건

- 작품과 회차가 모두 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 URL을 발급한다.
- 해당 회차의 `contentType = EPISODE`, `kind = FULL` 영상 중 `displayOrder`가 가장 낮은 영상을 선택한다.
- 회차 가격이나 사용자별 구매·해제 여부를 확인하지 않는다. 공개 회차라면 가격과 무관하게 URL을 제공한다.
- 영상이나 회차 또는 공개 작품이 없거나 공개 조건을 만족하지 않으면 `404 Not Found`를 반환한다.
- 현재 로컬 URL은 개발 환경에서만 발급한다. 개발 환경 이외에서는 `404 Not Found`를 반환한다.

#### 200 Response

```json
{
  "url": "/media/videos/episodes/00000002-0000-4000-8000-000000000101",
  "title": "첫 번째 이야기",
  "episodeNumber": 1,
  "durationMs": 420000
}
```

`url`은 API 서버 기준 경로이며, 향후 서명 URL로 교체될 수 있다.
`title`은 회차명이며, 회차명 데이터가 없으면 `null`이다. `episodeNumber`는 작품 내 회차 번호다.
`durationMs`는 선택된 `FULL` 영상의 재생 시간(밀리초)이다.

## 개발용 회차 영상 파일 API

### GET /media/videos/episodes/:episodeId

개발 환경에서 공개 작품·회차의 선택된 본편 영상을 `MEDIA_STORAGE_ROOT`에서 제공한다. 성공 응답은 `Content-Type: video/mp4`와 MP4 바이너리이며 JSON을 반환하지 않는다. 루트 밖의 경로, 누락된 파일, 디렉터리 및 개발 환경 이외의 요청은 `404 Not Found`를 반환한다. 영상 제공 시에도 작품과 회차의 공개 조건을 다시 확인한다.
