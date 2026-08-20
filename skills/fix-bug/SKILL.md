---
name: fix-bug
description: >
  End-to-end bug fix workflow from discovery to closure. Triggers on: "fix this bug", "can you fix",
  user wants to address a diagnosed Linear bug issue, fixing a regression, patching broken behavior,
  or investigating a defect before fixing it. Do NOT use for feature work (use execute-plan) or
  cleanup without a specific defect.
---

# Fix bug

Diagnose a defect to root cause, track it in Linear, fix it test-first, and verify the original
symptom is gone before closing. Every fix ships with a regression test that fails before the fix and
passes after.

Diagnosis before patching, test-first fixing, evidence-based closure, and cache refresh after Linear
writes are fixed. Investigation depth adapts to the bug.

## Rules

1. **No patch without diagnosis.** Reproduce the symptom and trace it to an evidence-backed root
   cause before changing code.
2. **Failing test before the fix.** Reproduce the bug in a test and confirm it fails for the
   diagnosed reason.
3. **Verify the original symptom before close.** Reproduction, tests, and success criteria gate
   closure, never code inspection alone.
4. **Track the bug in Linear.** Adopt an existing issue or create one through MCP Linear.
5. **Refresh cache after every Linear write.** Every create, status update, or close is followed by
   `cape tracker`.

## Process

### 1. Diagnose and track

If a Linear bug issue already exists in the session or request, adopt it. Use the local tracker
cache for orientation and status. If the issue details are not in session, fetch them with MCP
`get_issue`; if MCP is unavailable, ask the user for the description instead.

If no issue exists, diagnose before touching code:

- Clarify the symptom and reproduce it with a command, test, or manual step.
- Gather evidence from file reads, logs, tests, git history, and docs.
- Form hypotheses, test them, and trace the symptom to a root cause.
- Record dead ends in the conversation.

Run root-cause and reproduction text through `cape:unslop` before presenting it or writing issue
prose.

**STOP. Present the investigation summary and wait for approval before creating a Linear issue.**

```text
Investigation summary

Symptom: <what failed>
Root cause: <file:line and mechanism>
Evidence: <key observations>
Reproduction: <exact steps>

Create a Linear bug issue for this fix?
```

After approval, load `cape:tracker` and apply its `resources/agent-contract.md`; it owns dedupe,
labels, priority, and the bug title shape. Create the issue with MCP Linear `save_issue`, including
root cause, evidence, reproduction steps, expected behavior, actual behavior, suggested fix, and
success criteria. Then refresh the cache per `cape:tracker`: when the bug sits under an epic,
refresh the parent with `cape tracker cache-epic`. If the bug is standalone and not yet in cache,
create or refresh a containing parent issue first.

### 2. Reproduce and start

Run the reproduction steps and confirm the symptom locally. If reproduction fails, the bug may
already be fixed or the environment may differ; investigate and report that before editing
production code.

Mark the bug in progress through MCP Linear, then update local state:

```bash
cape tracker cache-status <bug-id> "In Progress" started
cape state set workflowActive
```

### 3. Fix with TDD

Signal the build phase for the herdr rail: `cape workspace phase build`. Load
`cape:test-driven-development`; the root cause is the test target.

Fix the root cause only. No refactoring beyond what the fix requires, no unrelated error handling or
features, no cleanup of unrelated tests.

Write the regression test and confirm it fails for the diagnosed reason. Implement the minimum fix,
make the test pass, then run the relevant broader suite.

### 4. Verify and close

Re-run the original reproduction steps and confirm the symptom is gone. Run the relevant tests and
project checks. Present the fix summary, run through `cape:unslop`:

```text
Fix summary: <bug-id>

Root cause: <diagnosed cause>
Fix: <what changed>
Regression test: <test file or command>
Verification: <commands and results>
Status: FIXED | PARTIALLY_FIXED | BLOCKED
```

**STOP and wait if the user asked to approve closure.** Otherwise close only when verification is
green.

Close the issue through MCP Linear, then:

```bash
cape tracker cache-status <bug-id> Done completed
cape state clear workflowActive
```

Load `cape:commit` to commit the fix.

## Agents

Dispatch `cape:codebase-investigator` in bug-tracer mode (model: sonnet) when:

- The reproduction path is unclear
- The root cause proves incomplete during the fix
- The failure crosses several modules

Dispatch `cape:internet-researcher` when:

- External API or library behavior needs current primary-source confirmation

Dispatch `cape:code-reviewer` when:

- The fix is green and changes shared behavior, public interfaces, or security-sensitive code. Pass
  the root cause and the fix diff; the reviewer judges whether the fix addresses the diagnosed
  defect without regressions.

## Skills

Load `cape:test-driven-development` when:

- Step 3 begins

Load `cape:tracker` when:

- Creating, updating, closing, or caching the Linear bug issue

Load `cape:commit` when:

- The fix is verified and ready to commit
