---
name: debug-issue
description: >
  Systematic debugging workflow that investigates bugs with tools before guesses and evidence before
  hypotheses. Use when the user reports something broken, shares a stack trace, encounters a test
  failure, sees unexpected output, says "this doesn't work", "something is wrong", "why is X
  happening", or pastes an error message. Also use when the user asks to debug, diagnose, trace, or
  find the root cause of a problem. This skill investigates only -- it finds the root cause and
  documents it as a br bug issue with evidence and reproduction steps. Do NOT use for applying fixes
  (use fix-bug after investigation), quick config tweaks where the solution is already known,
  performance profiling without a specific defect, or feature design (use brainstorm).
---

<skill_overview> Investigate bugs to find root causes. Uses tools before guesses, evidence before
hypotheses. Produces a `br` bug issue with root cause analysis, evidence trail, and reproduction
steps -- ready for handoff to fix-bug.

Core contract: no hypothesis without evidence. No br issue without a confirmed root cause or a clear
"cause unknown" with documented dead ends. </skill_overview>

<rigidity_level> HIGH FREEDOM -- Adapt investigation depth and tool choices to the bug's complexity.
Rigid rules: always reproduce before hypothesizing, always gather evidence before concluding, always
create a br bug issue with findings, always confirm before creating the issue. </rigidity_level>

<when_to_use>

- User reports an error, exception, or stack trace
- Tests fail unexpectedly
- Something "doesn't work" or behaves differently than expected
- User shares a bug report or error log
- Unexpected output, wrong data, or silent failures
- User asks "why is X happening" about a defect

**Don't use for:**

- Applying the fix (use fix-bug after this skill produces the br issue)
- Quick config changes where the cause and fix are already obvious
- Performance optimization without a specific defect
- Feature requests or design questions (use brainstorm)

</when_to_use>

<the_process>

## Step 1: Reproduce and characterize

**Announce:** "I'm using the debug-issue skill to investigate this systematically."

**Clarify the symptom:**

- What is the user observing? (error message, wrong output, crash, test failure)
- When does it happen? (always, intermittently, after a specific action)
- When did it start? (recent change, always been this way, after an update)

If the user provided a stack trace or error message, parse it for file paths, line numbers, and
error types.

**Reproduce the bug:**

- Run the failing test, command, or operation to confirm the symptom
- If it cannot be reproduced, document that and investigate recent changes that could explain
  intermittent failure
- Record the exact reproduction steps and output

Do not proceed to hypotheses until the symptom is confirmed or the inability to reproduce is
documented.

## Step 2: Gather evidence

**Use tools, not intuition.**

Dispatch `cape:bug-tracer` to:

- Trace execution backward from the error location
- Check recent changes to affected files (`git log --oneline -20 -- <files>`, `git blame`)
- Compare working code paths with broken ones to find the divergence
- Identify instrumentation points -- where to add debug prints, what state to inspect

If broader code understanding is needed (architecture, patterns, unrelated modules), dispatch
`cape:codebase-investigator` as a secondary agent.

If the error involves external APIs, libraries, or unfamiliar behavior, dispatch
`cape:internet-researcher` to:

- Check for known issues or breaking changes
- Verify expected behavior from documentation
- Find relevant bug reports or discussions

If agents are unavailable, investigate manually with Glob/Grep/Read, git log, and
WebSearch/WebFetch.

**Build an evidence trail.** As you investigate, maintain a running list:

```
Evidence:
1. [file:line] - [what you found, why it matters]
2. [command output] - [what it reveals]
3. [git log entry] - [relevant change]
```

Each piece of evidence should either support or eliminate a hypothesis. Evidence without
interpretation is noise -- always note what each finding means.

## Step 3: Hypothesize and test

**Form hypotheses from evidence, not from guesses.**

For each hypothesis:

