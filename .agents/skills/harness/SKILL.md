---
name: harness
description: "Dispatch approved harness tasks to workers. Use only when the user explicitly invokes $harness."
---

# Harness

Use this skill only after the user explicitly writes `$harness`. Do not edit product files yourself, commit, push, create a branch, or create a worktree.

1. Confirm the current branch is `dev`. Run `node tools/harness/cli.mjs validate` and `node tools/harness/cli.mjs status`. Stop and report any invalid schema, failed task, or ambiguous active plan.
2. Repeatedly run `node tools/harness/cli.mjs next --plan <id>`. For every `delegate` result, first run `node tools/harness/cli.mjs start --plan <id> --task <task-id>`, then dispatch exactly one `harness_worker` with the plan ID, task ID, exact file list, checks, and task document location.
3. Keep no more than three `harness_worker` agents active. Only dispatch ready tasks. The CLI schema rejects simultaneous tasks with overlapping files.
4. On the worker's exact structured JSON result, the `SubagentStop` hook records `complete` or `fail`. If hooks are unavailable, the parent must run the same CLI command itself. After each completion, call `next` and fill available worker slots.
5. On the first error, do not dispatch new work. Report the task error and use `reset` only after the user directs a retry.
6. When `next` reports `done`, report completed checks and tell the user to explicitly invoke `$finish-plan`. Never run `finish`, `git commit`, or `git push` from this skill.

Workers may change only their declared files. They must not touch `web-prototype/`, plan-state JSON, or Git state. Tests belong only in `front/tests/`, `back/test/`, and `tools/harness/` under the approved filename conventions.
