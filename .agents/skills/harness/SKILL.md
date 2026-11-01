---
name: harness
description: "Dispatch approved harness tasks to workers. Use only when the user explicitly invokes $harness."
---

# Harness

Use this skill only after the user explicitly writes `$harness`. Do not edit product files yourself, commit, push, create a branch, or create a worktree.

1. Confirm the current branch is `dev`. Run `node tools/harness/cli.mjs validate` and `node tools/harness/cli.mjs status`. The CLI validates the root plan catalog and every plan-local `_docs/plans/<plan>/index.json`. Stop and report any invalid schema, blocked task, or ambiguous active plan; an `error` task follows step 5's retry flow.
2. Repeatedly run `node tools/harness/cli.mjs next --plan <id>`. For every `delegate` result, first run `node tools/harness/cli.mjs start --plan <id> --task <task-id>`, then dispatch exactly one `harness_worker` with the plan ID, task ID, exact file list, checks, and task document location.
3. Keep no more than three `harness_worker` agents active. Only dispatch ready tasks. The CLI schema rejects simultaneous tasks with overlapping files. Dispatch independent tasks in parallel only when edited files, generated outputs, and test fixtures do not conflict. Front test outputs are created per run; managed backend suites use run-specific fixtures and shared/exclusive content locks. External `API_TEST_ENVIRONMENT_FILE` runs take an exclusive lock for their effective API base URL. Respect lock waits; do not start overlapping content checks outside this coordination.
4. On the worker's exact structured JSON result, the `SubagentStop` hook records `complete` or `fail`. If hooks are unavailable, the parent must record that result itself using the required non-empty worker summary or error; do not omit either argument:

   ```powershell
   node tools/harness/cli.mjs complete --plan <id> --task <task-id> --summary "<worker completion summary>"
   node tools/harness/cli.mjs fail --plan <id> --task <task-id> --error "<worker failure message>"
   ```

   After each completion, call `next` and fill available worker slots.
5. On an error, do not dispatch unrelated new work. The parent must preserve the failure message, run `node tools/harness/cli.mjs retry --plan <id> --task <task-id>`, and redispatch the same task with the previous failure context so the worker fixes the cause and reruns the declared checks. Retry up to three consecutive failures automatically. A third consecutive failure changes the task to `blocked`; report it to the user and wait for direction before resetting it.
6. When `next` reports `done`, report completed checks and tell the user to explicitly invoke `$finish-plan`. Never run `finish`, `git commit`, or `git push` from this skill.

Workers may change only their declared files. They must not touch `web-prototype/`, `_docs/plans/index.json`, plan-local task state JSON, or Git state. Tests belong only in `front/tests/`, `back/test/`, and `tools/harness/` under the approved filename conventions.

Workers run the task's declared feature checks and report each result. Do not replace selected checks with broader or unrelated full validation; choose full validation in the plan when the change's impact cannot be bounded with evidence. Backend `npm --prefix back run test:api -- --suite <suite>` runs the selected Postman HTTP suite against the existing development API and its real MySQL database. Before backend checks, confirm the server reflects the changed code and follow `back/test/api/README.md`. The managed runner creates and cleans run-specific fixtures; it does not reset or seed the database. Wait for content locks; a wait is neither a pass nor a failure until acquired, while lock acquisition timeout/failure, unavailable servers, unmet data requirements, failed assertions, cleanup failures, and checks that were not run are failures. Shared API collection edits must be sequenced through task dependencies. `$finish-plan` runs task checks and full verification for changed products: frontend typecheck/test/export for frontend changes and backend lint/test/build for backend changes; task checks may run again there. Never report final completion while a declared check is outstanding.
