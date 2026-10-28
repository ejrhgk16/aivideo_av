# plan-32-episode-playback-entitlements

## 목표

`GET /episodes/:episodeId/playback`이 선택 query `userUuid`로 사용자와 회차 권한을 JOIN하고, 무료 회차 또는 해당 사용자가 권한을 가진 유료 회차에만 signed URL을 반환한다. 사용자 없이 무료 회차를 요청할 수 있으며, 권한이 없는 유료 회차는 익명 요청을 포함해 기존 커스텀 오류 체계의 `EPISODE_ACCESS_DENIED`(403)를 반환한다.

백엔드 범위와 task 구성은 사용자에게 각각 승인받았다. 이후 사용자가 UserProvider의 사용자 UUID를 재생 feature에 전달하는 프론트 task 추가를 요청했다. 이번 작업은 계획 생성이며 제품 구현은 `$harness`에서 실행한다.

### 범위와 가정

- `userUuid`는 선택값이다. 생략은 익명 요청으로 처리하며, 전달된 빈 값·잘못된 UUID·중복 query는 400, 전달된 UUID의 사용자가 없으면 404다.
- 무료 기준은 기존 상세 조회와 동일한 `pricePoints = 0`이다. 유료 회차는 요청 사용자와 요청 회차에 모두 일치하는 `episode_entitlements` 행이 있어야 한다.
- 사용자 UUID는 식별 값이다. 현재 로그인은 토큰·세션을 발급하지 않으며, 이번 변경은 요청자가 UUID 소유자인지 인증하지 않는다.
- 공개 작품·회차 및 공개 시각 조건, FULL 영상 선택 순서, development 전용 발급, 3600초 만료와 성공 응답은 유지한다.
- 변경 계층은 백엔드 content 서비스·컨트롤러, 공통 오류 정의, 프론트 회차 재생 화면·feature, API 문서와 테스트다. 파일 책임이나 디렉터리 구조 변경은 없다.
- 프론트는 `useUser()`의 현재 `user.uuid`를 feature 인자로 전달하고 query에 담는다. 사용자가 없으면 query를 생략하고 요청한다. 사용자 UUID 변경·로그아웃 시 재조회한다. 프리뷰는 기존처럼 사용자 없이 재생된다.

### 비목표

- 프리뷰 API 변경, 토큰·세션 인증, 구매 API·DB 스키마 변경, 로그인 자동 이동과 새로운 권한 오류 전용 UI는 제외한다.
- 검증을 위한 DB 초기화·시드·권한·포인트 변경을 하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | episode-playback-entitlements | `back/src/content/publicCatalogController.ts`, `back/src/content/publicCatalogService.ts`, `back/src/common/error/error.enum.ts`, `back/src/common/error/error.customExceptions.ts`, `back/test/unit/content/publicCatalogService.spec.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/04-playback/episodes.md`, `_docs/api/00-overview/conventions.md` | 선택 사용자 UUID, 익명 무료 재생, 사용자·권한 JOIN, 미보유 커스텀 403 및 문서·테스트 갱신 |
| 2 | front-playback-user-uuid | `front/src/screens/playbackScreen_episode.tsx`, `front/src/features/playback/episodePlayback.ts`, `front/tests/unit/episodePlayback.test.ts` | UserProvider 사용자 UUID를 재생 feature와 query에 전달 |

## 실행 순서 및 병렬 작업

- `task-1`은 `depends_on: []`인 독립 task다. 백엔드 API 계약과 컬렉션을 함께 변경하고 검증한다.
- `task-2`는 `task-1` 완료 후 실행한다. 대상 파일은 겹치지 않지만 선택 `userUuid` 및 익명 무료 재생 계약 확정과 백엔드 검증 후 프론트 호출을 연결하도록 순차 실행한다. 병렬 실행 대상은 없다.

## 검증

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

HTTP API 테스트는 현재 코드를 반영한 기존 `http://localhost:3000` 서버와 실제 MySQL의 기존 데이터를 사용한다. 테스트 전 HTTP 요청으로 연결 및 코드 반영 여부를 확인한다. 서버를 자동 시작하거나 다른 포트로 우회하지 않는다. 서버가 없으면 검증 실패로 기록하고 `npm --prefix back run start:dev` 실행을 안내한다. 필요한 기존 데이터가 없으면 실패로 보고하며 DB를 변경하지 않는다. S3 객체 자체는 다운로드하지 않는다.

## 계획 검증 결과

- task 문서를 다시 열어 핵심 호출 흐름·JOIN·권한 검사·오류·테스트 예시와 선언한 파일 범위·완료 조건의 일치를 검토했다. 프론트 task 추가 후 해당 문서도 다시 검토한다.
- `node tools/harness/cli.mjs validate --plan plan-32-episode-playback-entitlements`: 통과 (`valid: true`).
- 제품 코드는 변경하지 않았으며 제품 검증은 아직 실행하지 않았다.
