---
name: test-driven-development
description: >
  Drive behavioral changes with tests that are written before the production code they justify. Use
  this skill whenever implementing a feature, fixing a bug, adding behavior, or changing logic that
  automated tests can verify. Also use when another cape skill (fix-bug, execute-plan) says to
  follow TDD. Do NOT use for: verification testing (manual run-the-app checks), documentation
  changes, configuration changes, or refactoring that has no behavioral change.
---

<skill_overview> Let the next test define the next code change. Write a test that exposes the
missing behavior, make it pass with the simplest change, then decide whether small cleanup would
improve clarity. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — Test-first and behavior-focused are rigid; test shape, scope, and
whether cleanup is worthwhile adapt to context. </rigidity_level>

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

1. **Test before production code.** For the next behavior or bug, write or update the test first and
   watch it fail for the behavior you intend to add or fix.
2. **Keep each change behavior-sized.** Drive one behavior at a time, add only the code needed for
   the current test, and avoid batching future behaviors into the same pass.
3. **Cleanup is optional, not ceremonial.** Once the behavior passes, improve names or structure
   only when it clearly helps; skip cleanup when no useful simplification is apparent.

</critical_rules>

<the_process>

## Step 1: Confirm you can lean on tests

Before changing code, verify the project has working test infrastructure. Run `cape check` or the
relevant project test command. If tests cannot run, stop and tell the user — do not bootstrap a
framework yourself.

Identify the test framework and conventions from existing test files. Match them exactly: file
naming, assertion style, test structure, and helper patterns.

---

## Step 2: Drive the next behavior with a failing test

Pick the next missing behavior. Write or update the smallest test that demonstrates it. For bug
fixes, the test should reproduce the bug before the fix.

Run the relevant test. The failure should show that the behavior is missing or incorrect, not that
the test file is broken. If the failure comes from syntax, import, setup, or other pre-assertion
problems, fix the test first.

When helpful, dispatch `cape:test-runner` to run the focused test or capture failure output.

---

## Step 3: Make it pass, then decide whether cleanup helps

Write the simplest production change that satisfies the test. Re-run the relevant test, then the
broader affected suite as needed to confirm nothing else broke.

After the behavior is covered, look briefly for obvious cleanup: duplication, confusing names, or
awkward structure introduced by the minimal change. If a small refactor would help, do it and re-run
tests. If not, move on to the next behavior.

</the_process>

<agent_references>

## `cape:test-runner` protocol:

**Use when helpful:** focused test runs, broader suite confirmation, or capturing detailed failure
output without polluting context.

**Pass:** test command and working directory. **Expect back:** pass/fail status with counts and
complete failure output for any failing tests.

</agent_references>

<examples>

<example>
<scenario>Adding duplicate-email validation to user creation</scenario>

**Wrong:**

```
1. Add duplicate-email handling in the service
2. Write several tests for duplicates, invalid formats, and future edge cases
3. Run the suite once at the end
```

The code changed before any test proved the gap, and the tests were batched around multiple
behaviors.

**Right:**

```
1. Add or update one test that shows duplicate emails are currently accepted
2. Run that test and confirm it fails for the missing duplicate check
3. Add the smallest guard in user creation to reject duplicates
4. Re-run the focused test, then the broader suite
5. If the new code is awkward, do a small cleanup; otherwise move to the next behavior
```

</example>

</examples>

<key_principles>

- **A failing test is evidence.** It proves the behavior was missing before the code changed.
- **Small behavior slices stay honest.** Narrow tests and narrow code changes reduce speculation and
  make failures easier to interpret.
- **Clarity beats ceremony.** Cleanup matters when it improves the code, not because a named phase
  demands it.
- **Match local conventions.** Use the project's existing test file layout, assertion style, and
  helpers.
- **Behavior over implementation.** Tests should describe what changes for the caller, not merely
  which internal method ran.

</key_principles>

<anti_batching>

## The batching failure mode

The strongest pull is to write every foreseeable test up front, especially in a new file. Resist
that. Start with the next behavior only, then let the result of that change inform what to test
next.

**Self-check before saving test code:** Am I adding tests for the current behavior, or am I
front-loading future cases because I can already imagine them?

</anti_batching>
