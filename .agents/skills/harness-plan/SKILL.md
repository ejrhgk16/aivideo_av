---
name: harness-plan
description: "Create an approved, executable harness plan. Use only when the user explicitly invokes $harness-plan."
---

# Harness plan

Use this skill only after the user explicitly writes `$harness-plan`. It creates task state; it does not edit product code, dispatch workers, or run Git commands.

1. Read the root `AGENTS.md`, `_docs/ARCHITECTURE.md`, `_docs/plans/README.md`, and applicable nested `AGENTS.md` files. Do not read or plan work under `web-prototype/`.
2. State the intended scope, non-goals, affected layers, assumptions, and verification commands. Ask for scope approval. Do not create a plan yet.
3. After approval, propose tasks with exact repository-relative `files`, `depends_on`, and `checks`. Explain any sequential dependency. Tasks that could run at the same time must not share a file. Ask for task-structure approval.
4. After the second approval, create `_docs/plans/plan-N-name/` using the next numeric `N`, add its human-readable `plan.md`, and add a plan entry to `_docs/plans/index.json`.

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
