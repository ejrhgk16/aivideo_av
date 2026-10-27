# plan-31-drama-detail-watch-progress

## 목표
기존 `GET /dramas/:dramaId?userUuid=...`의 회차 조회에 사용자별 시청기록을 LEFT JOIN하고 각 회차에 `watchProgress: { positionMs, isCompleted, lastPlayedAt } | null`을 추가한다. 프론트 상세 회차 칸은 기록이 있는 경우에만 배경을 `colors.accent`로 표시하고, 무료 글자는 기록 여부와 무관하게 항상 `colors.muted`로 표시한다.

범위와 아래 task 구성은 사용자의 두 단계 승인을 받았다. 백엔드 조회·응답·API 문서·Postman 테스트와 프론트 응답 타입·상세 화면·기존 테스트를 변경한다. 기존 userUuid 조회 및 오류, 공개 조건, 정렬, 구매 권한과 재생 분기는 유지한다.

비목표: 시청기록 저장 API, 이어보기, DB 구조 변경, 데이터 초기화·시드 변경, 인증 도입, 다른 화면 색상 변경. 디렉터리 책임과 구조는 바뀌지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | detail-watch-progress-api | `back/src/content/publicCatalogService.ts`, `back/test/unit/content/publicCatalogService.spec.ts`, `back/test/api/public.postman_collection.json`, `back/test/api/README.md`, `_docs/api/02-content/dramas.md` | 사용자·회차별 시청기록 JOIN, 응답·문서·HTTP 검증 갱신 |
| 2 | detail-watch-progress-colors | `front/src/features/drama/dramaContent.ts`, `front/src/screens/DramaDetailScreen.tsx`, `front/tests/unit/dramaContent.test.ts`, `front/tests/unit/dramaDetailScreen.test.ts` | 시청기록 타입과 조건부 배경, 무료 글자색 변경 및 검증 |

## 실행 순서 및 병렬 작업
- task-1은 선행 작업 없이 시작한다.
- task-2는 task-1 완료 후 실행한다. API 응답을 먼저 확정하고 프론트 타입과 표시를 연결하기 위한 순차 의존성이다.
- 두 task는 파일이 겹치지 않지만 위 의존성 때문에 병렬 실행하지 않는다.

## 검증
- 백엔드: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
- 프론트: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
- API 검증은 현재 코드를 반영한 기존 localhost:3000 서버와 MySQL의 기존 데이터를 사용한다. SELECT로 적합한 기록과 사용자·회차를 확인하고 Postman 환경 변수로 전달한다. 기록 생성·초기화·시드 쓰기를 계획하지 않는다. 기록이 있는 사례를 검증할 데이터가 없으면 검증 실패와 부족 조건을 보고한다.
- 서버 연결을 HTTP로 먼저 확인한다. 서버가 없으면 자동 실행하거나 포트를 변경하지 않고 검증 실패로 보고하며 `npm --prefix back run start:dev`를 안내한다.

## 실행 결과
계획 작성 단계이며 제품 코드와 제품 검증은 아직 실행하지 않았다.
