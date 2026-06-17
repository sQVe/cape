---
name: fix-bug
description: >
  End-to-end bug fix workflow from discovery to closure. Triggers on: "fix this bug", "can you fix",
  user wants to address a diagnosed br bug, "the fix for br-N", fixing a regression, patching broken
  behavior, or investigating a defect before fixing it. Also use when the user has a br bug issue
  and wants to resolve it, or when they report a bug and want it fixed. Do NOT use for feature work
  (use execute-plan) or cleanup without a specific defect.
---

<skill_overview> Fix bugs end-to-end: adopt or create the br bug, reproduce, fix via
`cape:test-driven-development`, verify, and close. If no diagnosed br bug exists, run the diagnosis
gate first: reproduce the symptom, gather evidence, trace the root cause, document dead ends, and
create the br bug before patching.

Core contract: every fix gets a regression test that fails before the fix and passes after.
</skill_overview>

<rigidity_level> MEDIUM FREEDOM -- Test-first bug fixing (delegated to
`cape:test-driven-development`), loop-first diagnosis, and evidence-based closure are
non-negotiable. Investigation depth, test strategy, and fix approach adapt to context.
</rigidity_level>

<when_to_use>

- User wants to fix a diagnosed br bug
- User reports a bug and wants it resolved, not just investigated
- User references a br bug ID and wants to address it
- Test failure the user wants fixed, not just diagnosed
- Regression the user wants patched

**Don't use for:**

- Feature work or enhancements (use execute-plan)
- Cleanup without a specific defect

</when_to_use>

<critical_rules>

1. **Diagnose before fixing** -- no reproduction and no evidence-backed root cause means no patch
2. **Failing test before code change** -- reproduce the bug in a test before you fix it
3. **Full test suite before closing** -- no regressions introduced
4. **Confirm before closing** -- present fix summary and get user approval
5. **Run close-check before close** -- `cape br close-check <bug-id>` must pass before
   `cape br close <bug-id>`; if it fails, stop and report failures

</critical_rules>

<the_process>

## Step 1: Diagnose, then adopt or create the bug

**If a br bug already exists** (from user reference or prior diagnosis):

```bash
br show <bug-id>
```

Read the root cause, evidence, reproduction steps, and success criteria. This is your fix target.

**If no br bug exists** (user reports a new bug and wants it fixed):

Run the diagnosis gate inline before making any code change.

**Clarify the symptom:**

- What is the user observing? (error message, wrong output, crash, test failure)
- When does it happen? (always, intermittently, after a specific action)
- When did it start? (recent change, always been this way, after an update)

If the user provided a stack trace or error message, parse it for file paths, line numbers, and
error types.

**Reproduce the bug before hypothesizing:**

- Run the failing test, command, or operation to confirm the symptom
- If it cannot be reproduced, document that and investigate recent changes or environmental factors
  that could explain an intermittent failure
- Record the exact reproduction steps and output

Do not form hypotheses until the symptom is confirmed or the inability to reproduce is documented.

**Gather evidence with tools, not intuition.**

Dispatch `cape:codebase-investigator` in bug-tracer mode (model: sonnet) to trace execution backward
from the error location, check recent changes to affected files, compare working and broken paths,
and identify instrumentation points. Dispatch `cape:codebase-investigator` in default mode (model:
haiku) if broader architecture context is needed. Dispatch `cape:internet-researcher` (model:
sonnet) only when the bug may involve external APIs, libraries, or undocumented behavior. If agents
are unavailable, investigate manually with search, file reads, git history, and primary external
documentation when needed.

Maintain an evidence trail as you investigate:

```text
Evidence:
1. [file:line] - [what you found, why it matters]
2. [command output] - [what it reveals]
3. [git log entry] - [relevant change]
```

Every conclusion needs evidence. Evidence without interpretation is noise; note what each finding
supports or rules out.

**Form hypotheses from evidence, not guesses.**

For each hypothesis:

1. State the mechanism: "The bug occurs because [specific cause]"
2. Identify a prediction: "If this is correct, then [observable result]"
3. Test it with a command, file read, or focused check
4. Record the result as confirmed, refuted, or inconclusive

Document refuted hypotheses as dead ends instead of dropping them.

**Trace symptoms to root cause.**

A thrown exception, failing test, or wrong output is a symptom. Keep asking why until you reach the
cause that, if fixed, prevents the symptom from recurring. If the root cause cannot be determined,
document what works, what is broken, where the investigation stalled, and what should be checked
next.

**STOP before creating the br bug.** Present findings for approval:

