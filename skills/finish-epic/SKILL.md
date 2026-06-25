---
name: finish-epic
description: >
  Verify and hand off a Linear tracker epic after all tasks are complete. Use when the user says
  "finish the epic", "we're done", "close out the epic", all tasks are done and the user wants to
  close it, or execute-plan detects all acceptance criteria appear met. Runs final verification,
  checks acceptance criteria with evidence, optionally writes a minimal outcome summary to Linear,
  and hands off to review/PR. Linear's GitHub integration closes the epic when the PR merges; cape
  never sets Linear status.
---

<skill_overview> The final step in the build chain. Verify every acceptance criterion, run project
checks, hand off to review/PR, and report what shipped. cape never sets Linear status: Linear's
GitHub integration moves the epic to `Done` when the PR (referencing it with `Fixes ABU-XX`) merges.

Core contract: only hand off when every acceptance criterion has evidence. </skill_overview>

<rigidity_level> MEDIUM FREEDOM -- The evidence gate and automated checks are fixed. cape never
writes Linear status. Verification details adapt to the repository. </rigidity_level>

<when_to_use>

- All tasks in a tracker epic are completed
- User says "finish the epic", "we're done", "close it out", "wrap this up"
- execute-plan detects no ready tasks remain and acceptance criteria appear met
- User references an epic ID and wants closure

**Don't use for:**

- Tasks still need implementation (use execute-plan)
- Epic does not exist yet (use brainstorm then write-plan)
- Git operations like PRs or pushes

</when_to_use>

<critical_rules>

1. **All tasks must be complete** -- do not skip open tasks just to hand off the epic
2. **All automated checks must pass** -- run the repository's required verification
3. **All acceptance criteria need evidence** -- cite tests, files, or behavior
4. **Stop on failure** -- report missing evidence or failing checks instead of handing off
5. **Never set Linear status** -- Linear's GitHub integration closes the epic when the PR merges
6. **Keep outcome minimal** -- detailed outcome stays in session; Linear gets only a concise durable
   summary when useful, written description-only via `save_issue` (not a status change)

</critical_rules>

<the_process>

## Step 1: Confirm completion from cache

Read `hooks/context/tracker.json` and locate the epic. Confirm every child task has a completed
state type or a done-like status.

If the epic itself is already `Done` (the PR merged before this ran), the work is closed: run
`cape workspace phase done`, report that, and stop. Do not re-close or rewrite status.

If any task remains open, report the open task IDs and stop. Do not skip them.

If the cache is missing or stale for the current session, use `cape:tracker` to refresh it from the
latest MCP result already available in session. Do not depend on the CLI for network reads.

---

## Step 2: Audit acceptance criteria

Read the epic contract from session context. For each acceptance criterion (the R-ID rows plus the
out-of-scope regression check), find concrete evidence:

- Passing test output
- File or diff evidence
- Demonstrated behavior
- Manual verification result

Present a checklist:

```text
Acceptance criteria audit - <epic-id>

[x] Criterion 1 - Evidence: <proof>
[~] Criterion 2 - DEFERRED: <behavioral check that could not run live, e.g. UI on an undeployed branch>
[ ] Criterion 3 - NOT MET: <gap>
```

Evidence honesty: mark `[x]` only with evidence the run actually produced. A criterion whose only
verification is behavioral (UI flow, deployed endpoint) and that **could not be exercised** — branch
not deployed, no preview env — is `[~]` DEFERRED, never `[x]`. Verify it on a branch preview deploy
if one exists; otherwise it stays deferred. Do not launder a deferral into a met criterion.

`[~]` does not block hand-off, but every deferred criterion MUST be carried into the PR's **Deferred
verification** section (the `cape:pr` section for env-dependent checks) verbatim as "not yet done —
verify post-merge." Do not put it under Manual verification (subjective judgment only). `cape:pr`
must not present a deferred criterion as verified.

If any criterion is `[ ]` NOT MET, stop and recommend the next task to create through
`cape:execute-plan`. Do not hand off.

---

## Step 3: Run final verification

Run the required project verification for this repository. At minimum, run the checks the epic or
project expects. When helpful, dispatch `cape:test-runner` (model: haiku) to run commands and
capture output without filling the main context.

If checks fail, report the failing command and stop. Do not hand off.

Dispatch `cape:code-reviewer` for non-trivial epics. Pass the epic contract and branch diff; the
reviewer judges the delivered code against the R-IDs and required constraints.

---

## Step 4: Hand off

Load `cape:commit` with the Skill tool to commit remaining changes before handing off when there are
uncommitted implementation changes.

Do not set Linear status. The epic reaches `Done` automatically when the PR (referencing it with
`Fixes ABU-XX`) merges, via Linear's GitHub integration. finish-epic only verifies acceptance
criteria with evidence, runs final verification, and hands off to review/PR.

Optionally write a minimal outcome summary to the Linear epic DESCRIPTION through MCP Linear
`save_issue` (description-only; this is not a status change):

```text
Outcome: <2-3 sentence summary>
Verification: <commands passed>
Tasks completed: <N>
```

Before posting an outcome summary, load the global `stop-slop` skill and run the prose through it;
skip this for pure code or mechanical output. Write in simple language with clear, scannable
structure.

Keep detailed reflections in the conversation. Do not write validation transcripts or expanded
implementation notes to Linear.

---

## Step 5: Report

Present:

```text
Epic verified - <epic-id>: <title>

Summary: <what shipped>
Tasks completed: <N>
Acceptance criteria: all <N> met
Verification: <commands passed>

Epic verified and ready for PR; Linear will close it on merge.
```

Then load `cape:review` for the review-before-pr gate. Do not load `cape:pr` until review completes
and the user explicitly asks to create the PR.

</the_process>

<agent_references>

## Dispatch `cape:test-runner` when:

- Final verification commands are long-running or noisy

## Dispatch `cape:code-reviewer` when:

- The epic changes shared behavior, public APIs, or cross-module contracts

</agent_references>

<skill_references>

## Load `cape:tracker` with the Skill tool when:

- Reading or refreshing cache state during verification

## Load `cape:commit` with the Skill tool when:

- Verified implementation changes remain uncommitted before hand off

## Load `cape:review` with the Skill tool when:

- The epic is verified and the branch is ready for the review-before-pr gate

</skill_references>

<examples>

<example>
<scenario>All tasks done and checks pass</scenario>

**Wrong:** Hand off based only on task count, or set the Linear epic to `Done`.

**Right:** Audit each acceptance criterion with evidence, run final checks, leave Linear status
alone, and hand off to review/PR. Linear closes the epic when the PR merges. </example>

<example>
<scenario>An acceptance criterion is not met</scenario>

**Wrong:** Hand off because all known tasks are done.

**Right:** Report the missing criterion, leave the epic open, and recommend creating the next task
through execute-plan. </example>

<example>
<scenario>finish-epic runs after the PR already merged</scenario>

**Wrong:** Re-close the epic or rewrite its status.

**Right:** Detect the epic is already `Done`, report that the work is closed, and no-op. </example>

</examples>

<key_principles>

- **Evidence beats optimism** -- acceptance criteria need proof
- **Completeness over speed** -- rushing hand off creates follow-up debt
- **The board stays clean** -- Linear gets a minimal durable summary, not transcripts; status is
  owned by the GitHub integration, never by cape

</key_principles>
