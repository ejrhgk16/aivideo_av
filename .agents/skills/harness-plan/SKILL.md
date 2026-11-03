---
name: harness-plan
description: "Create an approved, executable harness plan. Use only when the user explicitly invokes $harness-plan."
---

# Harness plan

Use this skill only after the user explicitly writes `$harness-plan`. It creates task state; it does not edit product code, dispatch workers, or run Git commands.

1. The planning/main agent reads the root `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`, and applicable nested `AGENTS.md` files. Reuse their current text when already supplied in context; read missing or changed instructions as needed. Do not read or plan work under `web-prototype/`.
2. State the intended scope, non-goals, affected layers, assumptions, and verification commands. Ask for scope approval. Do not create a plan yet.
   Select checks that cover the changed behavior and affected consumers. When tests need adding or updating, separate test authoring from source implementation under the rules below. For backend REST behavior changes, assign collections, fixtures, and required test-runner changes to the test-authoring task; assign product code and affected API documents to the source task. Put the matching `npm --prefix back run test:api -- --suite <suite>` command and any needed focused unit test in the source task's `checks`, after implementation. Read `back/test/api/README.md` for the existing server and data requirements. Do not plan database resets or seed writes for read-only API verification. Keep unit tests for internal rules and boundaries that HTTP cannot reproduce without changing existing data. For front source tasks, use exact test paths with `npm --prefix front run test -- tests/unit/<feature>.test.ts`; no paths runs all discovered tests. Plan the feature-to-test mapping, why the selected checks cover the impact, and whether files, generated outputs, fixtures, or shared content permit parallel execution. When impact cannot be bounded with evidence, select full validation and record why. Documentation-only or declaration-only changes still need checks appropriate to their content. Shared files require task dependencies so their edits run sequentially.
3. After approval, propose tasks with exact repository-relative writable `files`, `depends_on`, and `checks`. Checks may read tests and related documentation without adding those files to `files`; `files` is the worker's edit boundary. Explain the feature-to-test mapping, impact rationale, data/output conditions for parallel work, any sequential dependency, and whether each task permits repetitive-work delegation under the rules below. Tasks that could run at the same time must not share an edited file or conflicting output/fixture. Include child agents in the existing concurrency budget and reserve capacity for approved delegation. Ask for task-structure approval.
4. After the second approval, create `_docs/plans/plan-N-name/` using the next numeric `N`, add its human-readable `plan.md`, create one `task-N-name.md` per task, create `_docs/plans/plan-N-name/index.json` for the task state, and add only the plan metadata entry to `_docs/plans/index.json`.

## Task responsibilities and checks

For each feature requiring test changes, plan `test authoring → source implementation and test execution`. State the role in task Markdown without adding JSON fields or a new agent type. Fix the behavior contract, entry points, and expected results in the approved task documents before authoring tests.

- The test-authoring task owns test files, fixtures, and necessary test-runner changes. It writes the tests against the approved contract without editing product code. Its `checks` cover only syntax or structure that can be verified without the planned implementation. Tests may reference the planned interfaces, but do not run feature tests or checks that load unimplemented modules, or require an expected failing test run before source implementation. If no suitable static command exists, use `checks: []` and explicitly require scenario/contract review in the completion summary. Authoring completion means the tests are ready, not that the feature has passed.
- The source task owns product code and related product/API documentation. Its `depends_on` includes the matching test-authoring task. After implementation, it runs the authored tests and relevant existing regression tests through its declared `checks`; those commands must not be left solely in the test-authoring task or deferred to finish. Test-runner changes also require selected and no-selector regression commands here. The source worker may read failing tests but must not edit or weaken them to pass; a test defect is reported with evidence for a scoped test correction. Do not complete the source task while its checks fail or remain unrun.
- Keep required reads specific to the role: approved contracts, assigned files, and direct dependencies. List tests and fixtures that a source worker may need to diagnose failures under a separate conditional-reference section; executing a test does not require reading its entire implementation first. Test authors need only relevant product interfaces or entry points, not the whole implementation.

If existing tests already cover the change without edits, keep a source task that runs them; do not create an empty authoring task. Documentation-only work also needs no artificial test/source pair. Final `$finish-plan` verification remains unchanged.

## Worker inputs and reference scope

The main agent reads the full plan and gives each worker its own task document, applicable instructions, its task index entry, and relevant dependency results. Make the task document sufficient for the assigned work: include its approved scope, non-goals, contract, exact files, checks, and completion criteria. Do not require every worker to reread common documents in full.

- `AGENTS.md`: always applies. Reuse authoritative instructions already supplied in the worker's context; reread only missing or changed instructions, including applicable nested files. A summary does not replace instructions that were never supplied.
- `_docs/ARCHITECTURE.md`: reference the relevant section when changing structure or file responsibility, judging layer boundaries, or resolving missing architectural context. Preserve the project's requirement to read it before structural/responsibility changes; do not make unrelated sections mandatory for every task.
- `plan.md`: the main agent reads the whole document. Workers use the contract, scope, dependencies, and relevant results provided with their task. Refer to a named plan section only when needed to resolve an omission or conflict rather than guessing.

