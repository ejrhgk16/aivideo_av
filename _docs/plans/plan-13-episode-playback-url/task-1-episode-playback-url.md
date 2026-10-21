# task-1-episode-playback-url

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/04-playback/README.md`
- `back/src/content/public-catalog.controller.ts`
- `back/src/content/public-catalog.service.ts`
- `back/src/content/media-url.ts`
- `back/src/content/local-image.controller.ts`
- `back/src/content/media-storage.ts`
- `back/src/content/entities/episode.entity.ts`
- `back/src/content/entities/contentVideo.entity.ts`
- `back/test/unit/content/public-catalog.service.spec.ts`
- `back/test/unit/content/media-url.spec.ts`

## 작업

변경 파일은 `_docs/plans/plan-13-episode-playback-url/index.json`의 `task-1.files`에 선언된 11개 파일로 한정한다. 모든 파일 수정은 `apply_patch`로 수행한다.

1. `GET /episodes/:episodeId/playback`을 추가한다. 작품과 회차가 모두 공개되었는지 확인하고 해당 회차의 `contentType = EPISODE`, `kind = FULL` 영상 중 `displayOrder`가 가장 낮은 항목을 선택한다. 성공 시 `{ "url": "/media/videos/episodes/:episodeId" }` 형태로 응답한다. 회차·작품·영상이 없거나 공개되지 않았으면 `404`를 반환한다.
2. URL 생성 로직을 `media-url.ts`에 두어 응답 계약 `{ url }`을 유지한 채 추후 서명 URL 방식으로 교체할 수 있게 한다. 개발 환경 외에는 로컬 URL을 발급하지 않는다.
3. 새 `local-video.controller.ts`에서 `GET /media/videos/episodes/:episodeId`를 제공하고 `content.module.ts`에 등록한다. 개발 환경에서만 공개 작품·회차의 본편 영상 `storageKey`를 조회하여 `MEDIA_STORAGE_ROOT`의 MP4 파일을 `video/mp4`로 응답한다. 기존 이미지 제공 경로처럼 루트 밖의 경로, 누락된 파일, 디렉터리는 `404`로 처리한다. 영상 제공 경로에서도 공개 조건을 다시 확인한다.
4. `public-catalog.service.spec.ts`, `media-url.spec.ts`, 새 `local-video.controller.spec.ts`에서 성공 및 `404` 조건과 개발 환경 외 미노출, 파일 경로 안전성을 검증한다. 기존 테스트의 주변 코드는 불필요하게 바꾸지 않는다.
5. `_docs/api/04-playback/episodes.md`에 경로, 입력, `{ url }` 성공 응답, `404`, 인증 불필요, 공개 조건, 개발 환경 제약을 적는다. `README.md`에서 이 API를 연결하고 공통 미디어 규칙 변화는 `_docs/api/00-overview/conventions.md`에 반영한다. 현재는 가격과 무관하게 공개 회차 영상 URL을 제공하며 사용자 권한을 확인하지 않는다는 점을 명시한다.

검증 명령: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.

완료 조건: 개발 환경에서 공개 회차의 응답 URL로 MP4 파일을 받을 수 있고, 미공개·없는 회차와 본편 영상 없음은 URL 발급에서 `404`가 난다. 영상 제공 경로는 개발 환경 밖이나 잘못된 파일 경로에서 `404`를 반환한다. 세 검증 명령이 모두 통과한다.
