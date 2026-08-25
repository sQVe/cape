---
name: fix-bug
description: >
  Diagnose and fix a bug end to end, from discovery to closure. Use for any defect, regression, or
  broken behavior. Not for feature work (cape:execute-plan).
---

# Fix bug

Diagnose a defect to root cause, adopt an existing Linear bug issue or create a human/AI bug pair,
fix it test-first, and verify the original symptom is gone before closing. Every fix ships with a
regression test that fails before the fix and passes after.

Diagnosis before patching, test-first fixing, evidence-based closure, and cache refresh after Linear
writes are fixed. Investigation depth adapts to the bug.

## Rules

1. **No patch without diagnosis.** Reproduce the symptom and trace it to an evidence-backed root
   cause before changing code.
2. **Failing test before the fix.** Reproduce the bug in a test and confirm it fails for the
   diagnosed reason. When no correct seam exists for that test, report the missing seam before the
   fix, then follow `cape:test-driven-development` rule 4, which requires explicit approval for the
   fallback.
3. **Verify the original symptom before close.** Reproduction, tests, and success criteria gate
   closure, never code inspection alone.
4. **Track the bug in Linear.** Adopt an existing issue or create the human/AI bug pair through MCP
   Linear per the `cape:tracker` contract.
5. **Refresh cache after every Linear write.** Every create or content update is followed by
   `cape tracker`; status stays cache-only until the PR closing line.

## Process

### 1. Diagnose and track

If a Linear bug issue already exists in the session or request, adopt it. Use the local tracker
cache for orientation and status. If the issue details are not in session, fetch them with MCP
`get_issue`; if MCP is unavailable, ask the user for the description instead.

An adopted human ticket (home team) with no AI counterpart is an incomplete pair: locate the linked
AI bug issue, or create and link one per the tracker contract's pairing protocol, and refresh the
cache before proceeding. Build-time status tracks the AI-side id, and the PR closing line needs an
AI issue to close.

Whenever the root cause is not yet diagnosed, adopted issue or not, diagnose before touching code:

- Clarify the symptom, then name one reproduction command you have already run once. It must fail on
  the bug, fail the same way every run, and finish fast. No hypotheses until it exists. When the bug
  has no deterministic reproduction (a race, a production-only failure), say so, name the closest
  check you did run, and treat the missing command as the first finding.
- Gather evidence from file reads, logs, tests, git history, and docs.
- Present 3 to 5 ranked, falsifiable hypotheses before testing any of them, then test them in order
  and trace the symptom to a root cause. When the evidence already names the line, state that one
  hypothesis and what rules the others out instead of padding the list.
- Tag every debug log added while working the bug with `[DEBUG-<id>]` so step 4 can find them.
- Record dead ends in the conversation.

Run root-cause and reproduction text through `cape:unslop` before presenting it or writing issue
prose.

**STOP. Present the investigation summary and wait for approval.** For an adopted issue, approval
also covers writing the root cause to its AI bug issue with `save_issue` and refreshing the cache.
When no issue exists, it covers creating the Linear bug pair.

```text
Investigation summary

Symptom: <what failed>
Root cause: <file:line and mechanism>
Evidence: <key observations>
Reproduction: <exact steps>

Create a Linear bug pair for this fix? (adopted issue: write this root cause to <ai-bug-id>?)
```

For an adopted issue, approval means one `save_issue` on its AI bug issue with the root cause,
evidence, and reproduction, then a cache refresh; skip the rest of this step. When no issue existed,
after approval load `cape:tracker` and apply its `resources/agent-contract.md`; it owns team
routing, dedupe, labels (the AI bug issue gets `type:bug`), priority, and the bug title shape.
Create the pair per the tracker contract's pairing protocol: a concise human bug ticket carrying the
symptom and impact and nothing agent-facing, plus an AI bug issue holding root cause, evidence,
reproduction steps, expected behavior, actual behavior, suggested fix, and success criteria. When
the bug has no user-informational value, use the tracker contract's AI-only exception and skip the
human ticket. Then refresh the cache per `cape:tracker`: when the bug sits under an epic, refresh
the parent with `cape tracker cache-epic`, stamping the bug child's `humanTicketId` into the JSON so
the PR closing line picks up the bug's own human ticket. If the bug is standalone and not yet in
cache, create or refresh a containing parent issue first.

### 2. Reproduce and start

Run the reproduction command from step 1, or the closest check it named, and confirm the symptom
locally. If reproduction fails, the bug may already be fixed or the environment may differ;
investigate and report that before editing production code.

Mark the bug in progress in the cache only, with no MCP status writes during build, per the tracker
contract:

```bash
cape tracker cache-status <bug-id> "In Progress" started
```

### 3. Fix with TDD

Signal the build phase for the herdr rail: `cape workspace phase build`. Load
`cape:test-driven-development`; the root cause is the test target.

Fix the root cause only. No refactoring beyond what the fix requires, no unrelated error handling or
features, no cleanup of unrelated tests.

Write the regression test and confirm it fails for the diagnosed reason. If no correct seam exists
for it, report the missing seam now, before any fix, and follow `cape:test-driven-development`
rule 4. Implement the minimum fix, make the test pass, then run the relevant broader suite.

### 4. Verify and close

Re-run the step 1 reproduction command, or its closest check, and confirm the symptom is gone. Run
the relevant tests and project checks. Grep the diff for `DEBUG-` and confirm no tagged log remains.
Present the fix summary, run through `cape:unslop`:

```text
Fix summary: <bug-id>

Root cause: <diagnosed cause>
Fix: <what changed>
Regression test: <test file or command>
Missing seam: <none, or the seam the test needed and the approved fallback>
Verification: <commands and results>
Status: FIXED | PARTIALLY_FIXED | BLOCKED
```

**STOP and wait if the user asked to approve closure.** Otherwise close only when verification is
green.

Never close through MCP. The PR closing line moves the issue to `Done` at merge, per the tracker
contract. Mirror the closure into the cache:

```bash
cape tracker cache-status <bug-id> Done completed
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

It returns one JSON object. Relay its `findings` through a single `ReportFindings` call; the agent
has no such tool of its own.

## Skills

Load `cape:test-driven-development` when:

- Step 3 begins

Load `cape:tracker` when:

- Creating, updating, closing, or caching the Linear bug issue

Load `cape:commit` when:

- The fix is verified and ready to commit
