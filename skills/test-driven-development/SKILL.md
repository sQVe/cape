---
name: test-driven-development
description: >
  Write the failing test before the production code that justifies it. Use for any feature, fix, or
  logic change automated tests can verify. Not for docs, config, or behavior-preserving refactors.
---

# Test-driven development

Let the next test define the next code change. Write a test that exposes the missing behavior, watch
it fail, make it pass with the simplest change, then clean up only when it helps.

Red-before-green and behavior-focused tests are fixed; test shape, scope, and whether cleanup is
worth doing adapt to context.

## Rules

1. **Red before green.** Write or update the test first and watch it fail for the behavior you
   intend to add or fix before editing production code. Reasoning, snapshots, type errors, and
   after-the-fact tests do not substitute for the failing test.
2. **One behavior at a time.** Add only the code the current test demands. Don't front-load tests
   for future cases you can already imagine; let each change inform the next test.
3. **Test behavior, not implementation.** Tests describe what changes for the caller, not which
   internal method ran.
4. **Skip only with explicit user approval.** Skip it only when the user accepts doing so for a
   stated reason, and report that the TDD contract was overridden. Once overridden, name why the
   failing test is impractical, then use the closest executable check: a targeted script, a manual
   reproduction command, browser automation, a snapshot comparison, a log assertion, or a focused
   integration check. The fallback still has to run and still has to fail first. It is not a second
   way to opt out.
5. **Don't fake green.** Never change a test so it matches a wrong implementation. Never weaken an
   existing assertion unless the expected behavior genuinely changed, and say what changed and why.

## Process

### 1. Confirm tests can run

Run the project's documented check command. If tests cannot run, stop and tell the user; do not
bootstrap a framework yourself. Read existing test files and match their file naming, assertion
style, structure, and helpers exactly.

### 2. Write a failing test

Pick the next missing behavior and write the smallest test that demonstrates it. For a bug fix, the
test reproduces the bug. Run it and confirm it fails because the behavior is missing, not because of
syntax, imports, or setup problems; fix those in the test first.

Some tests aren't worth writing. A test that mostly exercises mocks, encodes current implementation
details, depends on timing or unrelated global state, needs expensive infrastructure for a small
fix, or would be deleted right after proving the fix belongs to rule 4: say which of these applies,
get approval, and fall back to the closest executable check.

### 3. Make it pass, then clean up if it helps

Write the simplest production change that satisfies the test. Re-run the focused test, then the
broader affected suite to confirm nothing else broke. If the minimal change left duplication or
awkward names, do a small refactor and re-run tests. Otherwise move to the next behavior.

When you report the change, name the check that failed first and the failure it produced, then the
passing run after. The only report without a failing-before run is one rule 4 covers. Name the user
approval that overrode the contract and the check that ran in place of the red step.

## Agents

Dispatch `cape:test-runner` (model: haiku) when:

- A focused run, suite confirmation, or failure capture would pollute your context. Pass the test
  command and working directory; expect pass/fail status with counts and complete failure output.

## Examples

**Wrong:** Add duplicate-email handling in the service, then write tests for duplicates, invalid
formats, and imagined edge cases, and run the suite once at the end. The code changed before any
test proved the gap, and the tests batched several behaviors.

**Right:** Write one test showing duplicate emails are currently accepted. Watch it fail. Add the
smallest guard that rejects duplicates. Re-run the focused test, then the suite. Move to the next
behavior.