```text
## Investigation summary

**Symptom:** [What the user observed]
**Root cause:** [The underlying reason, with file:line reference]
**Evidence:** [Key findings that confirm the root cause]
**Reproduction:** [Steps to trigger the bug]

I'll create a br bug issue with these findings. Proceed?
```

Do not call `br create` until the user responds. Wait for explicit approval, then create the issue:

```bash
br create "Bug: [Concise root cause description]" \
  --type bug \
  --priority <0-4> \
  --labels "fix-bug" \
  --description "$(cat <<'EOF'
## Finding
[Root cause with file:line references]

## Evidence
1. [file:line] - [what was found]
2. [command output] - [what it revealed]
3. [git log] - [relevant change]

## Reproduction steps
1. [Step to trigger]
2. [Observe: symptom]

## Expected behavior
[What should happen]

## Actual behavior
[What happens instead]

## Dead ends investigated
- [Hypothesis] - [why refuted]

## Suggested fix
[Direction for the fix]

## Success criteria
- [ ] [Root cause addressed]
- [ ] [Regression test added]
EOF
)"
cape br validate <bug-id>
```

After the bug exists, read it back and continue.

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
the Skill tool — let the failing test reproduce the bug, then make it pass with the smallest fix.
Clean up only if it clearly improves the result.

**Scope guard:**

- Don't refactor adjacent code beyond what the current bug fix justifies
- Don't improve error handling elsewhere
- Don't add features
- Don't clean up unrelated tests

Dispatch `cape:codebase-investigator` in bug-tracer mode (model: sonnet) if the root cause from the
br bug proves incomplete or a new failure path is discovered during the fix. Dispatch
`cape:codebase-investigator` in default mode (model: haiku) if you need to understand broader impact
of the fix on other modules. Dispatch `cape:internet-researcher` (model: sonnet) if the fix involves
external library behavior or undocumented API semantics.

After the bug-fix pass is complete and tests are green, record the SHA in
`.beads/<bug-id>/verify.json` under key `fix` (same pattern as reproduction).

Dispatch `cape:code-reviewer` (model: sonnet) after the fix is green. Pass the br bug (root cause
and success criteria) and the fix diff — the reviewer judges the fix against the diagnosed root
cause and verifies no regressions were introduced. Do not pass implementation notes.

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

## `cape:codebase-investigator` bug-tracer mode re-dispatch (model: sonnet):

Dispatch `cape:codebase-investigator` in bug-tracer mode (model: sonnet) only when the root cause
from the br bug proves incomplete during the fix — a new failure path is discovered or the fix
reveals deeper issues than the initial diagnosis found.

</agent_references>

<skill_references>

## Load `cape:test-driven-development` with the Skill tool when:

- Step 3 begins -- the bug's root cause is your test target

</skill_references>

<examples>

<example>
<scenario>User has an existing br bug from a prior diagnosis and wants to fix it</scenario>

User: "I have br-42 from the debug session earlier. Let's fix it now."

**Wrong:** Read br-42, skip the test, jump straight to editing the code. The fix works but there's
no regression guard. Three weeks later someone refactors the same area and reintroduces the bug
silently.

**Right:**

1. `br show br-42` -- read root cause: off-by-one in `auth.ts:47`
2. Run reproduction steps from the bug to confirm the symptom locally
3. Write a test that exercises the boundary condition at `auth.ts:47` -- confirm it fails before the
   code change
4. Fix the comparison operator -- confirm the test passes, then run the full suite
5. Re-run reproduction steps, symptom gone. Append Outcome to br-42, present summary, close
   </example>

<example>
<scenario>User reports a new bug and wants it fixed</scenario>

User: "The login form throws a 500 when the email has a plus sign. Can you fix it?"

**Wrong:** Grep for email validation, guess the fix, apply it, move on. No investigation, no
evidence, no test. The fix might address a symptom while the root cause (unescaped input in the SQL
query) remains exploitable.

**Right:**

1. No br bug exists -- run the diagnosis gate. It produces br-58 with root cause: email not
   URL-encoded before being passed to the auth service query
2. Run reproduction: POST login with `user+test@example.com`, confirm 500
3. Write a test for the auth service that passes an email with `+` -- confirm it fails before the
   code change
4. Fix the encoding in the auth service -- confirm the test passes, then run the full suite
5. Re-run reproduction, login succeeds. Append Outcome to br-58, present summary, close </example>

</examples>

<key_principles>

- **Reproduce before fixing** -- confirm the symptom exists locally before changing code
- **Minimal fix** -- root cause only, no drive-by improvements
- **Evidence-based closure** -- verify the original symptom is gone before closing

</key_principles>
