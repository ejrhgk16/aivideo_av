# 시청기록 조회 API

## GET /me/watch-history?page=1

로그인 사용자의 공개 본편·미리보기 시청기록을 최근 시청순으로 조회한다. 시청 시작 기록도 포함하며, 완료 여부나 재생 위치로 필터링하지 않는다.

### 인증

Access JWT가 필수다. Refresh JWT는 사용할 수 없다. 사용자 식별자는 검증된 JWT subject에서 가져오며 query의 `userUuid`는 무시한다. 인증 오류는 `AUTH_INVALID_TOKEN`(401)이고 응답은 `{ errorCode, errorName, statusCode, timestamp, path }` 형식이다.

### Query parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `page` | 아니요 | string | 1부터 시작하는 페이지. 생략하면 1이며 페이지 크기는 30개로 고정한다. |

`page`는 단일 값으로 `[1-9][0-9]*` 형식의 양의 안전 정수만 허용한다. offset과 lookahead 조회 범위 `(page - 1) * 30 + 31`도 안전 정수 범위여야 한다. 빈 값, 0·음수·소수, 문자, 선행 0, 부호, 공백, 지수 표기, 안전 정수 범위를 벗어난 값 및 중복 `page` 값은 400 오류다. `limit`은 지원하지 않는다.

### 공개 및 사용자 범위

조회 대상은 JWT 사용자와 `user_watch_progress.video_id`가 연결된 영상이다. `position_ms = 0`인 `STARTED`도 반환한다. 한 사용자·영상 조합은 한 항목이며, 서로 다른 FULL 영상과 PREVIEW는 각자 별도 항목이다.

현재 `DRAMA`/`PREVIEW`와 `EPISODE`/`FULL` 조합만 반환한다. 작품과 본편 회차는 `status = PUBLISHED`이고 `published_at`이 현재 UTC 시각 이하일 때 노출한다. 비공개 또는 미래 공개 기록은 시청기록에서만 제외하며 기존 시청기록 행을 삭제하지 않는다. 구매 권한은 목록 노출 조건이 아니다. 이 조회는 지갑·구매 권한·기록을 변경하거나 재생 URL을 만들지 않는다.

필터 적용 후 `last_played_at DESC`, 같은 시각이면 `video_id DESC`로 정렬하고 offset/lookahead 페이지 조회를 수행한다. 다른 페이지를 읽는 사이 시청 시각이나 공개 상태가 바뀌면 항목이 이동하거나 빠질 수 있다.

### 성공 응답

```json
{
  "items": [
    {
      "videoUuid": "a1b2c3d4-0000-4000-8000-000000000001",
      "contentType": "PREVIEW",
      "lastPlayedAt": "2026-11-01T00:00:00.000Z",
      "dramaUuid": "00000002-0000-4000-8000-000000000001",
      "dramaTitle": "우리의 마지막 봄",
      "imageUrl": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/...",
      "durationMs": 60000,
      "episodeUuid": null,
      "episodeNumber": null,
      "episodeTitle": null
    }
  ],
  "page": 1,
  "hasNext": false
}
```

응답 필드는 `videoUuid`, `contentType`, `lastPlayedAt`, `dramaUuid`, `dramaTitle`, `imageUrl`, `durationMs`, `episodeUuid`, `episodeNumber`, `episodeTitle`다. `contentType`은 `PREVIEW` 또는 `EPISODE`다. PREVIEW의 회차 세 필드는 `null`; EPISODE는 회차 UUID·번호와 nullable 제목을 반환한다. `lastPlayedAt`은 ISO 8601 UTC(`Z`) 문자열이다. `imageUrl`은 작품의 `POSTER_LANDSCAPE`를 우선하고 없으면 `POSTER`를 사용한다. 둘 다 없거나 공개 URL 설정이 없으면 `null`이다. `durationMs`는 기록한 영상 자체의 길이다.

페이지가 비면 `items`는 빈 배열이고 `hasNext`는 false다. 내부 숫자 ID, 재생 URL, `savedAt`, 재생 위치, 완료 여부와 타인의 기록은 반환하지 않는다.

### 오류

| HTTP | 조건 |
| --- | --- |
| 400 `HTTP_BAD_REQUEST` | `page` 값이 누락 규칙 외의 잘못된 형식이거나 안전한 페이지 범위를 벗어남 |
| 401 `AUTH_INVALID_TOKEN` | Access JWT 누락 또는 유효하지 않음 |

업무 오류는 기존 업무 코드·이름·상태를 유지하고, 일반 HTTP 오류는 `{ errorCode, errorName, statusCode, timestamp, path }` 공통 형식이다.
