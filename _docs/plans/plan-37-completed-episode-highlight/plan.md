# plan-37-completed-episode-highlight

## 목표
드라마 상세 회차 목록에서 `watchProgress.isCompleted === true`인 회차에만 기존 시청 배경색을 표시한다. 시청기록이 없거나 재생만 시작한 회차는 기본 배경색으로 표시한다.

범위와 단일 task 구성은 사용자 승인을 받았다. 변경 레이어는 프론트 화면과 기존 화면 테스트다. 기존 API가 반환하는 `isCompleted`를 사용하며 API, DB, 2/3 완료 기준, 색상 값, 구매·재생 분기 및 디렉터리 책임은 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | completed-episode-highlight | `front/src/screens/DramaDetailScreen.tsx`, `front/tests/unit/dramaDetailScreen.test.ts` | 배경색 조건을 시청 완료 여부로 변경하고 null·false·true 표시 검증 |

## 실행 순서 및 병렬 작업
- `task-1`은 선행 의존성이 없는 단일 task다. 다른 task가 없어 병렬 실행 대상이 없다.

## 검증
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 기준: `watchProgress`가 null이거나 `isCompleted`가 false인 회차에는 시청 배경색이 없고, true인 회차에만 기존 색상이 표시되며 전체 프론트 검증이 통과한다.

계획 생성 단계에서는 제품 코드와 제품 검증을 실행하지 않는다. 실행 결과는 Harness 수행 시 기록한다.
