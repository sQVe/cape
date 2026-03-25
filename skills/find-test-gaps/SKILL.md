---
name: find-test-gaps
description: >
  Scan a directory or module for untested behavior and create br tasks per gap found. Make sure to
  use this skill whenever the user mentions test gaps, missing tests, untested code, test coverage
  for a specific scope, or wants to know what's not tested before a refactor or after shipping a
  feature. Triggers on any of these patterns: "find test gaps", "what's untested", "check test
  coverage", "improve tests for", "we need tests for", "what's not covered", "test health", "missing
  test cases", pointing at a directory and asking about its tests, mentioning they shipped something
  and want to verify test completeness, or preparing for a refactor and wanting safety nets. This
  skill is specifically about FINDING gaps (static analysis, source-to-test mapping, bug risk
  assessment) — not about writing tests (use test-driven-development), auditing existing test
  quality (use analyze-tests), debugging test failures (use debug-issue), or running a test suite.
  Even if the request seems simple, use this skill — it provides structured br output with
  per-module tasks that plain analysis does not.
---

<skill_overview> Scan a user-specified scope for source code that lacks meaningful test coverage.
Map source files to test files, read public APIs, and identify behaviors that ship untested. Output
a br epic with one task per module that needs tests.

Core contract: every gap found must explain what bug it would catch. "This function has no test" is
not a gap — "this function silently returns nil on malformed input and no test verifies the error
path" is. Tests exist to catch bugs, not to hit coverage numbers. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — The scope resolution and br output format are rigid. How deep the
analysis goes within each module adapts to the module's complexity and risk. The value filter (skip
trivial code) is non-negotiable. </rigidity_level>

<when_to_use>

- User wants to find what's untested in a specific part of the codebase
- After shipping a feature, verifying nothing was left untested
- Before a refactor, ensuring safety nets exist
- User points at a directory and asks about test health
- Planning a test improvement initiative for a specific area

**Don't use for:**

- Auditing quality of existing tests (use `cape:analyze-tests`)
- Writing tests (use `cape:test-driven-development`)
- Debugging test failures (use `cape:debug-issue`)

</when_to_use>

<the_process>

## Step 1: Resolve scope

The user specifies what to analyze. If their message doesn't include a clear scope, ask:

```
What should I analyze? Examples:
- A directory: src/auth/
- A module: the payment processing module
- A feature area: everything related to session management
```

Once scope is clear, use code-review-graph to build structural context before reading files:

1. `get_impact_radius_tool` on the scope's production files to prioritize which gaps matter most —
   high-impact code (many callers) deserves more scrutiny
2. `query_graph_tool` with `tests_for` to find existing test-to-source mappings
3. `semantic_search_nodes_tool` to find related test utilities and fixtures

If the graph is unavailable, fall back to `cape:codebase-investigator`. Dispatch it to:

- Find all source files within the scope
- Find the project's test file conventions (co-located vs separate `tests/` directory, naming
  patterns like `.test.ts`, `_test.go`, `_spec.lua`)
- Map each source file to its test file (if one exists)
- Identify the test framework and assertion style in use

Present the mapping:

```
Scope: src/auth/
Test convention: co-located, .test.ts suffix
Framework: vitest

Source files:
  src/auth/login.ts        → src/auth/login.test.ts (exists)
  src/auth/session.ts      → src/auth/session.test.ts (exists)
  src/auth/permissions.ts  → (no test file)
  src/auth/types.ts        → (skipped: type definitions)
```

---

## Step 2: Analyze gaps

For each source file in scope, determine its test status. Work through files in parallel where
possible using subagents.

### 2a. Apply the value filter

Skip files that don't warrant tests. Testing these adds maintenance cost without catching bugs:

- Type definitions, interfaces, enums without logic
- Re-exports and barrel files
- Static configuration and constants
- Thin wrappers that delegate entirely to another function

Explicitly note skipped files and why. The user should see what was excluded so they can override if
they disagree.

### 2b. Categorize remaining files

For each non-trivial source file:

1. **Read the source code.** Understand what it does — its public API, branching logic, error
   handling, side effects, and state changes.

