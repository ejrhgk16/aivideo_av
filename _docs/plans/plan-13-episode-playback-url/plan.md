# episode-playback-url

## 목표

회차 ID로 공개 회차의 본편 영상 URL을 조회하는 REST API를 제공한다. 개발 환경에서는 응답한 URL로 `MEDIA_STORAGE_ROOT` 아래 MP4 파일을 받을 수 있게 한다.

## 범위와 가정

- `GET /episodes/:episodeId/playback`은 공개된 작품과 회차의 `EPISODE`/`FULL` 영상 중 `displayOrder`가 가장 낮은 영상에 대한 `{ "url": "/media/videos/episodes/:episodeId" }`를 반환한다.
- 회차, 작품, 본편 영상이 없거나 공개 조건을 만족하지 않으면 `404`를 반환한다. 파일이 없거나 저장소 루트 밖을 가리키면 영상 제공 경로가 `404`를 반환한다.
- 공개 조건은 기존 API와 같이 `status = PUBLISHED`이고 `published_at`이 현재 시각 이하인 경우다.
- URL 발급과 영상 파일 제공은 개발 환경에서만 사용한다. 운영 환경의 스토리지 URL과 서명 URL은 후속 작업이다.
- 사용자 인증, 유료 회차 해제 권한, 프론트 회차 클릭 및 플레이어 화면은 포함하지 않는다. 따라서 개발 환경에서는 유료 회차도 URL을 알면 영상을 받을 수 있다.
- 응답의 `url` 필드를 유지하면 후속 작업에서 URL 생성 방식을 서명 URL로 교체할 수 있다. 권한 도입 시에는 발급 API뿐 아니라 현재 영상 제공 경로도 보호하거나 대체해야 한다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | episode-playback-url | `back/src/content/public-catalog.controller.ts`, `back/src/content/public-catalog.service.ts`, `back/src/content/media-url.ts`, `back/src/content/local-video.controller.ts`, `back/src/content/content.module.ts`, `back/test/unit/content/public-catalog.service.spec.ts`, `back/test/unit/content/media-url.spec.ts`, `back/test/unit/content/local-video.controller.spec.ts`, `_docs/api/04-playback/README.md`, `_docs/api/04-playback/episodes.md`, `_docs/api/00-overview/conventions.md` | 공개 회차의 본편 영상 조회, 개발용 URL 응답과 MP4 제공, 테스트와 API 계약 갱신 |

## 실행 순서 및 병렬 작업

- `task-1`만 있으며 선행 의존성은 없다. API 응답과 영상 제공 경로, 문서가 함께 일치해야 하므로 병렬 task로 나누지 않는다.

## 검증

- `npm --prefix back run lint`
- `npm --prefix back run test`
- `npm --prefix back run build`
- 공개 회차의 URL 조회와 MP4 응답, 미공개·없는 회차 및 본편 영상 없음의 `404`, 개발 환경 외 미노출, 파일 경로 안전성을 단위 테스트로 확인한다.

## 승인 및 실행 상태

- 범위 승인: 사용자 권한 검사는 후속 작업으로 미루고 개발용 영상 URL 응답과 실제 MP4 제공 경로를 구현한다. 프론트 회차 클릭과 플레이어는 제외한다.
- task 구성 승인: 단일 `task-1`, 위의 정확한 파일 목록과 검증 명령.
- 상태: draft. `$harness` 실행 전까지 제품 코드는 변경하지 않는다.
