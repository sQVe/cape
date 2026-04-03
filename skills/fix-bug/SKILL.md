---
name: fix-bug
description: >
  End-to-end bug fix workflow from discovery to closure. Triggers on: "fix this bug", "can you fix",
  user wants to address a diagnosed br bug, applying a fix after debug-issue, "the fix for br-N",
  fixing a regression, patching broken behavior. Also use when the user has a br bug issue and wants
  to resolve it, or when they report a bug and want it fixed (not just investigated). Do NOT use for
  investigation-only (use debug-issue), feature work (use execute-plan), or refactoring without a
  specific defect (use cape:refactor).
---

<skill_overview> Fix bugs end-to-end: adopt or create the br bug, reproduce, fix via
`cape:test-driven-development`, verify, and close. Dispatches debug-issue for investigation when no
br bug exists, then delegates the fix to the TDD skill with evidence-based closure.

Core contract: every fix gets a regression test that fails before the fix and passes after.
</skill_overview>

<rigidity_level> LOW FREEDOM -- The TDD cycle (delegated to `cape:test-driven-development`) and
evidence-based closure are non-negotiable. Investigation depth, test strategy, and fix approach
adapt to context. </rigidity_level>

<when_to_use>

- User wants to fix a diagnosed br bug from debug-issue
- User reports a bug and wants it resolved, not just investigated
- User references a br bug ID and wants to address it
- Test failure the user wants fixed, not just diagnosed
- Regression the user wants patched

**Don't use for:**

- Investigation only, no intent to fix (use debug-issue)
- Feature work or enhancements (use execute-plan)
- Refactoring without a specific defect (use `cape:refactor`)

</when_to_use>

<the_process>

## Step 1: Adopt or create the bug

**If a br bug already exists** (from debug-issue or user reference):

```bash
br show <bug-id>
```

Read the root cause, evidence, reproduction steps, and success criteria. This is your fix target.

**If no br bug exists** (user reports a new bug and wants it fixed):

Load `cape:debug-issue` with the Skill tool to investigate first. It will produce a br bug with root
cause analysis, evidence, and reproduction steps. Once the br bug exists, read it and continue.

Do not proceed to step 2 without a br bug that has a documented root cause.

---

## Step 2: Reproduce the fix target

**Checkpoint gate:** Read `.beads/<bug-id>/verify.json`. If the key `reproduction` records a SHA
that matches `git rev-parse HEAD`, skip reproduction and report: "Reproduction already passed at
HEAD <short-sha> — skipping." If the file is missing or malformed, proceed normally.

Run the reproduction steps from the br bug to confirm the symptom locally.

```bash
cape br update <bug-id> --status in_progress
```

If reproduction succeeds, you have a baseline. If reproduction fails, investigate why before
proceeding -- the bug may already be fixed, the environment may differ, or the reproduction steps
may be incomplete.

After reproduction succeeds, record the SHA in `.beads/<bug-id>/verify.json` under the key
`reproduction`. Read the existing file (or start from `{}`), set the key to the current HEAD SHA,
and write it back. Create the directory with `mkdir -p ".beads/<bug-id>"` if needed.

---

## Step 3: Fix the bug

**Checkpoint gate:** Read `.beads/<bug-id>/verify.json`. If the key `fix` records a SHA that matches
`git rev-parse HEAD`, skip the TDD cycle and report: "Fix already passed at HEAD <short-sha> —
skipping." If the file is missing or malformed, proceed normally.

Signal that a workflow is active (gates internal skills for direct invocation):

```bash
cape state set workflowActive
```

The bug's root cause from the br bug is your test target. Load `cape:test-driven-development` with
the Skill tool — the RED test reproduces the bug, GREEN fixes it, REFACTOR cleans up.

**Scope guard:**

- Don't refactor adjacent code beyond what the REFACTOR phase justifies
- Don't improve error handling elsewhere
- Don't add features
- Don't clean up unrelated tests

Dispatch `cape:bug-tracer` if the root cause from the br bug proves incomplete or a new failure path
is discovered during the fix. Dispatch `cape:codebase-investigator` if you need to understand
broader impact of the fix on other modules. Dispatch `cape:internet-researcher` if the fix involves
external library behavior or undocumented API semantics.

