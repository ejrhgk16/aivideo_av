# task-1-s3-full-preview-playback

## 읽어야 할 파일

- AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/api/04-playback/episodes.md
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md
- _docs/api/00-overview/conventions.md
- _docs/AI_DRAMA_data_model/02-content/content_videos.md
- back/src/content/public-catalog.service.ts
- back/src/content/public-catalog.controller.ts
- back/src/programming/public-collection.service.ts
- back/src/content/media-url.ts
- back/src/content/local-video.controller.ts
- back/src/content/content.module.ts
- back/src/content/entities/index.ts

## 작업

변경 가능 파일은 다음 25개로 한정한다. 신규·삭제 경로도 포함하며, 계획의 index.json task-1.files와 일치한다.

- back/package.json
- back/package-lock.json
- back/.env.development
- back/README.md
- back/src/content/s3VideoUrlService.ts (신규)
- back/src/content/content.module.ts
- back/src/content/public-catalog.controller.ts
- back/src/content/public-catalog.service.ts
- back/src/content/media-url.ts
- back/src/content/local-video.controller.ts (삭제)
- back/src/content/entities/dramaImage.entity.ts (삭제)
- back/src/content/entities/episodeVideo.entity.ts (삭제)
- back/src/content/entities/index.ts
- back/src/programming/public-collection.service.ts
- back/test/unit/content/s3VideoUrlService.spec.ts (신규)
- back/test/unit/content/public-catalog.service.spec.ts
- back/test/unit/content/media-url.spec.ts
- back/test/unit/content/local-video.controller.spec.ts (삭제)
- back/test/unit/programming/public-collection.service.spec.ts
- _docs/ARCHITECTURE.md
- _docs/AI_DRAMA_data_model/02-content/content_videos.md
- _docs/api/00-overview/conventions.md
- _docs/api/02-content/dramas.md
- _docs/api/03-programming/collections.md
- _docs/api/04-playback/episodes.md

1. AWS SDK for JavaScript v3의 S3 클라이언트와 presigner를 설치한다. 기본 자격 증명 체인을 사용하고 액세스 키·시크릿을 코드나 환경 파일에 넣지 않는다.
2. 기존 back/.env.development 값을 보존하며 AWS_PROFILE=aivideo-dev, AWS_REGION=ap-northeast-2, S3_BUCKET=aivideo-dev를 추가한다. 이 파일은 Git에 포함하지 않는다.
3. 개발 환경의 `GET /episodes/:episodeId/playback`에서 현재 조인으로 선택한 FULL 영상의 `storageKey`에 대해 유효 기간 3600초인 S3 GetObject URL을 서명한다. 기존 응답 필드, 공개 조건, 선택 순서와 404 조건을 유지한다. 개발 환경 밖에서는 서명하지 않고 404를 반환한다. 설정 누락 시 로컬 URL로 대체하지 않는다.
4. 개발 환경 전용 `GET /dramas/:dramaId/previews/:videoId/playback`을 추가한다. `content_videos.id = videoId`, `content_type = DRAMA`, `kind = PREVIEW`, `content_id = dramaId`와 작품의 공개 상태·공개 시각을 확인한 뒤 동일한 S3 서명 서비스로 `storageKey`를 서명한다. 성공 응답은 `{ url, durationMs }`이고, 미공개·누락·종류 불일치·개발 환경 외에는 404다. 인증과 구매 여부 검사는 추가하지 않는다.
5. 작품 목록·상세와 컬렉션 `previewVideos` 항목에 `id`를 추가한다. 기존 `storageKey`, `durationMs`, 정렬 기준은 유지한다. 새 API 경로와 응답·오류·노출 규칙을 해당 API 문서 및 공통 규칙에 반영한다.
6. 로컬 영상 컨트롤러와 테스트를 삭제한다. `content.module.ts` 등록, `media-url.ts`의 로컬 회차 URL 함수와 테스트, PublicCatalogService의 로컬 영상 제공 전용 조회 함수를 제거한다. 로컬 이미지 제공은 다음 task까지 유지한다.
7. in-repo 소비처가 없는 `dramaImage.entity.ts`, `episodeVideo.entity.ts` 별칭을 삭제하고 `entities/index.ts` export를 정리한다. `media-storage.ts`의 storage key 생성 함수는 유지한다.
8. API 문서에는 절대 S3 URL, 만료, 개발 환경 노출, 로컬 영상 API 제거를 반영한다. 데이터 모델, 아키텍처와 README의 영상 저장소 설명을 맞춘다. 구매 권한을 확인하지 않는 현재 API 계약은 유지한다.
9. 서명 함수와 FULL·PREVIEW 서비스의 단위 테스트에서 객체 키, 만료, 응답, 공개·환경 조건과 설정 누락을 검증한다. 실제 AWS 호출은 수행하지 않는다.

검증 명령: npm --prefix back run lint, npm --prefix back run test, npm --prefix back run build.

완료 조건: 개발 환경의 공개 회차와 PREVIEW가 각각 선택된 `storageKey`의 1시간 유효 S3 GET URL을 반환하고, PREVIEW ID가 목록·상세·컬렉션 응답에 포함된다. 로컬 영상 API와 미사용 별칭은 제거된다. 이미지 API와 FULL의 기존 404·응답 계약은 유지되며 검증 명령이 통과한다.
