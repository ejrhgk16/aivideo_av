---
name: finish-plan
description: "Verify and publish a completed harness plan. Use only when the user explicitly invokes $finish-plan."
---

# Finish plan

Use this skill only after the user explicitly writes `$finish-plan`. This is the only harness skill that may commit and push.

1. Confirm the current branch is `dev` and run `node tools/harness/cli.mjs validate` plus `node tools/harness/cli.mjs status`.
2. Run `node tools/harness/cli.mjs finish --plan <id> [--message "..."]` directly. The default commit message is `chore(harness): finish <plan-id>`, where `<plan-id>` is the currently finished plan's `id` from `_docs/plans/index.json`; an explicit `--message` overrides it. Do not substitute manual Git commands.
3. The CLI stops if any task is incomplete or errored, if any dirty file is undeclared, or if `web-prototype/` is dirty. It runs the plan checks and the relevant front/back full checks, stages only declared task files plus that plan's state files, creates one commit, and pushes `origin/dev`.
4. Report the commit/push outcome and any check failure exactly. Do not retry a failed validation by widening task files without a new approved `$harness-plan` revision.
