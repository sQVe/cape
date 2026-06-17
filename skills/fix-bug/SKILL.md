---
name: fix-bug
description: >
  End-to-end bug fix workflow from discovery to closure. Triggers on: "fix this bug", "can you fix",
  user wants to address a diagnosed Linear bug issue, fixing a regression, patching broken behavior,
  or investigating a defect before fixing it. Do NOT use for feature work (use execute-plan) or
  cleanup without a specific defect.
---

<skill_overview> Diagnose a defect to root cause, adopt or create a Linear bug issue, fix it with
test-first implementation, verify the original symptom is gone, close it, and refresh the tracker
cache.

Core contract: every fix gets a regression test that fails before the fix and passes after.
</skill_overview>

<rigidity_level> MEDIUM FREEDOM -- Diagnosis before patching, test-first fixing, evidence-based
closure, and cache refresh after Linear writes are fixed. Investigation depth adapts to the bug.
</rigidity_level>

<when_to_use>

- User reports a bug and wants it resolved
- User references a Linear bug issue and wants it fixed
- A regression or failing test needs a root-cause fix

**Don't use for:**

- Feature work or enhancements (use execute-plan)
- Cleanup without a specific defect
- General code review (use review)

</when_to_use>

<critical_rules>

1. **Diagnose before fixing** -- no reproduction and no evidence-backed root cause means no patch
2. **Track the bug in Linear** -- adopt an existing issue or create one through MCP Linear
3. **Refresh cache after writes** -- every Linear create, status update, or close is followed by
   `cape tracker`
4. **Failing test before code change** -- reproduce the bug in a test before fixing it
5. **Verify original symptom before close** -- do not close based only on code inspection
6. **No close-check ceremony** -- use reproduction, tests, and success criteria as the closure gate

</critical_rules>

<the_process>

## Step 1: Diagnose And Track

If a Linear bug issue already exists in the session or user request, adopt it. Use the local tracker
cache for orientation and issue status. If the issue details are not in session, ask the user for
the current issue description rather than doing a network read for orientation.

If no bug issue exists, run the diagnosis gate before changing code:

- Clarify the symptom
- Reproduce it with a command, test, or manual step
- Gather evidence from file reads, logs, tests, git history, and relevant docs
- Form hypotheses from evidence and test them
- Trace the symptom to a root cause
- Record dead ends in the conversation

Present the investigation summary and ask for approval before creating a Linear bug:

```text
Investigation summary

Symptom: <what failed>
Root cause: <file:line and mechanism>
Evidence: <key observations>
Reproduction: <exact steps>

Create a Linear bug issue for this fix?
```

After approval, use MCP Linear `save_issue` to create the bug issue. Include root cause, evidence,
reproduction steps, expected behavior, actual behavior, suggested fix, and success criteria in the
description. Then refresh the cache. If the bug belongs under an epic, refresh the parent epic:

```bash
cape tracker cache-epic '<linear-epic-json-with-bug-child>'
```

If the bug is standalone and not yet in cache, create or refresh the relevant parent issue first so
the cache has a containing epic entry.

---

## Step 2: Reproduce And Start

Run the reproduction steps from the issue or investigation summary. Confirm the symptom locally
before writing the fix.

Mark the bug in progress through MCP Linear, then refresh local cache:

```bash
cape tracker cache-status <bug-id> "In Progress" started
cape state set workflowActive
```

If reproduction fails because the bug is already fixed or the environment differs, investigate and
report that before editing production code.

---

## Step 3: Fix With TDD

Load `cape:test-driven-development` with the Skill tool. The root cause is the test target.

Scope guard:

- Fix the root cause only
- Do not refactor adjacent code beyond what the fix requires
- Do not add unrelated error handling or features
- Do not clean up unrelated tests

Write the regression test first and confirm it fails for the diagnosed reason. Implement the minimum
fix, make the test pass, then run the relevant broader suite.

Dispatch `cape:codebase-investigator` in bug-tracer mode (model: sonnet) when the initial root cause
proves incomplete. Dispatch `cape:internet-researcher` only for external API or library behavior
that needs current primary-source confirmation.

Dispatch `cape:code-reviewer` after the fix is green for non-trivial changes. Pass the issue root
cause and the fix diff; the reviewer judges whether the fix addresses the diagnosed defect without
regressions.

---

## Step 4: Verify And Close

Re-run the original reproduction steps and confirm the symptom is gone. Run the relevant tests and
project checks.

Present the fix summary:

```text
Fix summary - <bug-id>

Root cause: <diagnosed cause>
Fix: <what changed>
Regression test: <test file or command>
Verification: <commands and results>
Status: FIXED | PARTIALLY_FIXED | BLOCKED
```

If the user requested approval before closure, wait. Otherwise close only when verification is
green.

Close the issue through MCP Linear, then refresh cache:

```bash
cape tracker cache-status <bug-id> Done completed
cape state clear workflowActive
```

Load `cape:commit` with the Skill tool to commit the fix.

</the_process>

<agent_references>

## Dispatch `cape:codebase-investigator` bug-tracer mode when:

- The reproduction path is unclear
- The root cause proves incomplete during the fix
- The failure crosses several modules

## Dispatch `cape:code-reviewer` when:

- The fix changes shared behavior, public interfaces, or security-sensitive code

</agent_references>

<skill_references>

## Load `cape:test-driven-development` with the Skill tool when:

- Step 3 begins

## Load `cape:tracker` with the Skill tool when:

- Creating, updating, closing, or caching the Linear bug issue

</skill_references>

<examples>

<example>
<scenario>User reports a new bug</scenario>

**Wrong:** Guess at validation code, patch it, and move on without reproduction.

**Right:** Reproduce the symptom, trace the root cause with evidence, create a Linear bug after
approval, write a failing regression test, fix it, verify the original symptom, close in Linear, and
refresh cache. </example>

<example>
<scenario>User references an existing bug issue</scenario>

**Wrong:** Treat the issue title as enough context and start editing.

**Right:** Read the issue details already present in the session, reproduce the bug, mark it
in-progress in Linear, refresh cache, and proceed through TDD. </example>

</examples>

<key_principles>

- **Reproduce before fixing** -- confirm the symptom exists locally before changing code
- **Minimal fix** -- root cause only, no drive-by improvements
- **Evidence-based closure** -- tests and reproduction evidence decide when to close
- **Tracker cache follows Linear** -- writes happen in Linear first, then local cache updates

</key_principles>
