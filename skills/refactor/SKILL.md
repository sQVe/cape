---
name: refactor
description: >
  Behavior-preserving code transformation workflow — the "evolve chain." Use whenever the user wants
  to restructure code without changing what it does. Triggers on: "refactor", "extract", "inline",
  "rename across", "move this to", "reduce duplication", "simplify", "split this function", "clean
  up", "restructure", "decouple", "untangle." Also triggers mid-workflow: when execute-plan hits
  structural problems that block feature work, or when review/code-reviewer flags structural issues
  to act on. Covers single-operation refactorings (Extract Method, Rename) through multi-step
  restructurings (decompose module, invert dependency). Do NOT use for: adding new behavior (use
  execute-plan), fixing broken behavior (use fix-bug), architectural redesign where the target
  structure is unclear (use brainstorm).
---

<skill_overview> Restructure code while preserving behavior. Every transformation follows the same
contract: verify tests pass before touching anything, name the refactoring, execute it in small
verified steps, confirm tests still pass after. The safety net is existing tests and LSP — not new
tests.

This is the "evolve chain" — distinct from building (new behavior) and fixing (broken behavior).
Code works correctly but its structure makes the next change harder than it should be.
</skill_overview>

<rigidity_level> LOW FREEDOM — The safety protocol (test gate → transform → verify) is
non-negotiable. Everything else — which refactoring to apply, step size, whether to use LSP or
manual edits — adapts to context. </rigidity_level>

<when_to_use>

- Direct request: "refactor this," "extract X into Y," "rename across the codebase"
- Mid-feature prep: execute-plan hits tangled code that needs restructuring before the feature can
  land (Kent Beck's "make the change easy, then make the easy change")
- Post-review action: review or code-reviewer flagged structural problems to address
- Post-analysis follow-up: find-test-gaps or analyze-tests surfaced structural coupling or
  duplication

**Don't use for:**

- Adding new behavior, even if it involves restructuring (use execute-plan with TDD)
- Fixing a defect (use fix-bug)
- Architectural redesign where the target structure is unknown (use brainstorm → write-plan)

</when_to_use>

<the_process>

## Step 1: Name the refactoring

Before touching code, identify what you're doing. Use Fowler's refactoring vocabulary when it fits —
it communicates intent precisely and constrains the transformation to a known-safe pattern.

Common refactorings and when they apply:

| Refactoring                           | Signal                                                          |
| ------------------------------------- | --------------------------------------------------------------- |
| Extract Function/Method               | Long function, commented sections, reusable logic               |
| Inline Function                       | Wrapper that adds no clarity, single-use indirection            |
| Move Function/Class                   | Function lives in the wrong module, cross-module coupling       |
| Rename                                | Name no longer reflects purpose, misleading identifier          |
| Extract Variable                      | Complex expression used multiple times or hard to read          |
| Inline Variable                       | Variable adds no clarity over the expression it holds           |
| Split Loop                            | Single loop doing multiple unrelated things                     |
| Replace Conditional with Polymorphism | Switch/if chain on type that grows with each variant            |
| Decompose Module                      | Module has multiple responsibilities, hard to test in isolation |
| Invert Dependency                     | Concrete dependency that should be injected or abstracted       |

If the transformation doesn't map to a named refactoring, describe it in one sentence: "Collapse the
three handler functions into a single dispatch table."

For multi-step restructurings, list the sequence of named refactorings upfront:

```
Plan:
1. Extract Function — pull validation logic out of createUser
2. Move Function — move extracted validator to validation.ts
3. Rename — validator → validateUserInput to match module conventions
```

Present the plan to the user before executing.

---

## Step 2: Verify the safety net

Run `cape check`. If exit code is non-zero, stop — do not proceed. Read `checkResults` from JSON
output and report entries where `passed: false`. Every test must pass before you change anything.

```
Full suite: [PASS/FAIL] — [N] tests, [M] failures
```

**If tests pass:** you have a safety net. Proceed.

**If tests fail:** stop. Pre-existing failures mean you cannot distinguish regressions from prior
breakage. Tell the user: "N tests are already failing. Fix these first, or confirm you want to
proceed knowing the safety net has holes."

**Assess coverage of the target code:**

Check whether the code you're about to transform is actually exercised by tests. Use LSP (find
references from test files), grep for imports/calls from test directories, or read the relevant test
files.

- **Good coverage:** proceed with confidence
- **Thin coverage:** warn the user — "This area has minimal test coverage. The refactoring may
  silently change behavior. Want to add coverage first (cape:find-test-gaps), or proceed carefully?"
- **No coverage:** warn and recommend writing characterization tests first. Offer to load
  `cape:find-test-gaps` to identify what needs coverage. If the user wants to proceed anyway,
  acknowledge the risk and take smaller steps with manual verification.

---

## Step 3: Execute the transformation

Apply the refactoring in small, verified steps. Each step should be independently safe — if tests
break, you know exactly which change caused it.

**For each step:**

1. Make the structural change (one Extract, one Move, one Rename — not all three at once)
2. Run `cape check`
3. If green: continue to the next step
4. If red: undo the step, understand why, try a smaller step or different approach

**Use LSP when available:**

- **Rename:** LSP rename updates all references atomically — safer than find-and-replace
- **Find References:** before moving or extracting, know every caller
- **Go to Definition:** verify imports resolve correctly after moves