2. **Read the test file** (if it exists). Understand what's actually tested — which functions, which
   inputs, which paths.

3. **Identify untested behavior.** Compare what the source does against what the tests verify. Focus
   on:
   - **Public functions with no test** — exported functions that no test calls
   - **Error paths** — what happens on invalid input, network failure, permission denied
   - **Branch conditions** — if/else paths, switch cases, guard clauses that no test exercises
   - **Edge cases** — empty input, boundary values, concurrent access, Unicode
   - **State transitions** — initialization, cleanup, transitions between states

4. **Assess each gap's risk.** Ask: "If this code broke, what would happen?" A bug in payment
   calculation is P1. A bug in a log formatter is P3. Skip gaps where the realistic bug risk is
   negligible.

### 2c. What makes a gap worth reporting

Every gap must answer: **"What bug would this test catch?"**

**Report:**

```
permissions.ts:hasPermission() — no test verifies behavior when the permission list is empty.
Bug risk: user with no permissions could be granted access if the empty-array check is wrong.
```

**Don't report:**

```
permissions.ts:hasPermission() — function has no test.
```

The first is actionable. The second is coverage porn.

---

## Step 3: Present findings

Group gaps by module. For each module, show:

```
### src/auth/permissions.ts — no test file

Public API: hasPermission(), getRoles(), validateScope()

Gaps:
1. hasPermission() — no test for empty permission list. Bug risk: unauthorized access.
2. hasPermission() — no test for unknown permission strings. Bug risk: silent pass-through.
3. validateScope() — no test for malformed scope strings. Bug risk: unhandled exception in
   middleware.

Skipped: getRoles() — thin wrapper around database query, tested transitively through
integration tests.
```

```
### src/auth/login.ts — test file exists, partial coverage

Tested: login() happy path, invalid password
Gaps:
1. login() — no test for account lockout after failed attempts. Bug risk: brute force possible.
2. login() — no test for concurrent login from multiple sessions. Bug risk: session corruption.
```

After presenting all modules, **explicitly ask the user before proceeding:**

```
Found [N] gaps across [M] modules. Create a br epic with tasks for these? I can also
drop any gaps you think aren't worth tracking.
```

**STOP here.** Do not present br commands or create issues until the user responds. This is a gate —
the user may want to drop gaps, reprioritize, or skip br entirely.

---

## Step 4: Create br epic and tasks

After user approval, create a br epic and one task per module.

### Epic

```bash
br create "Epic: Close test gaps in [scope]" \
  --type epic \
  --priority 2 \
  --description "$(cat <<'EOF'
## Requirements
- Every gap addresses a specific bug risk, not coverage percentage
- Tests follow project conventions ([framework], [assertion style])
- No tautological tests — each test must fail when the behavior breaks

## Anti-patterns
- Coverage porn: adding tests for trivial code to inflate numbers
- Mock-heavy tests that verify wiring instead of behavior
- Happy-path-only tests that miss the error paths this epic targets

## Success criteria
- [ ] All identified gaps have tests that catch the described bug
- [ ] Tests follow project conventions
- [ ] No test is tautological (would pass even if production code broke)
EOF
)"
```

### Tasks (one per module)

```bash
br create "Add missing tests for [module name]" \
  --type task \
  --parent <epic-id> \
  --priority <assessed-priority> \
  --labels "find-test-gaps" \
  --description "$(cat <<'EOF'
## Goal
Close [N] test gaps in [file path].

## TDD classification
REQUIRED — each gap is a specific untested behavior with a failing test to write.

## Behaviors
- [function]: [untested behavior]. Bug risk: [what breaks].
- [function]: [untested behavior]. Bug risk: [what breaks].

## References
- Test file: [path to test file, existing or new]
- Framework: [framework]
- Follow [specific patterns from existing tests in the project]

## Success criteria
- [ ] [function]: test verifies [specific behavior]
- [ ] [function]: test verifies [specific behavior]
- [ ] All tests fail when the described behavior breaks (not tautological)
EOF
)"
```

### Completion summary

