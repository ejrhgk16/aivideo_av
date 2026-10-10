# front-common-structure

## 목표

프론트 공용 기술 코드를 `src/common/`으로 모으고, 홈 콘텐츠 API 호출·타입을 `src/features/home/`으로 이동해 기능 코드와 공용 코드를 분리한다.

## 범위

- 기존 `src/services/`의 실제 공용 파일을 `src/common/` 하위 책임별 경로로 이동한다.
- 기존 `src/theme/`을 `src/common/theme/`으로 이동한다.
- 기존 `src/services/homeContent.ts`를 `src/features/home/homeContent.ts`으로 이동한다.
- 이동으로 변경되는 import와 테스트 import를 갱신한다.
- 프론트 아키텍처 책임과 경로를 문서에 반영한다.

## 비목표

- UI, 상태, API endpoint·응답 계약, 요청·오류 처리 동작을 변경하지 않는다.
- 공통 API client 같은 새 추상화 계층을 추가하지 않는다.
- 현재 추적 파일이 없는 빈 `utils/`, `services/api/`, `services/config/`, `services/storage/` 폴더의 placeholder를 만들지 않는다.
- `web-prototype/`은 변경하거나 검증하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | common-layer-restructure | 기존 공용 service·theme 파일, 해당 import 소비처, media 테스트 | 공용 파일을 `common/`으로 이동하고 camelCase 파일명을 적용한다. |
| 2 | home-feature-relocation | 기존·새 homeContent 파일, HomeScreen, 홈 API 테스트 | 홈 콘텐츠 endpoint·타입을 `features/home/`으로 이동한다. |
| 3 | document-common-structure | `_docs/ARCHITECTURE.md` | 새 `common/`·`features/` 책임을 문서화한다. |

## 실행 순서 및 병렬 작업

- `task-1`은 공용 레이어와 `HomeScreen.tsx`의 theme import를 변경한다.
- `task-2`는 `HomeScreen.tsx`의 home content import를 변경하므로 `task-1` 완료 후 실행한다. 두 task가 같은 파일을 변경하므로 병렬 실행하지 않는다.
- `task-3`은 실제 파일 이동이 모두 끝난 뒤 최종 구조를 문서화하므로 `task-1`, `task-2` 완료 후 실행한다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- `node tools/harness/cli.mjs validate --plan plan-6-front-common-structure`