If LSP is unavailable, use Grep to find all references before transforming and verify them after.
This is slower but achieves the same safety.

**Scope guard:**

- Change structure, not behavior. If you catch yourself adding error handling, new branches, or
  different logic — stop. That's feature work.
- Don't refactor adjacent code that wasn't part of the plan. Scope creep in refactoring is how
  "quick cleanup" becomes a multi-hour yak shave.
- If the refactoring reveals a bug, note it but don't fix it. Tell the user: "Found a potential bug
  at file:line — [description]. Want to address it separately with cape:debug-issue?"

---

## Step 4: Verify and present

Run `cape check` one final time.

```
## Refactoring complete

**Transformation:** [Named refactoring(s) applied]
**Files changed:** [List with brief description of each change]
**Tests:** [N] passing, [M] unchanged from baseline
**Behavior:** Preserved — no test output changed

Commit this?
```

Wait for user approval, then load `cape:commit` with the Skill tool.

If this refactoring was mid-workflow preparation (called from execute-plan), return to the
triggering skill after committing. The structural problem is resolved — the feature work can
proceed.

</the_process>

<agent_references>

## `cape:codebase-investigator` dispatch:

Dispatch when you need to understand the dependency graph before a Move or Decompose refactoring —
who imports this module, what depends on this interface, how deep does the coupling go.

## `cape:test-runner` dispatch:

Dispatch for every test suite run during the transformation. Keeps test output out of main context.

## `cape:code-reviewer` dispatch:

Optional — dispatch with model `sonnet` after a multi-step restructuring to verify the result is
cleaner than what you started with. Pass the diff and the refactoring plan (not epic requirements —
there is no epic).

</agent_references>

<skill_references>

## Load `cape:find-test-gaps` with the Skill tool when:

- Step 2 reveals the target code has no test coverage
- User wants to add characterization tests before refactoring

## Load `cape:commit` with the Skill tool when:

- Refactoring is complete and user approves
- Mid-workflow: commit the structural change before returning to the triggering skill

</skill_references>

<examples>

<example>
<scenario>Direct request to extract a function</scenario>

User: "Extract the validation logic from createUser into its own function"

**Wrong:** Read createUser, eyeball which lines are "validation," cut-paste them into a new
function, hope nothing breaks.

**Right:**

1. Name it: Extract Function — pull validation logic from createUser
2. Run tests — 47 passing, 0 failing (safety net confirmed)
3. Check coverage — createUser has 6 tests covering validation paths
4. Extract validation into validateUserInput, replace inline logic with call
5. Run tests — 47 passing (behavior preserved)
6. Present summary, commit </example>

<example>
<scenario>Mid-feature prep during execute-plan</scenario>

Working on a feature that adds rate limiting to the API handler. The handler is a 200-line function
that mixes routing, auth, business logic, and response formatting. Adding rate limiting here would
make it worse.

**Wrong:** Jam rate limiting into the monolith. It works but the function is now 240 lines and even
harder to modify next time.

**Right:**

1. Pause feature work. Name the refactoring sequence:
   - Extract Function — pull auth check into middleware
   - Extract Function — pull response formatting into helper
   - Result: handler contains only business logic, rate limiting slots in cleanly
2. Run tests — all green
3. Execute extractions one at a time, testing after each
4. All green. Commit the structural change.
5. Return to execute-plan — rate limiting now drops into a clean handler </example>

<example>
<scenario>Refactoring reveals a bug</scenario>

Extracting a function and notice the original code has an off-by-one error in a boundary check.

**Wrong:** Fix the bug while refactoring. Now the commit mixes structural changes with behavioral
changes, and if tests break you don't know which change caused it.

**Right:** Complete the refactoring with the bug intact — behavior preservation means preserving
bugs too. After committing the refactoring, tell the user: "Found a potential off-by-one at
utils.ts:47. Want to address it with cape:debug-issue?" </example>

<example>
<scenario>No test coverage for target code</scenario>

User: "Decompose this 500-line module into three focused modules"

Run tests — suite passes, but none of the tests import or exercise the target module.

**Wrong:** Proceed with the decomposition. No tests means no safety net — you could silently break
every caller.

**Right:** "This module has no test coverage. Decomposing without tests risks silent breakage. I
recommend adding characterization tests first — want me to load cape:find-test-gaps to identify what
needs coverage?" </example>

</examples>

<key_principles>

- **Tests before transformation** — the suite must be green before you touch anything, or you cannot
  distinguish your regressions from pre-existing failures
- **Name the operation** — Fowler's vocabulary constrains the transformation to known-safe patterns
  and communicates intent to the user and to future readers of the diff
- **One step at a time** — each structural change is independently verified. If tests break, you
  know exactly which change caused it
- **Structure, not behavior** — if you're adding logic, branches, or error handling, you've left the
  evolve chain and entered the build chain
- **Bugs are findings, not fixes** — note them, report them, don't fix them mid-refactoring

</key_principles>

<critical_rules>

1. **Full test suite must pass before any transformation** — pre-existing failures block the
   refactoring until resolved or explicitly acknowledged
2. **Run `cape check` after every step** — not just at the end. Each step must independently
   preserve behavior
3. **Never mix refactoring with behavior changes** — structural commits and behavioral commits are
   separate. If a refactoring reveals a bug, report it; don't fix it
4. **Present the plan before executing multi-step refactorings** — the user approves the sequence of
   named transformations before you start

</critical_rules>
