# 시청기록 저장 API

## PUT /me/episodes/:episodeUuid/watch-progress

로그인 사용자의 본편 재생 시작 또는 2/3 도달 시청기록을 저장한다. 재생 시작과 완료 이벤트를 같은 회차별 행에 기록한다.

### Path parameter

| 이름 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `episodeUuid` | 예 | string | 저장할 공개 회차 UUID |

### 인증

Access JWT가 필수다. Refresh JWT는 사용할 수 없다. `user_id`는 검증된 JWT subject의 사용자에서 가져오며 요청 본문이나 query로 사용자를 선택할 수 없다. 인증 실패는 `AUTH_INVALID_TOKEN`(401)이고 응답은 `{ errorCode, errorName, statusCode, timestamp, path }` 형식이다.

### Request body

```json
{ "event": "STARTED", "positionMs": 0 }
```

또는:

```json
{ "event": "COMPLETED", "positionMs": 280000 }
```

| 필드 | 필수 | 타입 | 설명 |
| --- | --- | --- | --- |
| `event` | 예 | string | `STARTED` 또는 `COMPLETED` |
| `positionMs` | 예 | integer | 0 이상의 밀리초 위치. 서버가 선택된 FULL 영상 길이와 비교한다. |

`STARTED`는 위치가 0이어야 한다. `COMPLETED`는 `positionMs * 3 >= durationMs * 2`일 때만 허용된다. 영상 길이와 완료 여부는 요청에서 지정할 수 없다. 입력 형식 오류, 음수·소수·FULL 길이 초과, 시작 위치 오류, 2/3 미만 완료 요청은 NestJS 기본 400 응답이다.

### 저장 조건과 중복 동작

- 작품과 회차는 `PUBLISHED`이고 `published_at`이 현재 UTC 시각 이하이어야 한다. 해당 회차의 공개 FULL 영상 중 `display_order`가 가장 낮은 영상 길이를 기준으로 한다.
- 무료 회차는 인증 사용자에게 저장한다. 유료 회차는 해당 JWT 사용자의 entitlement가 필요하다. 구매되지 않은 공개 유료 회차는 `EPISODE_ACCESS_DENIED`(403)다.
- 존재하지 않거나 공개되지 않은 작품·회차 및 FULL 영상이 없으면 404다.
- `STARTED`는 새 행이면 위치 0과 미완료로 만든다. 기존 행이면 위치와 완료 상태를 보존하고 `last_played_at`, `updated_at`만 DB의 UTC 시각으로 갱신한다.
- `COMPLETED`는 기존 행이 없어도 만들며 요청 위치를 저장하고 완료 상태를 true로 설정한다. 완료를 다시 시작 상태로 되돌리지 않는다. 공개 시점 비교와 `last_played_at`, `created_at`, `updated_at` 저장은 DB의 UTC 시각을 사용한다.
- 동시 요청은 `(user_id, episode_id)` 복합 키의 원자적 upsert로 한 행에 반영한다. 늦은 시작 이벤트도 완료 상태와 위치를 초기화하지 않는다. 성공 요청마다 `last_played_at`과 `updated_at`은 갱신될 수 있고 `created_at`은 기존 행에서 보존된다.

### 204 Response

신규 삽입과 기존 행 갱신 모두 본문 없는 `204 No Content`를 반환한다.

작품 상세 조회의 `watchProgress.lastPlayedAt`은 저장된 UTC 시각을 ISO 8601 문자열(UTC `Z` 표기)로 반환한다. MySQL `DATETIME(3)`에는 시간대 정보가 없지만, 이 API는 공개 시점 비교와 시청기록 시각을 `UTC_TIMESTAMP(3)` 기준으로 처리한다.

### Errors

- `400 Bad Request`: 요청 본문 또는 위치가 잘못됨. NestJS 기본 오류 형식.
- `401 Unauthorized`: Access JWT 누락 또는 유효하지 않음. `AUTH_INVALID_TOKEN` 사용자 정의 오류 형식.
- `403 Forbidden`: 공개 유료 회차를 요청 사용자가 구매하지 않음. `EPISODE_ACCESS_DENIED` 사용자 정의 오류 형식.
- `404 Not Found`: 회차/작품 비공개 또는 없음, 공개 FULL 영상 없음. NestJS 기본 오류 형식.

이 API는 시청 기록 저장에 S3 서명 URL이 필요하지 않으며 별도 개발 환경 제한을 적용하지 않는다.
