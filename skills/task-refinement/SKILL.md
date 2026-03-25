---
name: task-refinement
description: >
  Stress-test a br task for missing edge cases, vague criteria, implicit assumptions, and
  unspecified failure modes before implementation begins. Use after cape:write-plan creates a task
  and before cape:execute-plan picks it up. Triggers on: "refine this task", "stress-test br-N",
  "check this task", "is this task ready", reviewing a task for completeness, any mention of edge
  cases or failure modes in the context of a br task. Also use when the user wants to harden a task
  description or feels unsure whether a task captures enough detail. Do NOT use for creating epics
  or tasks from scratch (use cape:write-plan), executing tasks (use cape:execute-plan), or
  investigating bugs (use cape:debug-issue).
---

<skill_overview> Review a single br task with SRE-level scrutiny: surface missing edge cases, vague
success criteria, implicit assumptions, unspecified failure modes, and stale file references. Then
refine the task to close every gap found.

Core contract: no task passes refinement with vague criteria, untested failure paths, or assumptions
that haven't been verified against the actual codebase. </skill_overview>

<rigidity_level> LOW FREEDOM -- The review categories and codebase verification are non-negotiable.
How deep you go in each category adapts to the task's complexity and risk. </rigidity_level>

<when_to_use>

- A br task exists and needs review before implementation
- User wants to harden a task's edge case coverage
- User doubts whether a task description is complete enough
- Transitioning from write-plan to execute-plan

**Don't use for:**

- No task exists yet (use `cape:write-plan`)
- Executing a task (use `cape:execute-plan`)
- Bug investigation (use `cape:debug-issue`)
- Epic-level review (review the epic's requirements in `cape:brainstorm`)

</when_to_use>

<the_process>

## Step 1: Load the task

Identify the target task. If the user specified a task ID, use it. Otherwise, find the next ready
task:

```bash
br ready
```

If multiple open epics exist, ask the user which epic to target before proceeding. Use
`br ready --parent <epic-id>` to scope results.

Read the task and its parent epic:

```bash
br show <task-id>
br show <epic-id>
```

The epic's requirements, anti-patterns, and success criteria are the frame of reference. Every
refinement must serve the epic's goals, not add scope.

---

## Step 2: Verify against reality

Dispatch `cape:codebase-investigator` to verify the task's claims against the actual codebase:

- Do the file paths and function names in the task exist?
- Do the "study existing code" references point to real implementations?
- Are the patterns the task assumes (module structure, test setup, API shapes) accurate?
- Are there existing utilities or helpers the task should reuse but doesn't mention?

This step exists because tasks written during planning often reference code as it was imagined, not
as it is. A single stale path can derail an entire implementation session.

---

## Step 3: Review through six lenses

Start by noting what's already strong. Criteria that are already specific and testable, edge cases
already covered, well-chosen implementation approaches -- call these out explicitly before listing
problems. This matters because refinement that only finds flaws teaches the model that every task is
broken. Good tasks exist. Recognize them.

Then work through each category. Skip cleanly when a category doesn't apply, but never skip the
check itself.

**If investigation reveals a blocking issue** -- the task's entire premise is invalid, a core
dependency doesn't exist, or the task belongs in a different repository -- escalate it prominently
at the top of the report with a recommendation to close or re-scope. Then still complete the
remaining categories. The user may re-scope rather than close, and a complete review is useful
either way.

### 3a. Vague criteria

Flag criteria that a reviewer who has never seen the codebase couldn't verify:

- Subjective language ("works correctly", "handles errors properly", "is performant")
- No concrete threshold or observable outcome
- Could be marked complete without verifying behavior

**Tighten each one.** "Handles errors" becomes "returns 422 with validation errors when required
fields are missing." "Is performant" becomes "responds within 200ms for 95th percentile requests."

Criteria that are already specific and testable need no changes -- leave them alone.

### 3b. Missing edge cases

Inputs and states the task doesn't mention: empty/nil/zero-length input, boundary values, Unicode,
concurrent access, already-exists/duplicate scenarios, permission edge cases.

Each missing edge case becomes a test case in the implementation checklist.

### 3c. Unspecified failure modes

For every external interaction (network, file I/O, database, user input), ask: what happens when it
fails? Timeouts, malformed responses, partial failures, permission denied.

The goal isn't paranoid defensiveness -- it's making failure behavior a deliberate decision rather
than an accident.

### 3d. Implicit assumptions

Surface things the task takes for granted: files assumed to exist, authentication assumed to be
enforced, single-threaded execution assumed, response shapes assumed stable.

Each becomes an explicit precondition or a test that validates the assumption.

### 3e. Stale references

Using codebase-investigator results from step 2, flag nonexistent file paths, renamed functions,
patterns that don't match the actual code, unavailable dependencies. Replace each with the correct
reference.

### 3f. Test coverage gaps

Every success criterion and every edge case from 3b should have a corresponding test. Flag gaps
where behavior would ship untested.

---

## Step 4: Present and apply

Compile findings into a structured review. Group by category, showing what was found and the
proposed fix for each item.

**For HITL tasks:** present the full review and proposed changes. Ask the user to approve, modify,
or reject each finding. Then apply the approved changes.

**For AFK tasks:** apply all refinements directly, then present a summary of what changed.

Update the task:

```bash
br show <task-id>
br update <task-id> --design "$(cat <<'EOF'
[existing design content]

## Refinement (task-refinement)
- [Category]: [What was found] → [What was changed]
- [Category]: [What was found] → [What was changed]
EOF
)"
```

Present completion:

```
Task <task-id> refined.

Strengths: [what was already good -- specific criteria, covered edge cases, etc.]

Changes:
- [N] vague criteria tightened
- [N] edge cases added
- [N] failure modes specified
- [N] assumptions made explicit
- [N] stale references corrected
- [N] test gaps closed

Continue with `cape:execute-plan` to implement.
```

If the task is well-specified and investigation confirms its claims, say so. A clean bill of health
is a valid refinement outcome -- not every task needs changes.

</the_process>

<agent_references>

## Dispatch `cape:codebase-investigator` when:

- The task references file paths, function names, or code patterns that need verification
- The task assumes module structure, test setup, or API shapes
- You need to find existing utilities the task should reuse

## Dispatch `cape:fact-checker` (optional) when:

- The task has many specific function/path claims to verify in step 3e (stale references)
- The task makes claims about API behavior or external dependency semantics
- You want structured Confirmed/Refuted/Partially correct verdicts for claim-heavy tasks

## Dispatch `cape:notebox-researcher` (optional) when:

- The task involves a system the user has worked on before
- Past design decisions or research notes may be relevant to refinement
- You want to check if similar edge cases were discussed in past sessions

</agent_references>

<examples>

<example>
<scenario>Task with vague success criteria</scenario>

Task says: "Success criteria: handles authentication errors gracefully."

**Wrong:** Accept the criterion as-is. During implementation, "gracefully" means something different
to every engineer. One returns 401, another shows a modal, a third retries silently.

**Right:** Tighten to: "Returns 401 with `{ error: 'token_expired' }` body when JWT validation
fails. Returns 403 with `{ error: 'insufficient_scope' }` when the token lacks required claims."
Each criterion is now testable without ambiguity. </example>

<example>
<scenario>Task assumes a file exists that was renamed</scenario>

Task implementation says: "Study `src/auth/middleware.ts` for the existing pattern."

Codebase-investigator finds the file was renamed to `src/middleware/auth.ts` during a recent
refactor.

**Wrong:** Skip verification, start implementation, waste 10 minutes discovering the file moved.

**Right:** Codebase-investigator catches the stale reference in step 2. Replace with the correct
path and note any structural changes that affect the task's approach. </example>

<example>
<scenario>Task missing failure mode for a network call</scenario>

Task adds a step to "fetch user profile from the external API" but doesn't specify timeout behavior
or what happens when the API is down.

**Wrong:** Leave it unspecified. During implementation, the engineer picks a 30-second timeout and
throws an unhandled error on failure. Production users see a blank page.

**Right:** Add explicit failure behavior: "Timeout after 5s. On failure, return cached profile if
available (< 1h old), otherwise return 503 with retry-after header. Add test for timeout and cache
fallback paths." </example>

<example>
<scenario>Well-specified task that needs minimal refinement</scenario>

Task has specific success criteria ("returns 200 with JSON array parseable by jq"), concrete test
cases, and correct file references confirmed by codebase-investigator.

**Wrong:** Force-find problems to justify the review. Rewrite criteria that were already testable.
Add edge cases unrelated to the epic's goals. The output looks thorough but adds noise and scope.

**Right:** Acknowledge the strengths: "Success criteria are already specific and testable.
Implementation checklist maps to real files." Flag only genuine gaps (missing boundary test, one
stale import). A short, honest report is more valuable than a long, manufactured one. </example>

