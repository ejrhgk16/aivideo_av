# s3-video-playback-backend-naming

## 목표

개발 환경의 서울 리전 S3 버킷 `aivideo-dev`에서 작품·회차·장르 이미지는 직접 접근 가능한 URL로 제공하고, PREVIEW·FULL 영상은 1시간 유효한 서명 GET URL로 제공한다. 로컬 미디어 API와 사용되지 않는 content 별칭을 제거하고, `back/src`·`back/test`의 하이픈이 들어간 코드 파일명을 camelCase로 통일한다.

## 범위와 가정

- 버킷은 하나만 사용한다. 버킷 전체를 공개하지 않고 버킷 정책의 `s3:GetObject`를 작품·회차·장르 이미지 `storageKey` 패턴에만 허용한다. 영상 키는 해당 패턴 밖에 두며 비공개로 유지한다. 공개 여부는 DB `kind`가 아닌 S3 객체 키로 결정된다.
- 이미지 키 패턴은 `dramas/*/images/*/*.webp`, `dramas/*/episodes/*/images/*.webp`, `genres/*/images/*.webp`다. 기존 `storageKey`와 DB 컬럼은 유지하며 이미지마다 ACL이나 정책을 따로 설정하지 않는다.
- 버킷 수준 Block Public Access에서 ACL 차단은 유지하고 공개 버킷 정책을 막는 항목만 조정한다. 적용 전후 버킷·계정 설정과 정책을 확인한다. 이미지 객체의 키와 `Content-Type`이 올바르지 않으면 직접 URL이 재생 가능한 이미지가 되지 않는다.
- 기존 `GET /episodes/:episodeId/playback`의 응답 필드, 공개 작품·회차·FULL 영상 선택 기준과 개발 환경 외 404 조건은 유지한다. 새 `GET /dramas/:dramaId/previews/:videoId/playback`은 공개 작품에 속한 PREVIEW 영상만 서명하며, 개발 환경 밖과 미공개·누락·다른 종류는 404를 반환한다. 두 경로는 같은 S3 서명 서비스를 사용한다.
- 작품 목록·상세와 컬렉션의 `previewVideos`에 영상 `id`를 추가해 프론트가 새 PREVIEW 경로를 호출할 수 있게 한다. 작품 이미지 `imageUrls`는 절대 S3 URL로 바꾸고, 원래 `images`의 저장소 키는 유지한다. 현재 프론트 URL 해석기는 절대 HTTP URL을 처리하므로 화면 수정은 포함하지 않는다.
- AWS SDK 기본 자격 증명 체인을 사용한다. 로컬 `back/.env.development`에 `AWS_PROFILE=aivideo-dev`, `AWS_REGION=ap-northeast-2`, `S3_BUCKET=aivideo-dev`를 설정한다. 액세스 키·시크릿을 프로젝트 파일에 두지 않는다.
- `front/media`와 `MEDIA_STORAGE_ROOT`를 더 이상 사용하지 않으므로 로컬 이미지·영상 컨트롤러와 파일 경로 해석 코드를 제거한다. 로컬 미디어 파일 자체를 삭제하지는 않는다.
- `back/src`·`back/test`의 하이픈 코드 파일 18개 중 로컬 이미지·영상용 4개는 삭제하고 나머지 14개를 camelCase로 변경한다. TypeORM 마이그레이션은 파일명만 바꾸고 클래스 이름과 DB 이력은 유지한다.
- 운영 서버 IAM 역할, 객체 업로드·이관, PREVIEW 재생 화면, 유료 FULL의 구매 권한 검사는 범위 밖이다. 현재 공개 playback API는 구매 여부를 검사하지 않으므로 서명 URL만으로는 유료 접근을 제한할 수 없다. 과거 완료된 plan 문서는 실행 기록이므로 경로를 다시 쓰지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | s3-full-preview-playback | `back/package.json`, `back/package-lock.json`, `back/.env.development`, `back/README.md`, `back/src/content/`, `back/src/programming/public-collection.service.ts`, `back/test/unit/content/`, `back/test/unit/programming/public-collection.service.spec.ts`, `_docs/ARCHITECTURE.md`, `_docs/AI_DRAMA_data_model/02-content/content_videos.md`, `_docs/api/` | FULL·PREVIEW S3 서명 URL, PREVIEW API와 ID, 로컬 영상·미사용 별칭 제거 |
| 2 | public-s3-images | `back/.env.development`, `back/README.md`, `back/src/content/`, `back/test/unit/content/`, `back/test/unit/programming/public-collection.service.spec.ts`, `_docs/ARCHITECTURE.md`, `_docs/AI_DRAMA_data_model/02-content/`, `_docs/api/` | 이미지 키 패턴만 S3 공개, 직접 URL 전환, 로컬 이미지 API·`MEDIA_STORAGE_ROOT` 제거 |
| 3 | backend-code-filename-camelcase | `back/src/content/`, `back/test/unit/content/`, `back/src/programming/`, `back/test/unit/programming/`, `back/src/common/database/migrations/`, `back/src/common/database/seed/initialData.ts`, `back/test/unit/database/initialData.spec.ts`, `back/README.md`, `_docs/ARCHITECTURE.md` | 남은 하이픈 코드 파일 14개를 camelCase로 변경하고 import·문서 경로 갱신 |

정확한 생성·수정·삭제 파일은 같은 폴더의 index.json과 각 task 문서에 선언한다.

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없어 먼저 실행한다.
- `task-2`는 `task-1` 완료 후 실행한다. 두 task가 content 파일과 API·아키텍처 문서를 함께 수정하므로 병렬 실행하지 않는다.
- `task-3`은 `task-2` 완료 후 실행한다. 로컬 이미지 파일을 먼저 삭제해야 삭제될 파일의 이름을 바꾸지 않으며, 앞선 task의 import 경로를 최종 파일명으로 정리할 수 있다.

## 검증

- 각 task에서 `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`를 실행한다.
- `task-2`는 AWS CLI로 버킷 정책과 Block Public Access를 다시 읽어 이미지 키 패턴만 공개되고 영상 키 패턴에는 공개 읽기 권한이 없음을 확인한다. 실제 객체가 있으면 익명 이미지 GET 성공과 익명 영상 GET 거부도 확인한다.
- 완료 기준: 개발 환경의 공개 회차·프리뷰 재생 응답에 DB `storageKey`를 대상으로 한 1시간 유효 S3 GET URL이 들어간다. 작품 이미지 URL은 절대 S3 URL이다. 로컬 미디어 API와 미사용 별칭은 제거되고, `back/src`·`back/test`에 하이픈 코드 파일명이 남지 않는다.
- 자동 단위 검증은 S3 객체 존재나 실제 영상 디코딩까지 확인하지 않는다. 재생에는 해당 `storageKey`로 업로드된 MP4 객체가 필요하다.

## 승인 및 실행 상태

- 변경 범위 승인: 버킷 하나에서 이미지만 공개하고 PREVIEW·FULL은 서명 URL로 제공하며, 로컬 이미지 컨트롤러를 제거한다.
- 변경 task 구성 승인: 영상, 공개 이미지, 파일명 정리의 3개 순차 task와 각 파일 범위·검증 명령.
- 계획 상태: draft. `$harness` 실행 전까지 제품 코드와 AWS 설정은 변경하지 않는다.
