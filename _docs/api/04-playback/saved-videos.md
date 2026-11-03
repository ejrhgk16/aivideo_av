# 저장 영상

로그인 사용자가 본편 또는 드라마 미리보기 영상을 보관함에 저장·해제하고, 저장 시각 기준 페이지로 조회한다. 모든 endpoint는 필수 Access JWT를 요구하며 사용자는 검증된 토큰에서 정한다.

## 영상 저장

`PUT /me/saved-videos/{videoUuid}`

헤더: `Authorization: Bearer <accessToken>`, `Content-Type: application/json`

```json
{ "contentType": "EPISODE" }
```

`contentType`은 필수이며 `EPISODE` 또는 `PREVIEW`다. 서버가 종류를 추측하거나 대소문자를 보정하지 않는다. `EPISODE`는 공개된 작품의 공개 회차에 속하는 `FULL` 영상, `PREVIEW`는 공개된 작품의 `PREVIEW` 영상이어야 한다. 작품과 회차는 `PUBLISHED`이고 `published_at`이 현재 UTC 시각 이하인 경우에만 저장할 수 있다. 미구매 유료 본편도 저장할 수 있지만 재생 권한은 부여하지 않는다.

성공은 `204 No Content`다. 같은 사용자와 영상의 반복 또는 동시 저장은 한 항목으로 처리하고 최초 `savedAt`과 종류를 유지한다. 서버는 UTC 현재 시각을 저장한다.

## 저장 영상 조회

`GET /me/saved-videos?page=1`

헤더: `Authorization: Bearer <accessToken>`

`page`는 선택 query 문자열이며 생략하면 1이다. 단일 값으로 `[1-9][0-9]*` 형식의 양의 안전 정수만 허용한다. 페이지 크기는 30개로 고정하고 `limit`은 사용하지 않는다. offset과 lookahead 조회 범위 `(page - 1) * 30 + 31`도 안전 정수 범위여야 한다. 빈 문자열, 0·음수·소수, 문자, 선행 0, 부호, 앞뒤 공백, 지수 표기, 안전 정수 범위를 벗어난 값과 중복 `page` 값은 400 오류다. 현재 공개 상태, 종류, 토큰 사용자 조건을 데이터베이스 조회에 적용한 다음 `saved_at DESC`, 같은 시각이면 `video_id DESC`로 정렬한다. 저장 행은 공개 조건이 바뀌어도 삭제되지 않으며 현재 조회 결과에서만 제외된다.

```json
{
  "items": [
    {
      "videoUuid": "a1b2c3d4-0000-4000-8000-000000000001",
      "contentType": "PREVIEW",
      "savedAt": "2026-11-01T00:00:00.000Z",
      "dramaUuid": "00000002-0000-4000-8000-000000000001",
      "dramaTitle": "우리의 마지막 봄",
      "imageUrl": "https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/...",
      "durationMs": 30000,
      "episodeUuid": null,
      "episodeNumber": null,
      "episodeTitle": null
    }
  ],
  "page": 1,
  "hasNext": false
}
```

`EPISODE` 항목은 `episodeUuid`, `episodeNumber`, `episodeTitle`에 회차 정보를 반환한다. `PREVIEW` 항목에서는 세 필드가 `null`이다. `imageUrl`은 영상 종류와 관계없이 작품의 `POSTER_LANDSCAPE`를 우선 사용하고, 없으면 `POSTER`를 사용한다. 두 이미지가 없거나 공개 URL 설정이 없으면 `null`이다. `durationMs`는 저장한 영상 자체의 재생 길이를 밀리초로 반환한다.

빈 페이지의 `items`는 빈 배열이다. 내부 숫자 ID, 재생 URL, 다른 사용자의 저장 항목은 반환하지 않는다. 목록은 재생 권한을 평가하지 않는다. 다른 페이지를 읽는 사이 저장·공개 상태가 바뀌면 항목이 이동하거나 빠질 수 있다.

## 저장 해제

`DELETE /me/saved-videos/{videoUuid}`

헤더: `Authorization: Bearer <accessToken>`

요청 body는 없다. 성공은 body 없는 `204 No Content`다. JWT 사용자와 영상 UUID에 해당하는 본인 저장 행만 삭제한다. 반복 요청, 본인이 저장하지 않은 영상, 존재하지 않는 유효한 UUID도 `204`를 반환한다. 존재 여부와 타인 저장을 구별하지 않는다.

PREVIEW와 EPISODE 모두 같은 경로로 해제한다. 공개·구매 상태를 검사하지 않으므로 저장 후 비공개가 된 영상도 해제할 수 있다. 영상·작품·회차 원본이나 타인의 저장은 삭제하지 않는다.

## 오류

모든 오류는 `{ "errorCode", "errorName", "statusCode", "timestamp", "path" }`의 공통 형식이다. 업무 오류 코드는 기존 값을 유지하고, 입력 오류는 `HTTP_BAD_REQUEST`(400), 대상이 없거나 공개되지 않은 경우는 `HTTP_NOT_FOUND`(404)를 사용한다.

| HTTP | 조건 |
| --- | --- |
| 400 | PUT의 잘못된 UUID/body/contentType, GET의 잘못된 page, DELETE의 잘못된 UUID |
| 401 `AUTH_INVALID_TOKEN` | Access JWT 누락·변조·만료·Refresh 제출 또는 활성 사용자가 아님 |
| 404 | PUT 대상 영상이 없거나 종류가 맞지 않거나 작품/회차가 현재 공개되지 않음 |

DELETE는 저장 대상의 유무와 관계없이 유효한 UUID에 `204`를 반환하므로 404를 반환하지 않는다.

요청에 `userUuid`를 넣어도 사용자 선택에 사용되지 않는다. 저장·해제·목록의 대상은 Access JWT 사용자뿐이다. DB 오류는 인증·미발견 응답으로 숨기지 않고 서버 오류로 처리한다.
