---
name: finish-epic
description: >
  Verify a Linear tracker epic after all tasks are complete and hand off to the PR. Use when the
  user wants to close out an epic. Not while tasks remain (cape:execute-plan).
---

# Finish epic

Verify a completed epic and hand it off to the PR: audit every acceptance criterion, run the
project's checks, and report what shipped. Hand off only when every criterion has evidence.

The evidence gate and automated checks are fixed; verification details adapt to the repository.

## Rules

1. **Never set Linear status.** Linear's GitHub integration moves the whole set to `Done` when the
   PR merges, via the closing line `cape:pr` builds from the tracker cache
   (`Fixes <human-id>, <plan-id>, <completed task ids>`).
2. **Every acceptance criterion needs evidence.** Cite tests, files, or demonstrated behavior.
3. **All tasks complete, all checks pass.** Do not skip open tasks or failing checks to hand off.
4. **Stop on failure.** Report missing evidence or the failing command instead of handing off.
5. **Linear stays minimal.** Detailed reflections stay in the session. Linear gets at most a concise
   outcome summary, written description-only via `save_issue`, never a status change.

## Process

### 1. Confirm completion from cache

Read `hooks/context/tracker.json` and locate the epic. Every child task must have a completed state
type or a done-like status.

- Epic already `Done` (the PR merged before this ran): run `cape workspace phase done`, report that
  the work is closed, and stop. Do not re-close or rewrite status.
- Any task still open: **STOP.** Report the open task IDs.
- Cache missing or stale for this session: follow the `cape:tracker` cache rule and refresh from an
  MCP result already in session.

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

Mark `[x]` only with evidence this run actually produced. A criterion whose only verification is
behavioral (UI flow, deployed endpoint) and that could not be exercised is `[~]` DEFERRED, never
`[x]`. Verify it on a branch preview deploy if one exists; otherwise it stays deferred.

`[~]` does not block hand-off, but every deferred criterion goes verbatim into the PR's Deferred
verification section (the `cape:pr` section for env-dependent checks) as "not yet done, verify
post-merge". Never under Manual verification, which is for subjective judgment only, and never
presented as verified.

Any `[ ]` NOT MET: **STOP.** Leave the epic open and recommend the next task to create through
`cape:execute-plan`.

### 3. Run final verification

Run the checks the epic or project requires. Dispatch `cape:test-runner` (model: haiku) when
commands are long-running or noisy. If checks fail: **STOP.** Report the failing command.

For non-trivial epics, dispatch `cape:code-reviewer` with the epic contract and branch diff; the
reviewer judges the delivered code against the R-IDs and required constraints.

### 4. Hand off

If implementation changes remain uncommitted, load `cape:commit` to commit them.

Optionally write an outcome summary to the epic description through MCP Linear `save_issue`:

```text
Outcome: <2-3 sentence summary>
Verification: <commands passed>
Tasks completed: <N>
```

Run the summary through `cape:unslop` before posting. Do not write validation transcripts or
implementation notes to Linear.

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

## Agents

Dispatch `cape:test-runner` when:

- Final verification commands are long-running or noisy

Dispatch `cape:code-reviewer` when:

- The epic changes shared behavior, public APIs, or cross-module contracts

## Skills

Load `cape:tracker` when:

- The tracker cache is missing or stale during verification

Load `cape:commit` when:

- Verified implementation changes remain uncommitted before hand off
