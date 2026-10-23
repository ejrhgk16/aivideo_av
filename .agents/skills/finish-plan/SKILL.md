---
name: finish-plan
description: "Verify and publish a completed harness plan. Use only when the user explicitly invokes $finish-plan."
---

# Finish plan

Use this skill only after the user explicitly writes `$finish-plan`. This is the only harness skill that may commit and push.

1. Confirm the current branch is `dev` and run `node tools/harness/cli.mjs validate` plus `node tools/harness/cli.mjs status`. Validation covers the root plan catalog and the selected plan's local task index. Use a plan ID explicitly named by the user. If none is named, select the last `status: "completed"` entry in `_docs/plans/index.json` as the most recently completed plan.
2. Run `node tools/harness/cli.mjs finish --plan <id> [--message "..."]` directly. On the first attempt, invoke the command through Codex `exec_command` with `sandbox_permissions: "require_escalated"` so it can write `.git/index.lock` for the commit; this is a tool permission setting, not a CLI flag. The default commit message is `chore(harness): finish <plan-id>`, where `<plan-id>` is the selected plan's `id`; an explicit `--message` overrides it. Do not substitute manual Git commands.
3. The CLI runs declared checks only for tasks whose files target `front/` or `back/`, plus the relevant front/back full checks. It does not reject dirty files outside those check scopes; all non-ignored Git changes are staged and committed, including `_docs/plans` and Harness files. Gitignored files remain untracked and are not committed.
4. Report the commit/push outcome and any check failure exactly. Do not retry a failed validation by widening task files without a new approved `$harness-plan` revision.
