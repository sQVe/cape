---
name: expand-task
description: >
  Internal skill called by execute-plan before implementation begins. Takes a single br task and
  expands it into a concrete, zero-context implementation plan with exact file paths, line numbers,
  code changes, and verification commands. Never called directly by users — execute-plan invokes
  this automatically when a task lacks an expanded plan. Do NOT use for creating epics (use
  cape:write-plan), stress-testing edge cases (use cape:task-refinement), or executing the plan
  itself (use cape:execute-plan).
---

<skill_overview> Ground a br task in codebase reality before implementation begins. Read the task,
investigate the actual files and patterns, and produce a step-by-step plan where every change
references a real file at a real line number with a concrete verification command.

Core contract: no step references an imagined file. No step lacks a verification command. Someone
picking this plan up cold can follow it without asking questions. </skill_overview>

<rigidity_level> LOW FREEDOM — The investigation phase and output structure (steps with file paths,
changes, verification) are non-negotiable. How deep you investigate and how granular the steps are
adapts to the task's complexity. </rigidity_level>

<when_to_use>

- Execute-plan is about to start coding a task
- A task's implementation section references files or patterns that haven't been verified
- A task needs concrete substeps before TDD can begin

**Don't use for:**

- Creating epics or tasks (use `cape:write-plan`)
- Stress-testing edge cases (use `cape:task-refinement`)
- Executing the plan (use `cape:execute-plan`)

</when_to_use>

<the_process>

## Step 1: Load context

Read the task and its parent epic:

```bash
br show <task-id>
br show <epic-id>
```

Check whether the task already has an expanded plan (look for an `## Expanded plan` section in the
design field). If it does, skip expansion — the task is already grounded.

Extract from the task:

- **Goal** — what this task delivers
- **Implementation hints** — any file paths, patterns, or approaches mentioned
- **Success criteria** — what "done" looks like

Extract from the epic:

- **Requirements** — the immutable guardrails
- **Anti-patterns** — what must not happen
- **Architecture** — where components live
- **Durable decisions** — settled choices that constrain implementation

---

## Step 2: Investigate the codebase

This is the step that separates a grounded plan from a speculative one. Dispatch
`cape:codebase-investigator` to answer the questions below. Fall back to Grep/Glob/Read if agent
dispatch isn't available.

- **Where does this change land?** Find the exact files and line ranges that need modification. Not
  the files the task _imagines_ exist — the files that _actually_ exist.
- **What patterns should this follow?** Find 1-2 similar implementations in the codebase. These are
  the templates for the new code.
- **What's adjacent?** Identify callers, importers, and tests that will be affected by the change.
  These determine the blast radius.
- **What can be reused?** Find existing utilities, helpers, types, or test fixtures that the
  implementation should use rather than reinvent.

Capture findings as you go. Every file path you reference must come from this investigation, not
from the task description or your imagination.

---

## Step 3: Produce the expanded plan

Build a step-by-step plan where each step is a logical unit of work — small enough to verify
independently, large enough to be meaningful. Each step maps to one TDD cycle (write test,
implement, verify).

**Calibrate granularity to complexity:**

- **Simple task** (single file, clear pattern to follow): 2-4 steps
- **Medium task** (multiple files, new pattern): 4-7 steps
- **Complex task** (cross-cutting, new architecture): 7-10 steps

If a task needs more than 10 steps, it should be split. Instead of producing a sprawling plan,
append a `## Split recommendation` section to the task's design field listing the natural split
points and recommended subtask titles. Do not produce the expanded plan — execute-plan will handle
the split.

**Each step must include:**

```
### Step N: [What this step delivers]

**Pattern:** [file:line — the existing implementation to follow]

**Changes:**
- `path/to/file.ts:L23-30` — [what to change and why]
- `path/to/new-file.ts` (new) — [what it contains, following pattern from X]

**Test:** [specific test to write first — the RED in red-green-refactor]

**Verify:** `[exact command to run]`
```

- **Pattern** references a real file the step should mirror. Omit if no relevant pattern exists.
- **Changes** reference real files at real line numbers. For new files, name them following existing
  conventions found during investigation.
- **Test** describes the specific test case for this step — feeds directly into TDD.
- **Verify** is an exact shell command. Not "run tests" — `npm test -- --grep 'auth strategy'` or
  `go test ./internal/auth/... -run TestGoogleStrategy`.

**Include a final verification step** that runs the full relevant test suite and any pre-commit
hooks, confirming the complete change works together.

---

## Step 4: Append to the task

Read the task's current design field and append the expanded plan:

```bash
br show <task-id>
br update <task-id> --design "$(cat <<'EOF'
[existing design content]

## Expanded plan (expand-task)

### Investigation findings

**Files to modify:**
- `path/to/file.ts` — [role in this change]

**Patterns to follow:**
- `path/to/similar.ts:L10-45` — [what it demonstrates]

**Reusable code:**
- `path/to/utils.ts:functionName()` — [what it does]

**Blast radius:**
- [Callers/importers/tests affected by this change]

### Steps

[Steps from Step 3]

### Final verification
`[full test suite command]`
`[pre-commit hook command if applicable]`
EOF
)"
```

Control returns to execute-plan, which follows the expanded steps using TDD.

</the_process>

<examples>

<example>
<scenario>Task says "add OAuth strategy following local strategy pattern" but doesn't specify files</scenario>

Investigation finds:

- `auth/strategies/local.ts:1-30` — existing strategy pattern
- `auth/passport-config.ts:23` — strategy registration array
- `tests/auth/local.test.ts` — existing test pattern

**Wrong:** Produce steps referencing `auth/strategies/google.ts` without verifying the directory
exists or checking how `passport-config.ts` imports strategies.

**Right:** Investigation confirms `auth/strategies/` exists, discovers strategies are registered via
dynamic import at `passport-config.ts:23-28`, and finds the test helper at
`tests/helpers/auth-fixture.ts:15`. Steps reference all of these with real line numbers. </example>

<example>
<scenario>Task is trivially simple — rename a function across three files</scenario>

**Wrong:** Produce 10 steps with elaborate investigation. The overhead of expansion exceeds the
implementation work.

**Right:** 2-3 steps: find all references (investigation reveals 3 files), update each reference,
run tests. Quick investigation, minimal plan. </example>

<example>
<scenario>Investigation reveals the task needs more than 10 steps</scenario>

**Wrong:** Produce a 15-step plan that will exhaust context before completion.

**Right:** Flag to execute-plan: "This task covers too much ground for a single implementation pass.
Recommend splitting into: (1) [first natural boundary], (2) [second natural boundary]." Don't
produce the expanded plan — let execute-plan handle the split. </example>

</examples>

<key_principles>

- **Real files, real lines** — every reference comes from investigation, never from imagination
- **Zero-context sufficiency** — someone picking this up cold can follow every step
- **Pattern-first** — point to existing code as the template before describing changes
- **Verification at every step** — each step has an exact command, not "run tests"
- **Right-sized** — 2-4 steps for simple tasks, 7-10 for complex; flag splits beyond 10

</key_principles>

<critical_rules>

1. **Investigate before planning** — never produce steps referencing files you haven't verified
   exist
2. **Every step has a verify command** — exact shell commands, not vague instructions
3. **Skip if already expanded** — check for `## Expanded plan` section before doing work
4. **Flag oversized tasks** — if expansion would exceed 10 steps, recommend splitting instead
5. **Respect anti-patterns** — expanded plan must not introduce approaches the epic forbids

</critical_rules>
