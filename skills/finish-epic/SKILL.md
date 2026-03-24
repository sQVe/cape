---
name: finish-epic
user-invocable: false
description: >
  Verify and close a br epic after all tasks are complete. Use when the user says "finish the epic",
  "we're done", "close out the epic", "wrap this up", all tasks are done and the user wants to close
  it, or execute-plan detects all success criteria appear met. Runs final verification (tests,
  linting, hooks), checks every success criterion with evidence, executes manual verification steps
  from the epic, appends an Outcome to the epic, and closes it. Also triggers on epic IDs combined
  with closure intent. NOT for: implementing tasks (use execute-plan), creating plans (use
  write-plan), or git operations (merge/PR/push — user handles those).
---

<skill_overview> The final step in the build chain. After execute-plan has completed all tasks, this
skill runs a comprehensive verification pass, confirms every success criterion has evidence of
completion, closes the epic, and reports what was accomplished.

Core contract: the epic only closes when every success criterion has evidence. </skill_overview>

<rigidity_level> LOW FREEDOM — The verification gate and evidence-based success criteria checks are
non-negotiable. How you run verification and what you include in the summary adapts to context.
</rigidity_level>

<when_to_use>

- All tasks in a br epic are closed
- User says "finish the epic", "we're done", "close it out", "wrap this up"
- execute-plan step 4 detects all success criteria appear met
- User references an epic ID and wants to close it out

**Don't use for:**

- Tasks still need implementation (use execute-plan)
- Epic doesn't exist yet (use brainstorm then write-plan)
- Git operations — merge, PR, push (user handles these)

</when_to_use>

<the_process>

## Step 1: Orient

**Announce:** "I'm using the finish-epic skill to verify and close this epic."

Find the epic and check its state:

```bash
br list --type epic --status open
br show <epic-id>
br list --status open --parent <epic-id>
```

- **All tasks closed** — proceed to step 2
- **Open tasks remain** — report which tasks are still open and stop; don't close open tasks just to
  proceed

---

## Step 2: Verify

Run four verification passes. All must pass before closing.

### 2a: Automated checks

Dispatch `cape:test-runner` to run the project's full test suite, linter, and pre-commit hooks. This
keeps verbose output out of the main context. Adapt commands to the project's tooling.

If any fail, report the failures and stop. Don't close an epic with broken checks.

### 2b: Success criteria audit

Read the epic's success criteria. For each criterion, find concrete evidence that it's met — test
output, file existence, behavior you can demonstrate.

Present a checklist:

```
## Success criteria audit — <epic-id>

- [x] Criterion 1 — Evidence: [what proves it]
- [x] Criterion 2 — Evidence: [what proves it]
- [ ] Criterion 3 — NOT MET: [what's missing]
```

If any criterion is not met, report what's missing and stop. The user can create a new task with
`br create` and run `/cape:execute-plan` to address the gap before retrying finish-epic.

### 2c: Code review

Dispatch `cape:code-reviewer` to review the implementation against the epic's requirements,
anti-patterns, and success criteria. The reviewer compares what was built against what was planned
and flags deviations. Address any critical findings before proceeding.

### 2d: Manual verification

If the epic specifies manual verification steps (e.g., "run the app and confirm X works", "verify
the CLI outputs Y"), execute them and record the results.

Skip this pass if the epic has no manual verification steps.

---

## Step 3: Summarize

Append an Outcome section to the epic. Read existing content first, then append:

```bash
br show <epic-id>
br update <epic-id> --design "<existing content>

## Outcome

**Completed:** YYYY-MM-DD
**Tasks:** [N tasks completed]
**Summary:** [2-3 sentences: what was built, key decisions, divergences from original design]
**Verification:** All tests passing, all success criteria met[, manual verification passed]"
```

---

## Step 4: Close and report

```bash
br close <epic-id>
```

Present a completion report:

```
## Epic complete — <epic-id>: <title>

**Summary:** [What was built]
**Tasks completed:** [N]
**Success criteria:** [All N met]
**Verification:** Tests passing, linter clean[, manual checks passed]

Epic closed.

Run `/cape:commit` to commit any remaining changes.
Optionally run `/cape:find-test-gaps` to verify test coverage before shipping.
```

</the_process>

<agent_references>

## Dispatch `cape:test-runner` when:

- Running the full test suite, linter, and pre-commit hooks in step 2a
- Keeps verbose output out of the main context

## Dispatch `cape:code-reviewer` when:

- Step 2c: reviewing the implementation against epic requirements before closing
- Flags deviations from the plan, anti-pattern violations, and quality issues

If agents aren't available, run checks and review manually with Glob/Grep/Read.

</agent_references>

<examples>

<example>
<scenario>All tasks done, everything passes</scenario>

Epic cape-abc has 4 tasks, all closed. Success criteria: "CLI validates input", "tests pass",
"README updated."

1. `br list --status open --parent cape-abc` — no open tasks
2. Run tests — all pass. Run linter — clean.
3. Audit: CLI validates input (test at cli_test.go:42 confirms), tests pass (just ran), README
   updated (diff shows new section). All criteria met.
4. Append Outcome to epic, close, present report. </example>

<example>
<scenario>Tasks done but a success criterion isn't met</scenario>

Epic has 3 tasks, all closed. Success criteria include "integration tests cover all endpoints."
Audit reveals two endpoints have no integration tests.

**Wrong:** Close the epic — "the tasks are done so the epic must be done." Success criteria exist to
catch exactly this gap.

**Right:** Report: "Success criterion not met: integration tests cover all endpoints. Missing
coverage for POST /users and DELETE /users/:id. Epic stays open." </example>

<example>
<scenario>Open tasks remain</scenario>

User says "let's wrap up the epic" but br-7 is still open.

**Wrong:** Close br-7 to unblock epic closure. The task isn't done — closing it loses the work
signal.

**Right:** "br-7 (Add rate limiting) is still open. Finish or close it before wrapping up the epic."
</example>

</examples>

<key_principles>

- **Evidence before closure** — every success criterion needs proof, not a checkmark
- **Don't force it** — if something isn't ready, report what's missing and stop
- **Automated checks are the gate** — broken tests or linting mean the epic isn't done
- **The outcome is the record** — future sessions read it to understand what shipped

</key_principles>

<critical_rules>

1. **All tasks must be closed** — don't close open tasks to force epic closure
2. **All automated checks must pass** — tests, linting, hooks
3. **All success criteria need evidence** — verify and cite, don't self-certify
4. **Append Outcome before closing** — `br show` then `br update --design` with existing content
5. **Stop on failure** — report what's missing, don't close a failing epic
6. **No git operations** — no merge, no PR, no push; user handles integration

</critical_rules>
