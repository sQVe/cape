---
name: finish-epic
description: >
  Verify a Linear tracker epic after all tasks are complete and hand off to the PR. Use when the
  user wants to close out an epic. Not while tasks remain (cape:execute-plan) or for creating the PR
  itself (cape:pr).
---

# Finish epic

Verify a completed epic and hand it off to the PR: audit every acceptance criterion, run the
project's checks, and report what shipped. Hand off only when every criterion has evidence.

## Rules

1. **Never close the human ticket or plan issue.** Linear's GitHub integration moves them to `Done`
   when the PR merges, via the closing line `cape:pr` builds from the tracker cache
   (`Fixes <human-id>, <plan-id>`).
2. **Every acceptance criterion needs evidence.** Cite tests, files, or demonstrated behavior.
3. **Linear stays minimal.** Detailed reflections stay in the session. Linear gets at most a concise
   outcome summary; that `save_issue` is description-only.

## Process

### 1. Confirm completion from cache

Run `cape tracker show` and locate the epic. Every child task must have a completed state type or a
done-like status.

- Epic already `Done` (the PR merged before this ran): report that the work is closed and stop. Do
  not re-close or rewrite status.
- Any task still open: **STOP.** Report the open task IDs.
- Cache missing or stale: apply the `cape:tracker` cache rule.

### 2. Audit acceptance criteria

For each acceptance criterion in the epic contract (the R-ID rows plus the out-of-scope regression
check), find concrete evidence: passing test output, file or diff evidence, demonstrated behavior,
or a manual verification result. Present a checklist:

```text
Acceptance criteria audit - <epic-id>

[x] Criterion 1 - Evidence: <proof>
[~] Criterion 2 - DEFERRED: <behavioral check that could not run live>
[ ] Criterion 3 - NOT MET: <gap>
```

Mark `[x]` only with evidence this run actually produced.

When the criterion is behavioral, that evidence exercises the real user path, not a proxy for it. A
test that only imports the changed module proves the module loads. Record the action and the state
it left behind, plus the side effects the action was supposed to cause (files written, rows changed,
requests sent). A dry run counts only when you read its output; assuming it ran is not evidence. A
criterion an automated test already covers is met by that test's passing output.

The out-of-scope regression check names the one fact the change is safe because of, and how far that
fact was proved: which callers were checked, which paths were traced, which inputs were run. Safety
asserted without that fact fails the check.

A criterion whose only verification is behavioral (UI flow, deployed endpoint) and that could not be
exercised is `[~]` DEFERRED, never `[x]`. Verify it on a branch preview deploy if one exists;
otherwise it stays deferred.

`[~]` does not block hand-off, but every deferred criterion goes verbatim into the PR's Deferred
verification section (`cape:pr` step 3) as "not yet done, verify post-merge". Never under Manual
verification, which is for subjective judgment only, and never presented as verified.

After presenting the audit, write it into the epic description by following `cape:tracker`'s "Update
epic acceptance criteria" section.

Any `[ ]` NOT MET: **STOP.** Leave the epic open and recommend the next task to create through
`cape:execute-plan`.

### 3. Run final verification

Run the checks the epic or project requires. Dispatch `cape:test-runner` (model: haiku) when
commands are long-running or noisy. If checks fail: **STOP.** Report the failing command.

When the epic changes shared behavior, public APIs, or cross-module contracts, dispatch
`cape:code-reviewer` with the epic contract and branch diff; the reviewer judges the delivered code
against the R-IDs and required constraints. Address each finding before handing off.

### 4. Hand off

If implementation changes remain uncommitted, load `cape:commit` to commit them.

Optionally write an outcome summary to the epic description through MCP Linear `save_issue`:

```text
Outcome: <2-3 sentence summary>
Verification: <commands passed>
Tasks completed: <N>
```

### 5. Report

```text
Epic verified - <epic-id>: <title>

Summary: <what shipped>
Tasks completed: <N>
Acceptance criteria: <N> met, <M> deferred
Verification: <commands passed>

Ready for PR; Linear will close the epic on merge.
```

Do not load `cape:pr` until the user asks to create the PR.