```
Created br-N: "Epic: Close test gaps in [scope]"
Tasks:
  br-N.1: Add missing tests for permissions.ts (P1, 3 gaps)
  br-N.2: Add missing tests for login.ts (P2, 2 gaps)

Run `/cape:execute-plan` to start implementing.
```

</the_process>

<agent_references>

## Dispatch `cape:codebase-investigator` when:

- Resolving scope: finding source files, test files, and naming conventions
- Understanding module structure and test framework setup
- Checking whether behavior is tested transitively through integration tests

## Dispatch parallel subagents for step 2 when:

- The scope contains many files — analyze modules concurrently
- Each subagent reads one source file + its test file and returns gaps

</agent_references>

<examples>

<example>
<scenario>User asks to find test gaps in a specific directory</scenario>

User: "Find test gaps in src/auth/"

**Wrong:** Run a coverage tool, report "src/auth/ has 67% line coverage", suggest adding tests until
it hits 80%. This is coverage porn — it doesn't tell you what bugs the missing tests would catch.

**Right:**

1. Resolve scope: find 4 source files, 2 have test files, 1 is type-only (skipped)
2. Read each source and test file. permissions.ts has no tests and handles authorization logic.
   login.ts has tests but only for the happy path — no lockout, no concurrent session tests.
3. Present gaps with bug risks. Ask user to approve.
4. Create epic + 2 tasks (one for permissions.ts, one for login.ts gaps). Each task lists specific
   gaps and what bug the test would catch. </example>

<example>
<scenario>User wants to check test health after shipping a feature</scenario>

User: "We just shipped the new webhook system in src/webhooks/. What's untested?"

**Wrong:** Report that 3 of 5 files have no test file. Suggest creating test files for all of them,
including the types file and the re-export barrel. Create 5 tasks.

**Right:**

1. Resolve scope: 5 files. Skip types.ts (type definitions) and index.ts (re-exports).
2. Read the 3 remaining files. dispatcher.ts handles retry logic on HTTP failure — no test verifies
   retry behavior or max-retry exhaustion. validator.ts parses webhook payloads — no test for
   malformed JSON or missing required fields.
3. Present 2 modules with gaps, each gap tied to a bug risk.
4. Create epic + 2 tasks. Skip the trivial files entirely. </example>

<example>
<scenario>Module has tests but they only cover the happy path</scenario>

User: "Check if src/billing/invoice.ts has good test coverage"

**Wrong:** "invoice.test.ts exists and has 12 tests. Looks covered." Having a test file doesn't mean
the important behavior is tested.

**Right:**

1. Read invoice.ts: exports generateInvoice(), applyDiscount(), calculateTax(). Has complex rounding
   logic and handles multiple currencies.
2. Read invoice.test.ts: 12 tests, all for generateInvoice() with USD. No tests for applyDiscount()
   edge cases (negative discount, discount > total), no tests for calculateTax() with non-USD
   currencies, no test for rounding behavior.
3. Present gaps: 4 untested behaviors, each with the bug it would catch (rounding errors on currency
   conversion, negative invoice total from bad discount).
4. Create 1 task for invoice.ts with 4 specific gaps. </example>

</examples>

<key_principles>

- **Gaps need bug risks** — "no test exists" is an observation; "no test catches [specific bug]" is
  a gap worth reporting
- **Value over coverage** — skip trivial code, focus on logic that could break in meaningful ways
- **Per-module tasks** — one br task per module keeps work atomic and trackable
- **User controls scope** — the user decides what to analyze; don't expand beyond what was asked
- **Confirm before creating** — present findings and wait for approval before creating br items

</key_principles>

<critical_rules>

1. **Always ask for scope if not provided** — never default to analyzing the entire codebase
2. **Every gap must state the bug it would catch** — gaps without bug risk are coverage porn
3. **Apply the value filter** — skip type definitions, re-exports, constants, and trivial wrappers
4. **Read source code before claiming gaps** — understand the actual behavior, don't guess from file
   names
5. **One task per module** — group gaps by source file, not by gap category
6. **Confirm before creating br items** — present findings, wait for user approval
7. **Use `--description` on `br create`** — `--design` does not exist on create
8. **Always set `--labels "find-test-gaps"`** — skill name as label per beads output conventions

</critical_rules>
