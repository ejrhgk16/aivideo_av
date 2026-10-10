---
name: harness
description: "Dispatch approved harness tasks to workers. Use only when the user explicitly invokes $harness."
---

# Harness

Use this skill only after the user explicitly writes `$harness`. Do not edit product files yourself, commit, push, create a branch, or create a worktree.

1. Confirm the current branch is `dev`. Run `node tools/harness/cli.mjs validate` and `node tools/harness/cli.mjs status`. The CLI validates the root plan catalog and every plan-local `_docs/plans/<plan>/index.json`. Stop and report any invalid schema, blocked task, or ambiguous active plan; an `error` task follows step 5's retry flow.
2. Repeatedly run `node tools/harness/cli.mjs next --plan <id>`. For every `delegate` result, first run `node tools/harness/cli.mjs start --plan <id> --task <task-id>`, then dispatch exactly one `harness_worker` with the plan ID, task ID, exact file list, checks, and task document location.
3. Keep no more than three `harness_worker` agents active. Only dispatch ready tasks. The CLI schema rejects simultaneous tasks with overlapping files.
4. On the worker's exact structured JSON result, the `SubagentStop` hook records `complete` or `fail`. If hooks are unavailable, the parent must record that result itself using the required non-empty worker summary or error; do not omit either argument:

   ```powershell
   node tools/harness/cli.mjs complete --plan <id> --task <task-id> --summary "<worker completion summary>"
   node tools/harness/cli.mjs fail --plan <id> --task <task-id> --error "<worker failure message>"
   ```

   After each completion, call `next` and fill available worker slots.
5. On an error, do not dispatch unrelated new work. The parent must preserve the failure message, run `node tools/harness/cli.mjs retry --plan <id> --task <task-id>`, and redispatch the same task with the previous failure context so the worker fixes the cause and reruns the declared checks. Retry up to three consecutive failures automatically. A third consecutive failure changes the task to `blocked`; report it to the user and wait for direction before resetting it.
6. When `next` reports `done`, report completed checks and tell the user to explicitly invoke `$finish-plan`. Never run `finish`, `git commit`, or `git push` from this skill.

Workers may change only their declared files. They must not touch `web-prototype/`, `_docs/plans/index.json`, plan-local task state JSON, or Git state. Tests belong only in `front/tests/`, `back/test/`, and `tools/harness/` under the approved filename conventions.