After the TDD cycle completes (GREEN + REFACTOR), record the SHA in `.beads/<bug-id>/verify.json`
under key `fix` (same pattern as reproduction).

Dispatch `cape:code-reviewer` after the fix is green to review the change against the br bug's root
cause and verify no regressions were introduced.

---

## Step 4: Verify and close

**Verify the original symptom is gone:** re-run the reproduction steps from step 2 and confirm they
no longer trigger the bug.

**Append an Outcome section to the br bug** via `cape br design <bug-id> "Outcome"`:

```
## Outcome

**Fix:** [What was changed, with file:line references]
**Test:** [Regression test added, with file:line reference]
**Evidence:** [Reproduction steps no longer trigger the symptom]
**Status:** FIXED | PARTIALLY_FIXED | BLOCKED
```

**Present fix summary for approval:**

```
## Fix summary -- <bug-id>

**Root cause:** [From the br bug]
**Fix:** [What changed]
**Regression test:** [Test file:line]
**Suite status:** [All passing / N failures unrelated to fix]

Close this bug as FIXED?
```

Wait for user approval, then run close-check and close:

```bash
cape br close-check <bug-id>
cape br close <bug-id>
cape state clear workflowActive
```

If `close-check` fails, stop and report which checks failed — do not close.

After closing, load `cape:commit` with the Skill tool to commit the fix.

</the_process>

<agent_references>

## `cape:bug-tracer` re-dispatch:

Dispatch only when the root cause from the br bug proves incomplete during the fix — a new failure
path is discovered or the fix reveals deeper issues than the initial diagnosis found.

</agent_references>

<skill_references>

## Load `cape:test-driven-development` with the Skill tool when:

- Step 3 begins — the bug's root cause is your test target

## Load `cape:debug-issue` with the Skill tool when:

- User reports a bug but no br bug exists yet
- Investigation is needed before fixing can begin

</skill_references>

<examples>

<example>
<scenario>User has an existing br bug from debug-issue and wants to fix it</scenario>

User: "I have br-42 from the debug session earlier. Let's fix it now."

**Wrong:** Read br-42, skip the test, jump straight to editing the code. The fix works but there's
no regression guard. Three weeks later someone refactors the same area and reintroduces the bug
silently.

**Right:**

1. `br show br-42` -- read root cause: off-by-one in `auth.ts:47`
2. Run reproduction steps from the bug to confirm the symptom locally
3. Write a test that exercises the boundary condition at `auth.ts:47` -- confirm it fails (RED)
4. Fix the comparison operator -- confirm the test passes (GREEN), full suite green
5. Re-run reproduction steps, symptom gone. Append Outcome to br-42, present summary, close
   </example>

<example>
<scenario>User reports a new bug and wants it fixed</scenario>

User: "The login form throws a 500 when the email has a plus sign. Can you fix it?"

**Wrong:** Grep for email validation, guess the fix, apply it, move on. No investigation, no
evidence, no test. The fix might address a symptom while the root cause (unescaped input in the SQL
query) remains exploitable.

**Right:**

1. No br bug exists -- dispatch debug-issue to investigate. It produces br-58 with root cause: email
   not URL-encoded before being passed to the auth service query
2. Run reproduction: POST login with `user+test@example.com`, confirm 500
3. Write a test for the auth service that passes an email with `+` -- confirm it fails (RED)
4. Fix the encoding in the auth service -- confirm test passes (GREEN), full suite green
5. Re-run reproduction, login succeeds. Append Outcome to br-58, present summary, close </example>

</examples>

<key_principles>

- **Reproduce before fixing** -- confirm the symptom exists locally before changing code
- **Regression test is non-negotiable** -- every fix gets a test that would have caught it
- **Minimal fix** -- root cause only, no drive-by improvements
- **Evidence-based closure** -- verify the original symptom is gone before closing

</key_principles>

<critical_rules>

1. **br bug must exist before fixing** -- adopt from debug-issue or create via debug-issue dispatch
2. **Failing test before code change** -- RED before GREEN, always
3. **Full test suite before closing** -- no regressions introduced
4. **Confirm before closing** -- present fix summary and get user approval
5. **Run close-check before close** -- `cape br close-check <bug-id>` must pass before
   `cape br close <bug-id>`; if it fails, stop and report failures

</critical_rules>
