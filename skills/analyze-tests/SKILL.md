---
name: analyze-tests
description: >
  Audit quality of existing tests — identify tautological tests, coverage gaming, weak assertions,
  and missing corner cases. Use this skill whenever the user mentions test quality, test
  effectiveness, tautological tests, coverage gaming, "are these tests any good", "audit tests",
  "review test quality", test rot, flaky tests, or wants to understand whether existing tests
  actually catch bugs. Also triggers on: "these tests feel useless", "coverage is high but bugs keep
  shipping", "would these tests catch a real bug", pointing at a test file and asking if it's worth
  keeping. This skill audits EXISTING test quality — not finding missing tests (use find-test-gaps),
  writing new tests (use test-driven-development), or debugging test failures (use debug-issue).
---

<skill_overview> Audit a user-specified scope of existing tests and categorize each as RED (remove
or replace), YELLOW (strengthen), or GREEN (keep). Uses code-review-graph for structural context and
reads production code before evaluating tests.

Core contract: every RED or YELLOW verdict must cite the specific line or pattern that makes the
test weak, and explain what false confidence it creates. "This test could be better" is not a
verdict — "this test passes even when the production code is deleted" is. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — The categorization framework (RED/YELLOW/GREEN) and the
requirement to read production code before tests are rigid. How deep the analysis goes within each
module adapts to complexity and risk. The structural context step (code-review-graph) is rigid when
a graph is available. </rigidity_level>

<when_to_use>

- User wants to audit quality of existing tests
- Coverage is high but bugs keep shipping — suspect coverage gaming
- Before a refactor, verifying tests will actually catch regressions
- User points at a test file and asks if the tests are meaningful
- Planning a test improvement initiative for a specific area
- After inheriting a codebase and wanting to assess test trustworthiness

**Don't use for:**

- Finding untested behavior or missing tests (use `cape:find-test-gaps`)
- Writing new tests (use `cape:test-driven-development`)
- Debugging test failures (use `cape:debug-issue`)
- Running tests or checking if they pass (just run them)

</when_to_use>

<critical_rules>

1. **NEVER create br items without user approval** — present findings first, ask explicitly, wait
   for confirmation. This is the most important rule.
2. **Self-review before presenting** — challenge your own REDs and GREENs to reduce false positives
3. **Scope is user-controlled** — never expand analysis beyond what was asked

</critical_rules>

<the_process>

## Step 1: Resolve scope and gather structural context

Run `cape check` to establish a baseline. If tests fail, report failures and stop — audit test
quality only when the suite is green.

If the user's message doesn't include a clear scope, ask:

```
What tests should I audit? Examples:
- A directory: src/auth/
- A test file: src/auth/login.test.ts
- A module: the payment processing tests
```

Once scope is clear, use code-review-graph to build structural context before reading any files.
This prevents wasting tokens on code you don't need and surfaces relationships that aren't obvious
from file names alone.

**Graph queries to run:**

1. `semantic_search_nodes_tool` with `kind: "Test"` to find test entities in scope
2. `query_graph_tool` with `tests_for` on each production file to confirm test-to-source mappings
3. `query_graph_tool` with `callers_of` on key production functions to understand their importance —
   heavily-called functions deserve more scrutiny on their tests
4. `get_impact_radius_tool` on the production files to understand blast radius — tests guarding
   high-impact code get more scrutiny

If the graph is unavailable or hasn't been built for the target repo, fall back to manual
file-reading (dispatch `cape:codebase-investigator` to find test conventions and mappings). Don't
block on the graph.

Present the scope summary:

```
Scope: src/auth/
Test files: 3 (login.test.ts, session.test.ts, permissions.test.ts)
Production files: 4 (login.ts, session.ts, permissions.ts, types.ts)
Framework: vitest
High-impact functions: authenticate() (12 callers), validateSession() (8 callers)
```

---

## Step 2: Read production code, then categorize tests

**Production code first.** You cannot judge a test without understanding what it should verify. For
each production file in scope, read it and note:

- Public API (exported functions, methods)
- Branching logic (if/else, switch, guard clauses, error handling)
- Side effects (I/O, state mutations, external calls)
- Edge cases (null handling, boundary values, error paths)

Then read the corresponding test file and evaluate each test against the production code.

### Categorization framework

**RED — Remove or replace.** These tests create false confidence. They pass regardless of whether
production code works correctly.

| Pattern               | Example                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tautological          | Asserts the mock returns what you told it to return                                                                                  |
| Mock-dominated        | Verifies mock wiring, not behavior — production code could be deleted and the test still passes                                      |
| Coverage gaming       | Calls the function but asserts nothing meaningful (e.g., `expect(result).toBeDefined()` on a function that always returns an object) |
| Testing the framework | Verifies that the test framework, language runtime, or library works correctly rather than testing application logic                 |
| Frozen snapshot       | Snapshot test that gets blindly updated whenever it fails — it documents current output, not correct output                          |