<example>
<scenario>Investigation reveals task is fundamentally unexecutable</scenario>

Task references `src/api/routes.ts` and assumes an Express server. Codebase-investigator finds the
project is a CLI tool with no HTTP layer.

**Wrong:** Bury the architectural mismatch in section 3d as one finding among many. The user reads
through six categories of polish before discovering the task can't be implemented at all.

**Right:** Lead with the blocker: "Blocking: this project has no API layer. The task either belongs
in a different repository or needs complete re-scoping." Then complete the remaining categories --
if the task gets re-scoped to a different project, the vague criteria and missing edge cases still
need fixing. </example>

</examples>

<key_principles>

- **Testable means testable** -- every criterion must be verifiable by someone who has never seen
  the codebase; if you can't write a test for it, it's not a criterion
- **Verify before trusting** -- task descriptions written during planning are hypotheses about the
  codebase; codebase-investigator turns hypotheses into facts
- **Failure behavior is a feature** -- unspecified failure modes become production surprises; make
  every failure path a deliberate choice
- **Serve the epic, not your thoroughness** -- refinement adds precision, not scope; if a finding
  isn't relevant to the epic's goals, drop it

</key_principles>

<critical_rules>

1. **Always verify with codebase-investigator** -- never trust file paths or patterns from the task
   without checking
2. **Check all six categories** -- skip findings that don't apply, never skip the check
3. **Acknowledge strengths first** -- call out what's already good before listing problems; a clean
   bill of health is a valid outcome
4. **Escalate blockers at the top** -- if the task is fundamentally unexecutable, lead with it and
   recommend closing or re-scoping; then complete the remaining review
5. **Respect HITL/AFK modes** -- present for approval on HITL, apply directly on AFK
6. **Don't add scope** -- refinement tightens existing goals; new features belong in new tasks
7. **Every edge case needs a test** -- if you add an edge case, add the corresponding test case to
   the implementation checklist

</critical_rules>
