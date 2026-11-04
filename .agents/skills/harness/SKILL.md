---
name: harness
description: "Dispatch approved harness tasks to workers. Use only when the user explicitly invokes $harness."
---

# Harness

Use this skill only after the user explicitly writes `$harness`. Do not edit product files yourself, commit, push, create a branch, or create a worktree.

Read the [common task rules](../../../_docs/plans/README.md) for roles/checks, contract and reading scope, test-defect correction, and concurrency/delegation. They are authoritative; do not reproduce them in this workflow.

1. Confirm the current branch is `dev`. Run `node tools/harness/cli.mjs validate` and `node tools/harness/cli.mjs status`. Stop and report invalid schema, blocked tasks, or an ambiguous active plan; an `error` task follows step 5.
2. Repeatedly run `node tools/harness/cli.mjs next --plan <id>`. For each `delegate`, verify its contract and inputs, then run `node tools/harness/cli.mjs start --plan <id> --task <task-id>`. Dispatch exactly one `harness_worker` with plan/task IDs, task document, exact files/checks, declared role, required reads, conditional references, root instructions, relevant common task rules, and dependency results. Include the approved contract ID and exact relevant excerpt checked against plan.md. Resolve omissions before starting affected work.
3. Fill available slots only with ready, independent tasks under the common concurrency rules. Include approved repetitive-work details and an explicit child-slot allocation in each dispatch; default to zero. Respect output/fixture conflicts and backend content locks.
4. On the worker's exact structured JSON result, the `SubagentStop` hook records `complete` or `fail`. If hooks are unavailable, the parent must record that result itself using the required non-empty worker summary or error; do not omit either argument:

   ```powershell
   node tools/harness/cli.mjs complete --plan <id> --task <task-id> --summary "<worker completion summary>"
   node tools/harness/cli.mjs fail --plan <id> --task <task-id> --error "<worker failure message>"
   ```

   After each completion, call `next` and fill available worker slots while preserving child-slot reservations for unfinished tasks.
5. On an error, do not dispatch unrelated new work. Preserve its failure context. If it is a test defect outside the source task's scope, use the common test-defect correction procedure before redispatching. For other failures, run `node tools/harness/cli.mjs retry --plan <id> --task <task-id>` and redispatch the same task with that context to fix the cause and rerun its checks. Automatically retry after the first and second consecutive failures. A third changes the task to `blocked`; report it and wait for user direction before resetting it. Contract/scope changes follow the common renewed-approval rule.
6. When `next` reports `done`, report completed checks and tell the user to explicitly invoke `$finish-plan`. Never run `finish`, `git commit`, or `git push` from this skill.

Workers may edit only their declared files and never `web-prototype/`, plan/task state JSON, or Git state. Require each declared check's result and the role's completion evidence; test authoring alone does not establish feature success. Test-only tasks against existing implementation must execute their tests.

Before API checks, confirm the existing server reflects current code and follow [backend verification](../../../back/README.md#검증). Do not reset/seed the database or start servers. Do not mark a task complete while a check is outstanding. Final full-check selection and separate checks are defined in the common rules' Finish section.
