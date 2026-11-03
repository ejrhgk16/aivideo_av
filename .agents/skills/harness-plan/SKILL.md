---
name: harness-plan
description: "Create an approved, executable harness plan. Use only when the user explicitly invokes $harness-plan."
---

# Harness plan

Use this skill only after the user explicitly writes `$harness-plan`. It creates task state; it does not edit product code, dispatch workers, or run Git commands.

1. Read the root `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`, and applicable nested `AGENTS.md` files. Do not read or plan work under `web-prototype/`.
2. State the intended scope, non-goals, affected layers, assumptions, and verification commands. Ask for scope approval. Do not create a plan yet.
   Select checks that cover the changed behavior and affected consumers. For backend REST behavior changes, include the affected API document and collection files in the task's writable `files`, and declare the matching `npm --prefix back run test:api -- --suite <suite>` command plus any needed focused unit test. Read `back/test/api/README.md` for the existing server and data requirements. Do not plan database resets or seed writes for read-only API verification. Keep unit tests for internal rules and boundaries that HTTP cannot reproduce without changing existing data. For front changes, use exact test paths with `npm --prefix front run test -- tests/unit/<feature>.test.ts`; no paths runs all discovered tests. Plan the feature-to-test mapping, why the selected checks cover the impact, and whether files, generated outputs, fixtures, or shared content permit parallel execution. When impact cannot be bounded with evidence, select full validation and record why. Documentation-only or declaration-only changes still need checks appropriate to their content. Shared files require task dependencies so their edits run sequentially.
3. After approval, propose tasks with exact repository-relative writable `files`, `depends_on`, and `checks`. Checks may read tests and related documentation without adding those files to `files`; `files` is the worker's edit boundary. Explain the feature-to-test mapping, impact rationale, data/output conditions for parallel work, any sequential dependency, and whether each task permits repetitive-work delegation under the rules below. Tasks that could run at the same time must not share an edited file or conflicting output/fixture. Include child agents in the existing concurrency budget and reserve capacity for approved delegation. Ask for task-structure approval.
4. After the second approval, create `_docs/plans/plan-N-name/` using the next numeric `N`, add its human-readable `plan.md`, create one `task-N-name.md` per task, create `_docs/plans/plan-N-name/index.json` for the task state, and add only the plan metadata entry to `_docs/plans/index.json`.

## Repetitive-work delegation

Allow depth 2 only for repetitive work: the same established edit pattern applied to independent files without separate design decisions. Count the main agent as depth 0, the task worker as depth 1, and its child as depth 2. All other tasks stay at depth 1.

For each permitted task, record the repeated edit pattern, exact disjoint file assignments within the task's `files`, and integration and verification responsibility. The task worker establishes the pattern before delegating, retains shared-file edits, integrates child results, runs the task's declared checks, and returns the final task result. Use `harness_repeater` for children; they may edit only their assigned files, must not delegate further or change task state, and report only to their parent. Do not use `harness_worker` for children, because its stop hook updates the whole task's state.

Keep this breakdown in `plan.md` and `task-*.md`; children are not separate plan tasks and require no JSON fields or script changes.

Use these document structures.

`plan.md`:

```markdown
# {plan-name}

## 목표
{plan의 전체적인 내용}

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | setup | `src/types/`, `package.json` | Dog 기본 타입 정의, Vite 빌드 환경 구성 |

## 실행 순서 및 병렬 작업
- `task-1`과 `task-2`는 병렬 실행 가능: 대상 파일이 겹치지 않음.
- `task-3`은 `task-1` 완료 후 실행: {의존 이유}.
```

모든 task의 실행 관계를 이 섹션에 적는다. 의존성이 없는 task도 병렬 실행 가능 여부와 이유를 명시한다. 반복 작업의 2뎁스 위임을 허용하는 task와 그 이유, 하위 에이전트를 포함한 동시 실행 예산을 함께 명시한다.

`task-N-name.md`:

```markdown
# task-{n}-{name}

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- {이 task에 적용되는 하위 `AGENTS.md` 및 구현 참고 파일}

## 작업
{작업 목표 요약}

{구현 지시}

### 반복 작업 위임
{허용 또는 불가와 이유. 허용 시 동일한 수정 패턴, 부모와 각 하위 에이전트의 겹치지 않는 정확한 파일 목록, 부모의 통합·검증 책임을 명시한다.}

### 주요 로직 코드 또는 변경 예시
{실질적인 로직을 구현하는 task: 핵심 상태·이벤트·데이터 흐름과 호출 지점을 보여주는 fenced code block. 핵심 동작을 TODO나 주석으로 대체하지 않는다. 한 줄 수정·선언·설정·문서 변경처럼 코드 흐름을 설명할 필요가 없는 task: 코드 블록을 강제하지 말고 변경할 파일과 정확한 값·문구 또는 전후 차이, 변경 이유를 적는다. 새 로직이 없다면 그 사실을 명시한다.}
```

각 task 문서는 해당 worker에게 전달할 정확한 파일 범위, 검증 명령, 완료 조건을 `## 작업` 아래에 함께 명시한다.

Before running `validate`, reopen every new `task-*.md` and check that substantive logic tasks include their main logic code, while small or non-code tasks state the exact edit and why no new logic is needed. Compare the content with the declared `files`, scope, and completion criteria. For delegation, also verify repetitive-work eligibility, disjoint file assignments within the task scope, the concurrency budget, and the parent's integration and verification responsibility. Fix omissions before reporting the plan complete. `validate` checks the plan indexes, not task Markdown content; a passing result does not satisfy this review.

The root `_docs/plans/index.json` entry uses this shape:

```json
{
  "id": "plan-1-example",
  "directory": "plan-1-example",
  "title": "Example",
  "status": "draft"
}
```

The plan-local `_docs/plans/plan-1-example/index.json` uses this shape:

```json
{
  "version": 1,
  "plan_id": "plan-1-example",
  "tasks": [{
    "id": "task-1",
    "name": "Concise task name",
    "status": "pending",
    "depends_on": [],
    "files": ["front/src/example.ts", "front/tests/unit/example.test.ts"],
    "checks": ["npm --prefix front run test"]
  }]
}
```

Never put `tasks` in the root plans index. The `plan_id` in the plan-local index must match its root plan entry.

Use only `pending`, `in_progress`, `completed`, `error`, or `blocked` for task status. Do not list `web-prototype/`. Test files may only be in `front/tests/**/*.test.ts(x)`, `back/test/api/**/*.postman_collection.json`, `back/test/unit/**/*.spec.ts`, or `tools/harness/**/*.test.mjs`.

Run `node tools/harness/cli.mjs validate --plan <id>` after writing the plan. Report the plan ID and that the user can explicitly invoke `$harness` next.
