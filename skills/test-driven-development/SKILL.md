---
name: test-driven-development
description: >
  Enforce the RED-GREEN-REFACTOR cycle when implementing features or fixing bugs. Use this skill
  whenever writing production code that has a corresponding test suite. Triggers on: implementing a
  feature, fixing a bug, adding behavior, changing logic that automated tests can verify. Also use
  when another cape skill (fix-bug, execute-plan) says to follow TDD. Do NOT use for: verification
  testing (manual run-the-app checks), documentation changes, configuration changes, or refactoring
  that has no behavioral change.
---

<skill_overview> Every line of production code must be justified by a failing test. Write the test
first, watch it fail for the right reason, write the minimum code to pass, then improve the code
while tests stay green. This cycle repeats for each behavior — one behavior per cycle, no batching.
</skill_overview>

<rigidity_level> MEDIUM FREEDOM — The RED-GREEN-REFACTOR sequence is immutable. You must not write
production code before a test fails, and you must not refactor while tests are red. The only
flexibility is in test strategy: what to assert, test granularity, and how to structure the test
itself. </rigidity_level>

<when_to_use>

- Implementing a new feature or behavior
- Fixing a bug (the test reproduces the bug before the fix)
- Adding logic that automated tests can verify
- Another cape skill tells you to follow TDD

Don't use for:

- Manual verification ("run the app and check")
- Documentation-only changes
- Configuration or environment changes
- Pure refactoring with no behavioral change (use `cape:refactor`)

</when_to_use>

<critical_rules>

1. **Exactly one new `it()`/`test()` block per Write/Edit call.** Count the new test cases in what
   you are about to write. If the count is not 1, delete extras before saving. This is the single
   most important rule — every other TDD benefit depends on it.
2. **Never write production code without a failing test.** If you catch yourself writing code first,
   stop, delete it, and write the test.
3. **The test must fail for the right reason.** A compile error or import failure is not a valid RED
   state. The assertion itself must fire and fail.
4. **Run tests after every phase.** RED: test fails. GREEN: test passes, full suite passes.
   REFACTOR: full suite passes. No exceptions.
5. **Stop if there is no test infrastructure.** Do not create test frameworks, runners, or
   configuration. Inform the user and let them set it up.
6. **Do not skip the refactor phase.** Look at the code. If nothing needs improvement, that is fine
   — but you must look.

</critical_rules>

<the_process>

## Step 0: Confirm test infrastructure

Before writing anything, verify the project has a working test setup. Run `cape check` to confirm
tests execute. If exit code is non-zero, stop — do not proceed. Read `checkResults` from JSON output
and report entries where `passed: false`. If there is no test runner, no test directory, or tests do
not run — stop and tell the user. Do not bootstrap test infrastructure yourself.

Identify the test framework and conventions from existing test files. Match them exactly — file
naming, assertion style, describe/it structure, helper patterns.

## Step 1: RED — Write a failing test

Write exactly one `it()`/`test()` block for the next behavior. Not two. Not "all the obvious ones."
One. When creating a new test file, write the `describe` scaffold and one `it()` block inside it.
When adding to an existing test file, add one `it()` block.

The test should:

- Target a single, specific behavior
- Read as a behavioral sentence ("returns error when input is empty")
- Assert the expected outcome, not implementation details

**STOP writing test code.** Dispatch `cape:test-runner` immediately. Do not write another `it()`
block, a test helper for a future behavior, or any production code. The test runner is the gate.

The test must fail. Inspect the failure output carefully:

- **Right failure:** The assertion fires because the behavior does not exist yet. The test runs,
  reaches the assertion, and the assertion fails. This is what you want.
- **Wrong failure:** Import error, syntax error, missing module, type error, or any failure that
  happens before the assertion executes. Fix the test until the failure comes from the assertion
  itself.

Do not proceed to Step 2 until you have a test that fails for the right reason.

## Step 2: GREEN — Make it pass

Write the minimum production code to make the failing test pass. Minimum means:

- No code that is not exercised by the current test
- No anticipating future requirements
- No generalizing beyond what the test demands
- Hard-coded values are acceptable if that is all the test requires

Dispatch `cape:test-runner` to run the test. It must pass. Then dispatch `cape:test-runner` to run
the full test suite to confirm nothing else broke. If other tests fail, fix the regression before
moving on.

## Step 3: REFACTOR — Improve the code

With all tests green, look at what you just wrote and the code around it. Improve clarity, remove
duplication, simplify structure. This applies to both production code and test code.

Good refactoring targets:

- Duplicated logic between the new code and existing code
- Unclear names that emerged from the minimum-code phase
- Overly complex conditionals that can be simplified
- Test setup that repeats across multiple tests

