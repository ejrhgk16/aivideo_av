# task-3-document-common-structure

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-6-front-common-structure/plan.md`

## 작업

`_docs/ARCHITECTURE.md`의 프론트 디렉터리 책임을 실제 구조와 일치시킨다.

- `src/common/`을 공용 HTTP·저장소·환경·theme·utils 코드의 위치로 설명한다.
- `src/features/`이 기능별 상태·endpoint·타입을 소유한다고 설명한다.
- 이전 `src/services/`, `src/theme/`, `src/utils/` 행은 새 구조와 충돌하지 않게 제거하거나 대체한다.

변경 가능 파일은 plan-local index의 `task-3.files`만이다. 구현 파일과 `web-prototype/`은 수정하지 않는다.

완료 조건:

- 문서가 `common/`과 `features/`의 책임을 구분한다.
- `node tools/harness/cli.mjs validate --plan plan-6-front-common-structure`가 통과한다.
