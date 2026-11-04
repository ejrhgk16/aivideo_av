---
name: harness-plan
description: "Create an approved, executable harness plan. Use only when the user explicitly invokes $harness-plan."
---

# Harness plan

Use this skill only after the user explicitly writes `$harness-plan`. It creates task state; it does not edit product code, dispatch workers, or run Git commands.

1. The planning/main agent reads the root `AGENTS.md`, `_docs/ARCHITECTURE.md`, and [common task rules](../../../_docs/plans/README.md). Reuse their current text when supplied in context; read missing or changed instructions as needed. Do not read or plan work under `web-prototype/`.
2. State the intended scope, non-goals, affected layers, assumptions, and verification commands. Ask for scope approval. Do not create a plan yet.
   Map changed behavior and affected consumers to focused checks using the common role/verification rules. For backend work read [backend verification](../../../back/README.md#검증); for frontend selectors read [frontend verification](../../../front/README.md#검증). Record the impact rationale, required data, outputs/fixtures, and parallel/sequential conditions. If impact cannot be bounded, select full verification and explain why.
3. After approval, define the shared contracts below and propose exact writable `files`, `depends_on`, and `checks`. Apply the common rules for role separation and task sizing: bound each task's required reading and distinct responsibilities, including within test authoring. Separate checks runnable during authoring from checks requiring future product implementation; name the latter's source task and implementation prerequisite in the task document. Apply the common rules for existing-implementation test-only tasks, shared-file sequencing, and repetitive-work delegation with reserved child capacity. Ask for approval of the contracts and task structure together.
4. After the second approval, create `_docs/plans/plan-N-name/` using the next numeric `N`, add its human-readable `plan.md`, create one `task-N-name.md` per task, create `_docs/plans/plan-N-name/index.json` for the task state, and add only the plan metadata entry to `_docs/plans/index.json`.

## Shared contracts before task execution

Before task-structure approval, inspect existing entry points and consumers, then fix each new or changed boundary used by multiple tasks or by tests and source. Record it once in a named `plan.md` contract section with a stable ID. Preserve existing contracts unless the requested change requires otherwise; omit irrelevant fields and do not design private implementation details in advance.

- **Identity and ownership:** exact component/function/type name, repository-relative definition path, named/default export, consuming call site, and task responsible for the definition. If a shared definition must exist before consumers run, declare that dependency.
- **Inputs and outputs:** a concrete signature/type definition in the target language for code interfaces; props/arguments, required versus optional fields, defaults, return values, and callback names and payload types. State who owns mutable state and whether inputs are controlled when relevant.
- **Observable behavior:** trigger → visible result or side effect, callback timing and call count, and relevant loading, empty, error, disabled, or navigation/focus behavior. Name user-facing labels or accessibility roles where they form part of the acceptance criteria. Resolve behavior-affecting ambiguity before approving dependent tasks.
- **Test boundaries and data:** actual runner/library versions and existing helpers to reuse; exact imports and external mock targets; API/fixture shapes and relevant error results; required initial state, event order, and observable async completion. Inspect existing exports and test APIs before using them. Distinguish approved future interfaces from existing ones; do not invent unplanned exports, test-only product props, or internal call counts to make tests convenient. Use the applicable testing skill for rendering, mocks, and async handling rather than restating those rules here.
- **Consumers and verification:** task IDs using the contract, representative input → expected result scenarios, and the tests/checks that verify them. For non-code changes, specify the exact shared artifact and expected result instead of inventing props or signatures.

Each task carries the contract ID and the exact relevant signature/behavior excerpt, sufficient for that worker without a full-plan reread. The plan section is authoritative; review task excerpts and code examples against it to prevent divergent copies. Workers must not invent missing names, props, or behavior, or silently change the contract to fit their implementation. If a conflict appears, hold affected tasks, resolve it centrally, update the contract and all affected task inputs, and obtain renewed approval if the approved scope or behavior changes before resuming those tasks.

## Document structures

Use the common rules for state JSON, role-specific worker inputs, and delegation. Keep the following plan/task structures sufficient for independent execution.

`plan.md`:

```markdown
# {plan-name}

## 목표
{plan의 전체적인 내용}

## 공통 계약
### {contract-id}: {경계 이름}
{정의 경로·export·담당 task·소비 task, 정확한 타입/시그니처, 입력 → 기대 결과, 테스트 경계·데이터·검증 기준. 해당하는 항목만 작성한다.}

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
{미구현 기능 테스트 작성, 소스 구현, 기존 구현 테스트 전용 등의 역할과 범위·비목표·승인된 계약·선행 task·수정 파일·checks·완료 조건. 테스트 작성은 바로 실행할 검사와 제품 구현 때문에 유예할 검사·필요한 구현·담당 소스 task를 구분한다. 전체 회귀 검사를 선언한 task는 선택 검사로 수정한 뒤 최종 변경에 전체 검사를 실행하도록 순서를 명시한다. 역할별 자체 검토·완료 보고는 플랜 공통 규칙을 따른다.}

### 적용 계약
{plan.md의 계약 ID와 이 task에 필요한 정확한 시그니처·동작 발췌. 다른 task의 타입·호출 예시와 일치해야 한다. 공유 경계 변경이 없으면 해당 없음을 명시한다.}

{구현 지시}

### 반복 작업 위임
{허용 또는 불가와 이유. 허용 시 동일한 수정 패턴, 부모와 각 하위 에이전트의 겹치지 않는 정확한 파일 목록, 부모의 통합·검증 책임을 명시한다.}

### 주요 로직 코드 또는 변경 예시
{실질적인 로직을 구현하는 task: 핵심 상태·이벤트·데이터 흐름과 호출 지점을 보여주는 fenced code block. 테스트 작성 task는 검증할 동작과 핵심 테스트 코드를 제시한다. 핵심 동작을 TODO나 주석으로 대체하지 않는다. 한 줄 수정·선언·설정·문서 변경처럼 코드 흐름을 설명할 필요가 없는 task: 코드 블록을 강제하지 말고 변경할 파일과 정확한 값·문구 또는 전후 차이, 변경 이유를 적는다. 새 로직이 없다면 그 사실을 명시한다.}
```

각 task 문서는 해당 worker에게 전달할 정확한 파일 범위, 검증 명령, 완료 조건을 `## 작업` 아래에 함께 명시한다.

Before `validate`, reopen each new task document and review its exact edits/main logic, files, role, checks, and completion criteria against the common rules. Check task size using required reading and distinct responsibilities. Existing-implementation test-only tasks must execute their tests; unimplemented-feature authoring tasks execute independent checks and defer only checks needing future product implementation to the named source task. Compare every contract excerpt and code example against the authoritative plan section. Resolve mismatched names, exports, types, defaults, callback payloads, or behavior before approval. Verify conditional reading references, dependency/parallel conditions, and any child file/slot assignments and integration responsibility. `validate` checks indexes, not task Markdown; passing it does not replace this review.

Run `node tools/harness/cli.mjs validate --plan <id>` after writing the plan. Report the plan ID and that the user can explicitly invoke `$harness` next.