1. State it clearly: "The bug occurs because [specific mechanism]"
2. Identify a test: "If this is correct, then [observable prediction]"
3. Run the test: execute a command, read a file, check a condition
4. Record the result: confirmed, refuted, or inconclusive

**Narrow the search systematically:**

- Binary search through code paths when the failure point is unclear
- Compare working vs broken cases to isolate the difference
- Check boundary conditions, null/empty inputs, race conditions
- Read the actual code -- don't assume what it does

When a hypothesis is refuted, document it as a dead end and move to the next. Dead ends narrow the
search space and prevent re-investigation.

## Step 4: Trace to root cause

**Distinguish symptoms from causes.**

A `NullPointerException` is a symptom -- the root cause is why the value is null. A failing test is
a symptom -- the root cause is the code change or logic error. An incorrect output is a symptom --
the root cause is the flawed logic or data.

**Keep asking "why" until you reach a cause that, if fixed, prevents the symptom from recurring.**

```
Symptom: test_auth fails with 401
  Why? Token is expired
  Why? Token refresh isn't called
  Why? Refresh condition checks `<` instead of `<=` at auth.ts:47
  Root cause: off-by-one in token expiry comparison
```

If root cause cannot be determined, document:

- What you confirmed works
- What you confirmed is broken
- Where the investigation stalled and why
- Suggested next steps for further investigation

## Step 5: Document and create br issue

**Present findings for approval before creating the issue:**

```
## Investigation summary

**Symptom:** [What the user observed]
**Root cause:** [The underlying reason, with file:line reference]
**Evidence:** [Key findings that confirm the root cause]
**Reproduction:** [Steps to trigger the bug]

I'll create a br bug issue with these findings. Proceed?
```

Wait for user approval, then create the issue:

```bash
br create "Bug: [Concise root cause description]" \
  --type bug \
  --priority <0-4> \
  --labels "debug-issue" \
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

## Dead ends investigated
- [Hypothesis] - [why refuted]

## Suggested fix
[Direction for fix-bug skill]

## Success criteria
- [ ] [Root cause addressed]
- [ ] [Regression test added]
EOF
)"
```

**Priority assessment:**

| Priority | Criteria                                                   |
| -------- | ---------------------------------------------------------- |
| P0       | Security vulnerability, data loss, production down         |
| P1       | Broken core functionality, blocking other work             |
| P2       | Broken non-critical functionality, test failures (default) |
| P3       | Cosmetic issues, edge cases with workarounds               |
| P4       | Nice-to-have, backlog                                      |

**After creation:**

```
Created br-N: "Bug: [title]"
Priority: P[N] | Label: debug-issue

Ready for fix-bug when you want to address it.
```

</the_process>

<agent_references>

## Dispatch `cape:bug-tracer` (primary) when:

- Tracing execution backward from an error location
- Finding what changed recently in affected files (`git log`, `git blame`)
- Comparing working code paths with broken ones
- Identifying instrumentation points and state to inspect
- Binary searching through code when the failure point is unclear

## Dispatch `cape:internet-researcher` when:

- Error involves a third-party library or API
- Behavior contradicts documentation
- Checking for known issues or breaking changes in dependencies
- Unfamiliar error messages or codes

## Dispatch `cape:codebase-investigator` (secondary) when:

- Bug-tracer needs broader context about how a system works
- Understanding architecture or patterns unrelated to the specific failure
- Finding existing conventions before suggesting a fix direction

## Dispatch `cape:notebox-researcher` (optional) when:

- The bug involves a system the user has investigated or debugged before
- The error pattern or module has appeared in past notes or journals
- You want to check if past decisions or research are relevant to this bug

## Investigation protocol:

1. Reproduce first -- tools confirm the symptom exists
2. Bug-tracer -- trace backward from error, check git history, compare working vs broken paths
3. External evidence -- only when the bug may involve external factors
4. Codebase-investigator -- fall back for broader code understanding when needed
5. Never skip straight to external research without tracing the code first

