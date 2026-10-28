# 회차 재생 API

## 회차 재생 URL

### GET /episodes/:episodeId/playback

공개 회차의 본편 영상 재생 URL을 반환한다.

#### Path parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `episodeId` | 예 | string | 재생할 회차 UUID. 작품 상세 응답의 회차 `uuid` 값 사용 |

#### Query parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `userUuid` | 아니요 | string | 재생을 요청한 사용자 UUID. 생략하면 익명 요청으로 처리 |

#### 인증

현재 이 endpoint는 JWT 인증을 사용하지 않는다. 로그인 API는 JWT를 발급하지만, 여기서 받는 `userUuid`는 검증되지 않은 사용자 식별 값이며 인증 수단이 아니다. 아래 본문은 현재 구현이고, [JWT 전환 예정](#jwt-전환-예정-미구현)은 후속 구현을 위한 설계다.

#### 공개 및 재생 조건

- 요청의 `episodeId` UUID로 회차를 조회한 뒤 내부 숫자 키를 사용해 `episodes.drama_id = dramas.id`로 작품을 조인하고, `content_videos.content_type = 'EPISODE'`, `content_videos.content_id = episodes.id`, `content_videos.kind = 'FULL'`인 영상 행을 조인한다. 이 관계 컬럼은 모두 자동 증가 정수 키 비교다. `content_videos.content_id`는 다형성 참조이므로 대상 종류 조건도 함께 적용한다.
- 작품과 회차가 모두 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하일 때만 URL을 발급한다.
- 해당 회차의 `contentType = EPISODE`, `kind = FULL` 영상 중 `displayOrder`가 가장 낮은 영상을 선택한다.
- 회차 가격이 0이면 익명 요청을 포함해 URL을 제공한다. 유료 회차는 전달된 `userUuid`와 회차 내부 ID가 일치하는 `episode_entitlements` 행이 있어야 한다. 사용자 UUID와 entitlement는 LEFT JOIN으로 조회해 사용자 정보가 없는 익명 요청도 회차 조회에서 제외되지 않게 한다.
- 유효한 UUID 형식의 사용자가 없으면 `404 Not Found`를 반환한다. 공개 회차가 없으면 기존 `404 Not Found`를 반환한다. 유료 회차에 권한이 없으면 익명 요청을 포함해 `403 Forbidden`을 반환한다.
- `userUuid`가 빈 값, 잘못된 UUID, 또는 중복 전달이면 `400 Bad Request`를 반환한다.
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

#### 403 Response

권한이 없는 유료 회차는 S3 URL을 발급하지 않고 아래 오류를 반환한다.

```json
{
  "errorCode": "EPISODE_ACCESS_DENIED",
  "errorName": "EpisodeAccessDenied",
  "statusCode": 403,
  "timestamp": "2026-10-28T00:00:00.000Z",
  "path": "/episodes/00000004-0000-4000-8000-000000000003/playback"
}
```

회차 재생 endpoint의 커스텀 업무 오류는 `{ errorCode, errorName, statusCode, timestamp, path }` 형식이다. 입력 오류와 찾을 수 없는 리소스는 기존 NestJS 기본 오류 형식을 유지한다.

로컬 회차 영상 파일 API `GET /media/videos/episodes/:episodeId`는 제거했다. 프리뷰 영상은 [작품 API 정의](../02-content/dramas.md#프리뷰-재생-api)의 개발용 프리뷰 재생 API를 사용한다.

## JWT 전환 예정 (미구현)

전체 인증 흐름과 회차 재생의 선택적 인증 정책은 [전체 인증 방식](../00-overview/authentication.md#기능-api-전환-예정-미구현)에서 관리한다. 기존 회차 재생 API를 수정해 무료는 익명 허용, 유료는 JWT와 구매 권한을 확인하고, 프리뷰는 기존 공개 API로 유지할 예정이다. 현재 본문의 API 계약과 코드에는 아직 적용되지 않았다.
