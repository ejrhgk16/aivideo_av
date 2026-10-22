# task-2-public-s3-images

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- `_docs/AI_DRAMA_data_model/02-content/content_images.md`
- `back/src/content/media-url.ts`
- `back/src/content/media-storage.ts`
- `back/src/content/local-image.controller.ts`
- `back/src/content/content.module.ts`

## 작업

`task-1` 완료 후 실행한다. 변경 가능 파일은 다음 17개로 한정한다. 삭제 경로도 포함하며, 계획의 `index.json` `task-2.files`와 일치한다. AWS의 `aivideo-dev` 버킷 설정 변경은 아래 지시대로 수행한다.

- `back/.env.development`
- `back/README.md`
- `back/src/content/media-url.ts`
- `back/src/content/media-storage.ts`
- `back/src/content/content.module.ts`
- `back/src/content/local-image.controller.ts` (삭제)
- `back/test/unit/content/public-catalog.service.spec.ts`
- `back/test/unit/content/media-url.spec.ts`
- `back/test/unit/content/media-storage.spec.ts`
- `back/test/unit/content/local-image.controller.spec.ts` (삭제)
- `back/test/unit/programming/public-collection.service.spec.ts`
- `_docs/ARCHITECTURE.md`
- `_docs/AI_DRAMA_data_model/02-content/content_images.md`
- `_docs/AI_DRAMA_data_model/02-content/episode_subtitles.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`

1. AWS 인증 주체, 버킷 리전, 버킷·계정 수준 Block Public Access, 기존 버킷 정책 및 Object Ownership을 읽어 현재 상태를 확인한다. 버킷은 `ap-northeast-2`의 `aivideo-dev` 하나만 사용한다. 기존 정책이 생겼다면 무조건 덮어쓰지 말고 이미지 공개 문장만 추가한다.
2. 버킷 수준 `BlockPublicAcls=true`, `IgnorePublicAcls=true`를 유지하고 `BlockPublicPolicy=false`, `RestrictPublicBuckets=false`로 설정한다. 계정 수준 차단이 있다면 적용 가능 여부를 확인하고, 다른 버킷의 계정 수준 보호를 임의로 바꾸지 않는다.
3. 익명 주체에 `s3:GetObject`만 허용하는 버킷 정책을 이미지 객체 ARN 패턴 `arn:aws:s3:::aivideo-dev/dramas/*/images/*/*.webp`, `arn:aws:s3:::aivideo-dev/dramas/*/episodes/*/images/*.webp`, `arn:aws:s3:::aivideo-dev/genres/*/images/*.webp`에 적용한다. 버킷 전체, `preview/`, `videos/`, 자막 키에는 공개 읽기를 허용하지 않는다. 업로드 시 공개 ACL은 사용하지 않는다. 공개 여부는 객체의 `kind`나 MIME이 아닌 S3 키로 판단하므로 영상 객체를 이미지 경로에 넣지 않는다.
4. `media-url.ts`가 기존 이미지 `storageKey`에서 `https://aivideo-dev.s3.ap-northeast-2.amazonaws.com/<encoded-key>` 형식의 절대 URL을 만들게 한다. 작품 `imageUrls`의 필드와 순서는 유지하고 `images`의 저장소 키는 유지한다. 기존 프론트 URL 해석기가 절대 URL을 처리하므로 프론트 화면 코드는 수정하지 않는다.
5. `LocalImageController`와 테스트, 모듈 등록을 제거한다. 로컬 영상 제거 후 더는 쓰이지 않는 `getMediaStorageRoot`, `resolveMediaStoragePath`와 관련 테스트를 제거한다. `media-storage.ts`의 이미지·영상·자막 키 생성 함수는 유지한다. `back/.env.development`의 `MEDIA_STORAGE_ROOT`를 제거한다. 로컬 파일 자체는 삭제하지 않는다.
6. README, 아키텍처, 데이터 모델, API 문서에서 로컬 이미지 API 제거, 절대 S3 이미지 URL, 공개 이미지 키 패턴 및 영상 비공개 조건을 실제 구현과 일치시킨다. 회차·장르 이미지의 기존 API 저장소 키 필드를 새 URL 필드로 임의 변경하지 않는다.
7. 단위 테스트에서 작품 목록·상세·컬렉션의 `imageUrls`가 절대 URL이고 `images`의 키는 유지되는지 확인한다. 버킷 정책과 Block Public Access를 다시 읽어 영상 ARN에 공개 권한이 없음을 확인한다. 실제 객체가 있으면 익명 이미지 GET 성공과 익명 영상 GET 거부를 확인한다.

검증 명령: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.

완료 조건: 정해진 이미지 키 패턴만 공개 읽기가 가능하고 작품 `imageUrls`는 직접 S3 URL이다. PREVIEW·FULL 영상 키는 비공개이며 로컬 이미지 API와 `MEDIA_STORAGE_ROOT` 의존성이 제거되고 검증 명령이 통과한다.