</agent_references>

<examples>

<example>
<scenario>User pastes a stack trace</scenario>

User: "Getting this error: TypeError: Cannot read property 'id' of undefined at
handlers/order.ts:42"

**Wrong:** "The issue is that `order` is undefined. Let me add a null check at line 42." Jumps to a
fix without understanding WHY the order is undefined. The null check masks the real bug and the
problem resurfaces elsewhere.

**Right:**

1. Read handlers/order.ts:42 to understand the code path
2. Reproduce: run the operation that triggers the error
3. Dispatch bug-tracer: trace where `order` is populated -- find the database query at
   services/order.ts:28
4. Evidence: the query uses `findOne` without joining the `items` relation, but line 42 accesses
   `order.items[0].id`
5. Check git log: commit abc123 added the items access but didn't update the query
6. Root cause: missing join in the query at services/order.ts:28
7. Create br bug with full evidence trail </example>

<example>
<scenario>Intermittent test failure</scenario>

User: "test_session_cleanup fails about 30% of the time in CI"

**Wrong:** "Flaky tests are usually timing issues. Let me add a retry or increase the timeout."
Treats the symptom without investigating the cause. Retries mask the real bug.

**Right:**

1. Run the test locally multiple times to reproduce
2. Read the test: it creates a session, waits 100ms, then checks cleanup ran
3. Dispatch bug-tracer: find the cleanup scheduler
4. Evidence: cleanup interval is 100ms but uses `setInterval` -- first run happens AFTER 100ms, not
   AT 100ms
5. The test passes when cleanup fires before the assertion (race condition) and fails when it
   doesn't
6. Root cause: race condition -- test assumes cleanup runs within 100ms but the interval means it
   runs between 100-200ms
7. Create br bug: "Bug: Race condition in session cleanup test" </example>

<example>
<scenario>Wrong output, no error</scenario>

User: "The user profile page shows the wrong email after updating it"

**Wrong:** "Let me check the profile rendering template for display bugs." Starts at the symptom
instead of tracing the data flow.

**Right:**

1. Reproduce: update email, reload profile, confirm stale email displays
2. Check the API response: GET /api/profile still returns old email after PUT succeeds
3. Dispatch bug-tracer: trace the update handler through services to the database query
4. Evidence: the PUT handler writes to the database, but the GET handler reads from a Redis cache
5. The cache invalidation call is missing from the update path
6. Root cause: cache not invalidated after profile update in services/user.ts:updateUser()
7. Create br bug with the full data flow trace as evidence </example>

</examples>

<key_principles>

- **Reproduce before hypothesizing** -- confirm the symptom exists and is repeatable before
  theorizing
- **Tools before guesses** -- read code, run tests, check logs before forming opinions
- **Evidence before conclusions** -- every finding noted with file:line and interpretation
- **Root cause, not symptoms** -- keep asking "why" until fixing the cause prevents recurrence
- **Dead ends are progress** -- document refuted hypotheses to narrow the search and prevent
  re-investigation
- **Investigate only** -- this skill finds causes, fix-bug applies solutions
- **Confirm before creating** -- always present findings and get approval before creating the br
  issue

</key_principles>

<critical_rules>

1. **Reproduce BEFORE hypothesizing** -- confirm the symptom with tools before forming theories
2. **Never jump to a fix** -- this skill investigates only; fixes belong to fix-bug
3. **Evidence for every conclusion** -- no root cause claim without file:line references and
   supporting evidence
4. **Document dead ends** -- refuted hypotheses are recorded, not silently dropped
5. **Always create a br bug issue** -- findings become a tracked issue, not just conversation text
6. **Confirm before creating the issue** -- present summary and wait for user approval
7. **Use `--description` on `br create`** -- `--design` does not exist on create
8. **Always set `--labels "debug-issue"`** -- skill name as label per beads output conventions

</critical_rules>