Required file lists contain assigned files and direct dependencies with relevant sections. Put common documents under conditional references with the reason to consult them; do not copy a mandatory `AGENTS.md`, `ARCHITECTURE.md`, or full `plan.md` reread into every task.

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
| 1 | 테스트 작성 | `front/tests/unit/example.test.ts` | 승인된 계약에 대한 테스트 작성·시나리오 검토 |
| 2 | 소스 구현·검증 | `front/src/example.ts` | 구현 후 task-1의 테스트와 관련 회귀 테스트 실행 |

## 실행 순서 및 병렬 작업
- `task-2`는 `task-1` 완료 후 실행: 테스트 작성 후 소스 구현과 테스트 실행.
- 서로 다른 기능의 task는 수정 파일·출력·fixture가 독립적인 경우 병렬 실행할 수 있음.
```

모든 task의 실행 관계를 이 섹션에 적는다. 의존성이 없는 task도 병렬 실행 가능 여부와 이유를 명시한다. 반복 작업의 2뎁스 위임을 허용하는 task와 그 이유, 하위 에이전트를 포함한 동시 실행 예산을 함께 명시한다.

`task-N-name.md`:

```markdown
# task-{n}-{name}

## 기본 입력
- 이 task 문서와 index.json의 해당 task 항목
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약

## 읽어야 할 파일
- {담당 파일과 직접 의존 파일의 필요한 구간만 명시한다. 이미 전달된 공통 지침·전체 plan의 재조회를 요구하지 않는다.}

## 필요 시 참고할 문서
- {누락·변경된 적용 AGENTS.md, 구조·책임·경계 판단에 필요한 ARCHITECTURE.md 섹션, 계약 누락·충돌 확인에 필요한 plan.md 섹션을 각각 확인 조건과 함께 명시한다.}

## 실패 시 참고할 파일
- {소스 task에서 테스트 실패를 분석할 때만 읽을 관련 테스트·fixture와 필요한 구간. 실행만을 위해 전체 읽기를 요구하지 않는다.}

## 작업
{작업 목표 요약}

### 역할과 완료 조건
{테스트 작성 또는 소스 구현 역할, 해당 범위·비목표·승인된 계약, 선행 task, 수정 파일 범위, checks와 완료 조건. 테스트 작성 task는 동작 테스트 실행 없이 작성·정적 검사·계약 검토를 완료한다. 소스 task는 구현 후 작성된 테스트와 관련 회귀 검사를 통과해야 한다.}

{구현 지시}

### 반복 작업 위임
{허용 또는 불가와 이유. 허용 시 동일한 수정 패턴, 부모와 각 하위 에이전트의 겹치지 않는 정확한 파일 목록, 부모의 통합·검증 책임을 명시한다.}

### 주요 로직 코드 또는 변경 예시
{실질적인 로직을 구현하는 task: 핵심 상태·이벤트·데이터 흐름과 호출 지점을 보여주는 fenced code block. 테스트 작성 task는 검증할 동작과 핵심 테스트 코드를 제시한다. 핵심 동작을 TODO나 주석으로 대체하지 않는다. 한 줄 수정·선언·설정·문서 변경처럼 코드 흐름을 설명할 필요가 없는 task: 코드 블록을 강제하지 말고 변경할 파일과 정확한 값·문구 또는 전후 차이, 변경 이유를 적는다. 새 로직이 없다면 그 사실을 명시한다.}
```

각 task 문서는 해당 worker에게 전달할 정확한 파일 범위, 검증 명령, 완료 조건을 `## 작업` 아래에 함께 명시한다.

Before running `validate`, reopen every new `task-*.md` and check that substantive logic tasks include their main logic code, while small or non-code tasks state the exact edit and why no new logic is needed. Compare the content with the declared `files`, scope, and completion criteria. Check that test/source files are assigned separately, source tasks depend on their authored tests, behavioral checks belong to source tasks, authoring completion does not imply test success, and required reads are limited to the role. Verify that each task provides enough contract/scope context without a full-plan reread, and common-document references name a relevant section and consultation condition. For delegation, also verify repetitive-work eligibility, disjoint file assignments within the task scope, the concurrency budget, and the parent's integration and verification responsibility. Fix omissions before reporting the plan complete. `validate` checks the plan indexes, not task Markdown content; a passing result does not satisfy this review.

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
    "name": "테스트 작성",
    "status": "pending",
    "depends_on": [],
    "files": ["front/tests/unit/example.test.ts"],
    "checks": []
  }, {
    "id": "task-2",
    "name": "소스 구현 및 테스트 실행",
    "status": "pending",
    "depends_on": ["task-1"],
    "files": ["front/src/example.ts"],
    "checks": ["npm --prefix front run test -- tests/unit/example.test.ts"]
  }]
}
```

Never put `tasks` in the root plans index. The `plan_id` in the plan-local index must match its root plan entry.

The empty authoring `checks` above assumes no suitable static command; the task Markdown must still require contract/scenario review and name the source task that executes the tests.

Use only `pending`, `in_progress`, `completed`, `error`, or `blocked` for task status. Do not list `web-prototype/`. Test files may only be in `front/tests/**/*.test.ts(x)`, `back/test/api/**/*.postman_collection.json`, `back/test/unit/**/*.spec.ts`, or `tools/harness/**/*.test.mjs`.

Run `node tools/harness/cli.mjs validate --plan <id>` after writing the plan. Report the plan ID and that the user can explicitly invoke `$harness` next.