**YELLOW — Strengthen.** These tests have value but miss important cases or use weak patterns that
reduce their effectiveness.

| Pattern               | Example                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Happy-path only       | Tests the sunny day but no error paths, despite the production code having explicit error handling                |
| Weak assertions       | `toBeTruthy()` or `not.toBeNull()` when a specific value should be checked                                        |
| Brittle coupling      | Depends on implementation details (string-matching error messages, asserting call order, testing private methods) |
| Missing corner cases  | Tests the common case but not boundaries (empty input, max values, concurrent access)                             |
| Incomplete error path | Tests that an error is thrown but not the error type, message, or downstream effect                               |

**GREEN — Keep as-is.** Tests that genuinely guard behavior. They would fail if the production code
broke in the way they test.

A test earns GREEN when: it asserts specific behavior, targets a real code path, and would fail if
that path changed.

### Skeptical default

Start from the assumption that a test is YELLOW until proven GREEN. GREEN is the exception — most
test suites have more strengthening opportunities than they appear to at first glance.

### Per-test verdicts

For each test (or tightly-related group), record:

```
[RED|YELLOW|GREEN] test description or name
  Line: test file:line_number
  Verdict: [specific reason citing the pattern from the table above]
  Production code: [which function/path this test is supposed to guard]
  [RED/YELLOW only] Fix: [what to do — delete, replace with X, add assertion for Y]
```

---

## Step 3: Self-review

Before presenting findings, review your own categorizations. This catches false positives that would
waste the user's time.

For each RED verdict, verify:

- Did you actually confirm the test would pass with broken production code, or are you guessing?
- Could the test be catching a subtle regression you're not seeing?

For each GREEN verdict, challenge:

- Would this test actually fail if the behavior changed, or does it assert on stable surface area
  that would remain unchanged?
- Is the assertion specific enough to catch the bug it's supposed to catch?

Downgrade uncertain REDs to YELLOW. Upgrade suspicious GREENs to YELLOW. When in doubt, YELLOW.

---

## Step 4: Present findings

Group findings by module. Lead with the summary, then details.

### Summary

```
Analyzed [N] tests across [M] files.

RED:    [count] — remove or replace (false confidence)
YELLOW: [count] — strengthen (partial value)
GREEN:  [count] — keep as-is (genuine guards)
```

### Per-module detail

```
### src/auth/login.test.ts — 8 tests (2 RED, 4 YELLOW, 2 GREEN)

Production file: src/auth/login.ts
Key functions: authenticate() (12 callers), resetPassword()

RED tests:
1. "should call the database" (line 23)
   Asserts mock.toHaveBeenCalled() after calling authenticate() which always calls the DB.
   Tautological — passes even if authenticate() stops validating credentials.
   Fix: Replace with test that verifies authenticate() rejects invalid credentials.

2. "should return user object" (line 45)
   Asserts result is not null. authenticate() always returns an object (throws on failure).
   Coverage gaming — asserts nothing about correctness.
   Fix: Assert specific user fields match input credentials.

YELLOW tests:
3. "should reject wrong password" (line 67)
   Good intent but asserts only that an error is thrown, not the error type.
   Fix: Assert AuthenticationError with specific code.

4-5. "should handle login" / "should process valid credentials" (lines 89, 102)
   Happy-path only. No test for: expired credentials, locked account, rate limiting.
   Fix: Add error-path tests for each guard clause in authenticate().

GREEN tests:
6. "should hash password before comparison" (line 134)
   Verifies bcrypt.compare is called with the raw password and stored hash.
   Would fail if hashing logic changed.
```

After presenting all modules, ask before creating br items:

```
Found [N] RED and [M] YELLOW tests across [K] modules.
Create a br epic with improvement tasks? I can drop any findings you disagree with.
```

**STOP here.** You MUST wait for explicit user approval before creating br items. Do not call
`br create` until the user responds.

---

## Step 5: Create br epic and tasks

After user approval, create a br epic and one task per module.

### Epic

Create a br epic following this template:

!`cat "${CLAUDE_SKILL_DIR}/../write-plan/resources/epic-template.md"`

Populate Requirements from the RED/YELLOW findings, Anti-patterns from observed test smells, and
Success criteria from the improvement targets. Use `--type epic --priority 2`. Run
`cape br validate <epic-id>` after creation.

### Tasks (one per module)

