# home-content-rest-api

## 목표

홈 화면이 서버의 공개 콘텐츠를 각 영역별로 조회할 수 있도록 REST API를 추가한다. 카탈로그와 운영 편성은 별도 API로 제공하며, 두 API는 서로의 서비스나 DTO를 공유하지 않는다.

## 범위

- `GET /dramas?sort=latest`로 현재 시각까지 공개된 작품을 최신 공개일 순으로 반환한다.
- `GET /genres`로 장르를 `displayOrder` 순으로 반환한다.
- `GET /content-collections/:code`로 활성 상태이고 편성 기간 안에 있는 컬렉션을 반환한다. `HOME_FEATURED`, `EDITORIAL_TOP_3`를 홈 화면에서 사용한다.
- 작품 응답에는 작품 식별자·slug·제목·짧은 소개·제작사·장르·이미지 storage key·공개 회차 수·무료 공개 회차 수를 포함한다.

## 비목표

- 프론트엔드 `catalog.ts` 제거 또는 REST API 연결
- 로그인·게스트 식별, 저장·이어보기·지갑 잔액 조회
- 작품 상세, 검색, 재생, 이미지 파일 또는 CDN URL 제공
- 기존 데이터 모델·마이그레이션·시드 데이터 변경
- 공통 카탈로그 서비스 또는 공통 DTO 추상화 추가

## 가정

- 공개 API의 콘텐츠 노출 조건은 데이터 모델 문서의 기준대로 `PUBLISHED`이고 `published_at`이 현재 시각 이하인 작품과 회차다.
- 이미지 응답은 객체 스토리지의 공개 URL이 아니라 기존 `storageKey`만 반환한다.
- 현재 홈이 필요로 하는 전체 목록만 반환하며, 페이지네이션·검색 조건은 이 플랜에 포함하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | public-catalog-api | `back/src/content/`, `back/test/unit/content/public-catalog.service.spec.ts` | 최신 작품 및 장르 공개 API와 단위 테스트를 구현한다. |
| 2 | public-home-collection-api | `back/src/programming/`, `back/test/unit/programming/public-collection.service.spec.ts` | 홈 추천·랭킹 컬렉션 공개 API와 단위 테스트를 구현한다. |
| 3 | register-content-api-modules | `back/src/app.module.ts` | 두 Nest 모듈을 애플리케이션에 등록한다. |

## 실행 순서 및 병렬 작업

- `task-1`과 `task-2`는 병렬 실행 가능: 각각 `content`와 `programming` 디렉터리 및 별도 단위 테스트만 변경하며, 서로의 서비스·DTO를 호출하지 않는다.
- `task-3`은 `task-1`, `task-2` 완료 후 실행: 두 모듈이 생성된 뒤 `AppModule`에 함께 등록해야 한다.

## 검증 결과

- 플랜 생성 시점: 미실행. 각 task의 `checks`를 Harness 실행 중 확인한다.