Dispatch `cape:test-runner` to run the full test suite after refactoring. Every test must still
pass. If a test breaks during refactoring, undo the refactor and try a smaller step.

## Step 4: Repeat

Go back to Step 1 with the next behavior. Each cycle adds one behavior. Continue until all required
behaviors are implemented.

**Before starting the next cycle, verify you are not batching:**

- How many new test cases did I write in the last cycle? (Must be exactly 1.)
- Did I run the test runner between writing the test and writing production code? (Must be yes.)
- Am I about to write multiple tests for the next step? (Must be no — write one, run it, then decide
  if the step needs another cycle.)

</the_process>

<agent_references>

## `cape:test-runner` protocol:

**Pass:** test command (single test for RED/GREEN, full suite for REFACTOR), working directory.
**Expect back:** pass/fail status with counts, complete failure output for any failing tests.

</agent_references>

<examples>

<example>
<scenario>Implementing a function that validates email addresses</scenario>

**Wrong:**

```
1. Write the validateEmail function with regex
2. Write tests for valid and invalid emails
3. Run tests — they pass
```

Production code existed before any test failed. There is no proof the tests can catch regressions —
they may be tautological.

**Right:**

```
Cycle 1:
  RED:      Write test: "returns false for empty string" → run → fails (function missing)
  GREEN:    Create validateEmail, return false → run → passes
  REFACTOR: Nothing to improve yet

Cycle 2:
  RED:      Write test: "returns true for valid email" → run → fails (always returns false)
  GREEN:    Add regex check → run → passes
  REFACTOR: Extract regex to named constant for clarity

Cycle 3:
  RED:      Write test: "returns false for missing domain" → run → fails (regex too permissive)
  GREEN:    Tighten regex → run → passes
  REFACTOR: Simplify regex, consolidate test setup into helper
```

Each cycle proves the test catches the behavior before the code satisfies it. </example>

<example>
<scenario>Fixing a bug where user creation silently ignores duplicate emails</scenario>

**Wrong:**

```
1. Read the code and find the bug
2. Fix the duplicate check
3. Write a test to confirm the fix works
4. Run tests — they pass
```

The test was written after the fix. It never failed. It might assert the wrong thing and still pass
by coincidence.

**Right:**

```
RED:      Write test: "returns error when email already exists" → run → fails
          (function returns success for duplicate)
          This failure IS the bug reproduction.
GREEN:    Add duplicate check before insert → run → passes
REFACTOR: Extract duplicate-check into reusable query method
```

The failing test is the proof that the bug existed. The passing test is the proof that the fix
works. </example>

<example>
<scenario>Creating a new test file for a module with multiple behaviors</scenario>

**Wrong (batching — the most common failure mode):**

Write tool creates a test file with all foreseeable tests at once:

```typescript
describe('buildItems', () => {
  it('returns empty array for no input', () => { ... });
  it('produces header followed by rows', () => { ... });
  it('interleaves headers between groups', () => { ... });
  it('preserves data in row items', () => { ... });
  it('handles edge case X', () => { ... });
});
```

All five tests fail together because the module doesn't exist. RED is meaningless — no single test
proved it detects the absence of one behavior.

**Right — cycle 1 creates the file with one `it()` block:**

```typescript
describe('buildItems', () => {
  it('returns empty array for no input', () => {
    expect(buildItems([])).toEqual([]);
  });
});
```

STOP. Run the test. It fails (module missing). Write the module with `return []`. Test passes.
Refactor if needed. Only then write the second `it()` block via Edit.

Each cycle adds one `it()` block to the existing file. The file grows incrementally, not all at
once. </example>

</examples>

<key_principles>

- A test that has never failed proves nothing. The RED phase exists to prove the test can detect the
  absence of the behavior.
- One behavior per cycle keeps changes small and failures easy to diagnose.
- Minimum code in GREEN prevents speculative complexity. If a behavior is not tested, it should not
  exist.
- Refactoring happens only when tests are green. Red tests mean the code is in an unknown state — do
  not change two things at once.
- Match existing test conventions. Do not introduce a new style, framework, or pattern unless the
  project has none.
- Tests describe behavior, not implementation. "Calls database.save" is implementation coupling.
  "Persists the record" is behavior.

</key_principles>

<anti_batching>

## The batching failure mode

The strongest pull is to write all foreseeable tests at once — especially when creating a new test
file or when a multi-step plan is visible. This destroys TDD even when each test looks correct.

**Self-check before every Write/Edit of test code:** Count the new `it()`/`test()` blocks. If > 1,
delete extras. A new test file with a `describe` and five `it()` blocks is batching. A new test file
with a `describe` and one `it()` block is correct.

**Plan tunnel vision:** Treat every expanded-plan step except the current one as invisible. The next
test emerges from code state after the current cycle completes, not from a plan.

</anti_batching>
