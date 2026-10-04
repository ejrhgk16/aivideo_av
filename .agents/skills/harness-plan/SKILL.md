---
name: harness-plan
description: "Create an approved, executable harness plan. Use only when the user explicitly invokes $harness-plan."
---

# Harness plan

Use this skill only after the user explicitly writes `$harness-plan`. It creates task state; it does not edit product code, dispatch workers, or run Git commands.

1. Read the root `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`, and applicable nested `AGENTS.md` files. Do not read or plan work under `web-prototype/`.
2. State the intended scope, non-goals, affected layers, assumptions, and verification commands. Ask for scope approval. Do not create a plan yet.
3. After approval, propose tasks with exact repository-relative `files`, `depends_on`, and `checks`. Explain any sequential dependency. Tasks that could run at the same time must not share a file. Ask for task-structure approval.
4. After the second approval, create `_docs/plans/plan-N-name/` using the next numeric `N`, add its human-readable `plan.md`, create one `task-N-name.md` per task, and add a plan entry to `_docs/plans/index.json`.

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

모든 task의 실행 관계를 이 섹션에 적는다. 의존성이 없는 task도 병렬 실행 가능 여부와 이유를 명시한다.

`task-N-name.md`:

```markdown
# task-{n}-{name}

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- {이 task에 적용되는 하위 `AGENTS.md` 및 구현 참고 파일}

## 작업
{작업 목표 요약}

{구현 지시와 주요 로직코드}
```

각 task 문서는 해당 worker에게 전달할 정확한 파일 범위, 검증 명령, 완료 조건을 `## 작업` 아래에 함께 명시한다.

The index entry uses this shape:

```json
{
  "id": "plan-1-example",
  "directory": "plan-1-example",
  "title": "Example",
  "status": "draft",
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

Use only `pending`, `in_progress`, `completed`, or `error` for task status. Do not list `web-prototype/`. Test files may only be in `front/tests/**/*.test.ts(x)`, `back/test/unit/**/*.spec.ts`, or `tools/harness/**/*.test.mjs`.

Run `node tools/harness/cli.mjs validate --plan <id>` after writing the plan. Report the plan ID and that the user can explicitly invoke `$harness` next.