```bash
br create "Improve tests in [module name]" \
  --type task \
  --parent <epic-id> \
  --priority <assessed-priority> \
  --labels "analyze-tests" \
  --description "$(cat <<'EOF'
## Goal
Fix [R] RED and [Y] YELLOW tests in [file path].

## RED — Remove or replace
1. [test name] (line N) — [verdict]. Replace with: [specific replacement].
2. ...

## YELLOW — Strengthen
1. [test name] (line N) — [verdict]. Fix: [specific improvement].
2. ...

## GREEN — No action
[List green tests so the implementer knows what not to touch]

## Implementation
- Test file: [path]
- Production file: [path]
- Framework: [framework]
- For each replacement: write the new test, verify it fails against broken production code,
  then verify it passes against correct code

## Success criteria
- [ ] [test name]: replaced with test that verifies [specific behavior]
- [ ] [test name]: assertion strengthened to check [specific value]
- [ ] All replacement tests fail when production behavior breaks
EOF
)"
cape br validate <task-id>
```

Present the created epic and tasks, then suggest `cape:execute-plan` to start implementing.

</the_process>

<agent_references>

## `cape:test-auditor` protocol:

**Pass:** production file path, corresponding test file path, graph findings (impact radius,
callers). **Expect back:** per-test verdicts (RED/YELLOW/GREEN) with line references and fix
descriptions.

Dispatch parallel subagents when scope contains many test files — each reads one production file +
its test file and returns categorized verdicts.

</agent_references>

<examples>

<example>
<scenario>User asks to audit test quality in a directory</scenario>

User: "Are the tests in src/billing/ any good?"

**Wrong:** Skim the test files and report "looks fine, they have decent coverage." Coverage says
nothing about quality. A test suite can hit 95% coverage while every test is tautological.

**Right:**

1. Query code-review-graph: find 3 test files mapping to 3 production files. calculateTotal() has 15
   callers — high impact.
2. Read production code first. calculateTotal() has currency conversion, rounding, and discount
   logic with 4 guard clauses.
3. Read tests. 9 tests for calculateTotal() — all use USD, none test rounding, one asserts only that
   the result is a number (RED: coverage gaming).
4. Categorize: 2 RED, 5 YELLOW, 2 GREEN. Present with line references and specific fixes.
5. User approves. Create epic + 3 tasks with per-test verdicts. </example>

<example>
<scenario>High coverage but bugs keep shipping</scenario>

User: "We have 90% coverage in src/api/ but keep finding bugs in production. What's wrong?"

**Wrong:** Suggest adding more tests to get to 95%. More of the same bad tests won't help.

**Right:**

1. Use impact radius to identify the highest-risk production files — the ones where bugs would
   affect the most callers.
2. Focus analysis on those high-risk files first. Read production code: complex request validation
   with 6 error paths.
3. Read tests: 20 tests, all happy-path. Every test sends a valid request and checks the 200
   response. Zero tests for invalid input, missing fields, or malformed headers.
4. Categorize: 3 RED (assert only that response exists), 15 YELLOW (happy-path only), 2 GREEN.
5. The diagnosis is clear: high coverage from testing the success path many ways while ignoring
   every error path. Present findings with the pattern identified. </example>

<example>
<scenario>User points at a specific test file</scenario>

User: "Is src/auth/session.test.ts worth keeping?"

**Wrong:** Count the tests and say "12 tests, seems comprehensive." Or read only the test file
without the production code and guess at quality.

**Right:**

1. Read session.ts first. Exports createSession(), validateSession(), refreshSession(). Each has
   expiry logic and token validation.
2. Read session.test.ts. 12 tests. 4 mock the entire token library and assert mock calls (RED:
   mock-dominated). 3 test createSession() but only check that a session object is returned (RED:
   coverage gaming). 5 test validation with real tokens and specific assertions (GREEN).
3. Verdict: 7 RED, 0 YELLOW, 5 GREEN. "Keep the 5 validation tests. The other 7 verify mock wiring
   and object existence — they'd pass even if session logic were completely broken."
4. Present concise findings. User decides whether to create br tasks. </example>

</examples>

<key_principles>

- **Production code first** — you cannot evaluate a test without understanding what it should guard;
  reading tests in isolation leads to false GREENs
- **Verdicts need evidence** — every RED and YELLOW must cite the specific pattern and explain the
  false confidence it creates
- **Skeptical default** — start at YELLOW, promote to GREEN only when the test demonstrably guards
  real behavior
- **Structural context before deep reading** — use code-review-graph to identify high-impact code
  and focus scrutiny where it matters most
- **Fewer good tests beat many bad tests** — recommending test removal is a valid and valuable
  outcome

</key_principles>
