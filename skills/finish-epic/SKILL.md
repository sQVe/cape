---
name: finish-epic
description: >
  Verify and close a Linear tracker epic after all tasks are complete. Use when the user says
  "finish the epic", "we're done", "close out the epic", all tasks are done and the user wants to
  close it, or execute-plan detects all success criteria appear met. Runs final verification, checks
  success criteria with evidence, optionally writes a minimal outcome summary to Linear, and closes
  the epic.
---

<skill_overview> The final step in the build chain. Verify every success criterion, run project
checks, close the Linear epic through MCP, refresh the local tracker cache, and report what shipped.

Core contract: the epic only closes when every success criterion has evidence. </skill_overview>

<rigidity_level> MEDIUM FREEDOM -- The evidence gate, automated checks, Linear close, and cache
refresh are fixed. Verification details adapt to the repository. </rigidity_level>

<when_to_use>

- All tasks in a tracker epic are completed
- User says "finish the epic", "we're done", "close it out", "wrap this up"
- execute-plan detects no ready tasks remain and success criteria appear met
- User references an epic ID and wants closure

**Don't use for:**

- Tasks still need implementation (use execute-plan)
- Epic does not exist yet (use brainstorm then write-plan)
- Git operations like PRs or pushes

</when_to_use>

<critical_rules>

1. **All tasks must be complete** -- do not close open tasks just to close the epic
2. **All automated checks must pass** -- run the repository's required verification
3. **All success criteria need evidence** -- cite tests, files, or behavior
4. **Stop on failure** -- report missing evidence or failing checks instead of closing
5. **Close through Linear MCP** -- then refresh `hooks/context/tracker.json` with `cape tracker`
6. **Keep outcome minimal** -- detailed outcome stays in session; Linear gets only a concise durable
   summary when useful

</critical_rules>

<the_process>

## Step 1: Confirm Completion From Cache

Read `hooks/context/tracker.json` and locate the epic. Confirm every child task has a completed
state type or a done-like status.

If any task remains open, report the open task IDs and stop. Do not close them.

If the cache is missing or stale for the current session, use `cape:tracker` to refresh it from the
latest MCP result already available in session. Do not depend on the CLI for network reads.

---

## Step 2: Audit Success Criteria

Read the epic contract from session context. For each success criterion, find concrete evidence:

- Passing test output
- File or diff evidence
- Demonstrated behavior
- Manual verification result

Present a checklist:

```text
Success criteria audit - <epic-id>

[x] Criterion 1 - Evidence: <proof>
[x] Criterion 2 - Evidence: <proof>
[ ] Criterion 3 - NOT MET: <gap>
```

If any criterion is not met, stop and recommend the next task to create through `cape:execute-plan`.

---

## Step 3: Run Final Verification

Run the required project verification for this repository. At minimum, run the checks the epic or
project expects. When helpful, dispatch `cape:test-runner` (model: haiku) to run commands and
capture output without filling the main context.

If checks fail, report the failing command and stop. Do not close the epic.

Dispatch `cape:code-reviewer` for non-trivial epics. Pass the epic contract and branch diff; the
reviewer judges the delivered code against requirements and anti-patterns.

---

## Step 4: Close Epic

Load `cape:commit` with the Skill tool to commit remaining changes before closing when there are
uncommitted implementation changes.

Before posting an outcome summary, load the global `stop-slop` skill and run the prose through it;
skip this for pure code or mechanical output.

Optionally write a minimal outcome summary to the Linear epic description through MCP Linear
`save_issue`:

```text
Outcome: <2-3 sentence summary>
Verification: <commands passed>
Tasks completed: <N>
```

Keep detailed reflections in the conversation. Do not write validation transcripts or expanded
implementation notes to Linear.

Close the epic through MCP Linear, which moves it from `In Review` to `Done`, then refresh the
cache:

```bash
cape tracker cache-status <epic-id> Done completed
```

If the close response includes the full epic with children, prefer:

```bash
cape tracker cache-epic '<linear-epic-json-with-children>'
```

---

## Step 5: Report

Present:

```text
Epic complete - <epic-id>: <title>

Summary: <what shipped>
Tasks completed: <N>
Success criteria: all <N> met
Verification: <commands passed>

Epic closed in Linear and tracker cache refreshed.
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

- Closing the epic or refreshing cache state

## Load `cape:commit` with the Skill tool when:

- Verified implementation changes remain uncommitted before closure

## Load `cape:review` with the Skill tool when:

- The epic is closed and the branch is ready for the review-before-pr gate

</skill_references>

<examples>

<example>
<scenario>All tasks done and checks pass</scenario>

**Wrong:** Close the epic based only on task count.

**Right:** Audit each success criterion with evidence, run final checks, close the Linear epic, run
`cape tracker cache-status <epic-id> Done completed`, and report the outcome. </example>

<example>
<scenario>A success criterion is not met</scenario>

**Wrong:** Close the epic because all known tasks are done.

**Right:** Report the missing criterion, keep the epic open, and recommend creating the next task
through execute-plan. </example>

</examples>

<key_principles>

- **Evidence beats optimism** -- success criteria need proof
- **Completeness over speed** -- rushing closure creates follow-up debt
- **The board stays clean** -- Linear gets status and minimal durable summary, not transcripts

</key_principles>
