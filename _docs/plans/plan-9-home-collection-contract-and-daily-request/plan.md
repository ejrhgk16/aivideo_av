# home-collection-contract-and-daily-request

## 목표

프론트 홈 컬렉션 응답 타입을 현재 백엔드 `GET /collections/:code` 계약에 맞추고, 기존 코드별 병렬 요청 방식에 `RECOMMENDATION_DAILY`를 추가한다. 추가 요청도 컬렉션 코드를 포함한 프론트 콘솔 로그로 응답 객체 전체 또는 오류를 확인할 수 있어야 한다.

## 범위

- `HomeCollectionDrama.images`를 `poster`, `homeHero`, `detailCover`, `campaigns`로 정합화하고 `previewVideos` 타입을 추가한다.
- 홈 마운트 시 `HOME_FEATURED`, `EDITORIAL_TOP_3`, `RECOMMENDATION_DAILY`를 기존 `getHomeCollection(code)`와 `Promise.all` 처리로 요청한다.
- 각 성공 응답은 코드명과 응답 객체 전체를 `console.log`에 전달하고, 실패는 코드명과 오류를 `console.error`에 전달한다.
- 기존 단위 테스트에 백엔드 계약을 따르는 응답 fixture와 데일리 컬렉션 요청 경로 검증을 반영한다.
- 컬렉션 API 문서의 홈 사용 코드 설명과 path parameter 예시에 `RECOMMENDATION_DAILY`를 추가한다.

## 비목표

- 응답 데이터를 홈 화면 UI에 매핑하거나 로컬 `dramas` 데이터를 교체하지 않는다.
- 백엔드 endpoint, 응답, DB, 시드, 환경 변수와 의존성을 변경하지 않는다.
- 로딩·오류 UI, 캐시, 재시도, 새로운 상태 관리 또는 API 추상화를 추가하지 않는다.

## 영향 레이어 및 가정

- 프론트 기능별 응답 타입·API 호출, 화면의 마운트 요청, 기존 프론트 테스트와 관련 API 사용 문서를 변경한다.
- 현재 백엔드 `PublicCollectionResponse`와 컬렉션 API 문서를 응답 계약의 기준으로 삼는다.
- 백엔드는 기존 endpoint에서 `RECOMMENDATION_DAILY` 코드를 처리할 수 있으며, 개발용 시드에는 해당 컬렉션과 작품 연결이 이미 정의되어 있다.
- 디렉터리 책임과 프론트·백엔드 경계는 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | home-collection-contract-and-daily-request | `front/src/features/home/homeContent.ts`, `front/src/screens/HomeScreen.tsx`, `front/tests/unit/homeContent.test.ts`, `_docs/api/03-programming/collections.md` | 응답 타입 정합화, 데일리 코드 요청과 응답 전체 로그, 기존 테스트·사용 코드 문서 갱신 |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없는 단일 task다. 응답 타입, 요청 추가, 검증과 문서 반영을 함께 완료한다.
- 다른 task가 없으므로 병렬 실행 대상과 task 간 파일 충돌은 없다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 테스트에서 실제 백엔드 형태의 이미지·프리뷰 영상 응답이 보존되고 `RECOMMENDATION_DAILY`가 기존 코드와 동일한 endpoint 규칙으로 요청되는지 확인한다.
- 코드 검토에서 세 코드가 마운트 요청 배열에 포함되고, 기존 공통 성공·오류 로그가 각 코드와 응답 객체 전체 또는 오류를 전달하는지 확인한다.

## 승인 및 실행 상태

- 범위 승인과 task 구성 승인을 완료했다. 추가 요청의 응답 객체 전체를 프론트 콘솔에 출력하는 조건을 포함한다.
- 계획 생성 단계이며 제품 구현과 제품 검증 명령은 아직 실행하지 않았다.
