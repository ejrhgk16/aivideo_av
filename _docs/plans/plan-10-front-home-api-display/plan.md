# front-home-api-display

## 목표

홈에서 이미 요청 중인 `HOME_FEATURED`, `RECOMMENDATION_DAILY`, `EDITORIAL_TOP_3` 컬렉션을 각각 추천 히어로, 추천 포스터 목록, TOP 3에 표시한다. DB의 이미지 `storageKey`는 유지하면서 백엔드가 화면용 URL을 API 응답에 추가한다. 개발 환경에서는 NestJS가 `MEDIA_STORAGE_ROOT`의 작품 이미지를 제공하고, 프론트는 API 작품 ID로 공개 상세 API를 조회해 작품 상세를 표시한다.

## 범위

- 컬렉션별 노출 순서와 API의 제목, 짧은 소개, 제작사, 장르, 공개·무료 회차 수, 이미지 URL을 홈의 세 영역에 연결한다. 홈의 TOP 3와 랭킹 탭은 같은 편집 컬렉션을 사용한다.
- 컬렉션별 로딩, 빈 결과, 요청 실패를 정적 작품으로 대체하지 않고 화면에서 구분한다.
- 기존 이미지 `storageKey` 필드를 유지하고 `imageUrls` 객체를 컬렉션·작품 API 응답에 추가한다. URL은 개발 중 HTTP 경로이며, 운영 signed URL을 넣을 수 있는 계약으로 정의한다.
- 개발 전용 이미지 GET 경로는 `front/media`의 작품 이미지 파일만 제공한다. 기존 `MEDIA_STORAGE_ROOT=../front/media`를 사용한다.
- API 작품을 선택하면 기존 공개 작품 상세 API를 호출해 소개와 공개 회차를 표시한다. 정적 시안 작품의 기존 상세 동작은 유지한다.
- API 작품의 재생·저장처럼 아직 다른 화면에 연결되지 않은 동작은 사용자가 누를 수 없도록 표시한다.

## 비목표

- 최신·장르 탭과 로맨스 배너의 정적 콘텐츠를 API로 교체하지 않는다.
- 운영용 외부 저장소 연동과 signed URL 발급, URL 만료 후 재조회 정책은 구현하지 않는다.
- 재생, 구매, 사용자별 이용 권한, 검색·추천·보관함 화면의 API 전환은 포함하지 않는다.
- `web-prototype/`, DB 스키마·시드, 비밀값 파일은 변경하지 않는다.

## 영향 레이어 및 가정

- 백엔드 콘텐츠·편성 응답과 개발용 이미지 제공, 프론트 기능별 API 타입·요청·화면, 해당 API 문서와 제품 테스트가 대상이다. 디렉터리 책임과 프론트·백엔드 경계는 변경하지 않는다.
- API 응답의 `images`는 기존 storage key를 유지하며 새 `imageUrls`가 화면용 URL을 제공한다. 개발 URL은 API 서버 기준 경로, 향후 운영 URL은 외부 signed URL이 될 수 있다. 프론트는 두 형식을 모두 표시할 수 있어야 한다.
- `front/media/dramas`에 개발용 작품 이미지가 있고, 개발 백엔드의 `MEDIA_STORAGE_ROOT`가 `front/media`를 가리킨다. 실기기의 API base URL은 개발 PC에 접근 가능한 호스트를 사용해야 한다.
- 운영 signer가 없는 환경에서 유효하지 않은 로컬 URL을 운영용으로 생성하지 않는다. signed URL 발급은 후속 작업이다.
- API 작품 ID는 정적 카탈로그 ID와 다르므로 상세 API 조회가 필요하다. 재생 화면은 정적 카탈로그 기반이므로 이번 범위에서 API 작품 재생을 연결하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | backend-image-urls | `back/src/content/media-url.ts`, `back/src/content/local-image.controller.ts`, `back/src/content/content.module.ts`, `back/src/content/public-catalog.service.ts`, `back/src/programming/public-collection.service.ts`, `back/test/unit/content/media-url.spec.ts`, `back/test/unit/content/local-image.controller.spec.ts`, `back/test/unit/content/public-catalog.service.spec.ts`, `back/test/unit/programming/public-collection.service.spec.ts`, `_docs/api/02-content/dramas.md`, `_docs/api/03-programming/collections.md` | 기존 storage key와 별개로 이미지 URL 반환, 개발 이미지 GET 경로, 계약·테스트 반영 |
| 2 | frontend-api-contract | `front/src/common/media.ts`, `front/src/features/home/homeContent.ts`, `front/src/features/drama/dramaContent.ts`, `front/tests/unit/media.test.ts`, `front/tests/unit/homeContent.test.ts`, `front/tests/unit/dramaContent.test.ts`, `front/scripts/test-experience.cjs`, `front/README.md` | 화면용 URL 해석, 홈·상세 응답 타입과 조회 함수, 단위 검증·실행 안내 |
| 3 | home-display | `front/src/screens/HomeScreen.tsx` | 세 컬렉션을 홈 영역과 랭킹 탭에 출력하고 로딩·빈 결과·실패 상태 처리 |
| 4 | api-drama-detail | `front/src/screens/DramaDetailScreen.tsx`, `front/src/screens/ApiDramaDetailScreen.tsx` | API ID의 공개 상세 조회·표시, 정적 상세 유지, 미연결 동작 비활성화 |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없는 단일 백엔드 task다. 개발용 이미지 URL의 형식과 API 응답 계약을 먼저 확정한다.
- `task-2`는 `task-1` 완료 후 실행한다. 백엔드가 정의한 `imageUrls` 필드와 이미지 GET 경로를 프론트 타입·URL 처리에 반영한다.
- `task-3`과 `task-4`는 각각 `task-2` 완료 후 병렬 실행 가능하다. 대상 화면 파일이 겹치지 않고 공통 API 코드는 `task-2`에서 완료한다.

## 검증

- `task-1`: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`. 개발 이미지 경로가 `MEDIA_STORAGE_ROOT`의 실제 이미지에 대응하고, 이미지 외 파일·잘못된 경로가 제공되지 않으며, 기존 storage key와 새 URL 필드가 일치하는지 확인한다.
- `task-2`~`task-4`: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`. 상대 개발 URL과 절대 signed URL 형식을 모두 해석하고, 세 컬렉션의 API 응답이 화면에 표시되며 API ID 상세 조회가 정적 상세를 깨뜨리지 않는지 확인한다.
- 프론트 제품 테스트는 `front/tests/**/*.test.ts(x)`, 백엔드 단위 테스트는 `back/test/unit/**/*.spec.ts`에 둔다.

## 승인 및 실행 상태

- 범위 승인: 홈의 세 컬렉션 표시, API 작품 상세, 개발용 NestJS 이미지 제공과 화면용 URL 응답. 운영 signed URL 구현과 재생은 후속 작업.
- task 구성 승인: `task-1 → task-2 → (task-3, task-4)`와 각 task의 정확한 변경 파일·검증 명령.
- 계획 생성 단계다. 제품 코드 변경과 제품 검증은 `$harness` 실행 시 수행한다.
