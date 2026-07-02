---
name: write-plan
description: >
  Formalize a brainstorm design into a Linear tracker epic with one first sub-issue task. Use after
  cape:brainstorm has produced a design summary. Triggers on: user runs /cape:write-plan, "create
  the epic", "formalize this design", "write the plan", transitioning from brainstorm to
  implementation. Do NOT use for initial exploration (use cape:brainstorm), executing existing plans
  (use cape:execute-plan), or bug diagnosis and fixes (use cape:fix-bug).
---

<skill_overview> Formalize a validated design into a Linear epic issue and exactly one first
sub-issue task. The bridge between exploration and implementation.

Core contract: no epic without design context; no task without a parent epic; every Linear write is
followed by a local `cape tracker` cache refresh. </skill_overview>

<rigidity_level> MEDIUM FREEDOM -- The epic contract, first-task stress test, tracker write, and
STOP after creation are fixed. Validation depth adapts to the design's complexity. </rigidity_level>

<when_to_use>

- Design summary exists in conversation from brainstorm
- User wants to formalize a design into tracked work
- Transitioning from brainstorm to implementation

**Don't use for:**

- No design exists yet (use `cape:brainstorm`)
- Epic already exists (use `cape:execute-plan`)
- Bug diagnosis and fixes (use `cape:fix-bug`)

</when_to_use>

<critical_rules>

1. **Require design context** -- do not create an epic without a brainstorm design summary
2. **Use Linear through tracker protocol** -- create issues via MCP Linear, then refresh cache with
   `cape tracker`
3. **Create only the first task** -- subsequent tasks are created iteratively by execute-plan
4. **Keep breakdown in session** -- do not write expanded plans, validation transcripts, or
   divergence logs to Linear
5. **Stop after creation** -- present the epic and first task, then wait for execute-plan
6. **Stress-test first task before creation** -- verify paths, patterns, edge cases, and test gaps
   against the codebase

</critical_rules>

<the_process>

## Step 1: Verify design context

Verify that a design summary exists in conversation context. If not, stop and ask for one or route
to `cape:brainstorm`.

Review the summary for blockers:

- Missing or vague requirements
- Anti-patterns without reasoning
- Open questions that affect implementation
- Architecture claims without concrete codebase evidence

Resolve blocking questions before creating Linear issues.

---

## Step 2: Refine into epic contract

Turn the design into a durable epic description using the canonical shape in `cape:tracker`'s
[linear-templates.md](../tracker/resources/linear-templates.md). Pick the variant first: **Light**
by default, **Full** when a user journey changes, a new lifecycle or state exists, a migration runs,
authorization matters, multiple systems or teams are involved, or rollout, observability, or
rollback matters.

Keep the four questions separate; never blend them:

- **Required behavior**: a numbered table (R1, R2, …) of `Scenario → Expected result`. Name the
  actor, action, and observable proof in each row ("When an admin uploads a CSV with missing
  headers, the import lists each missing header"). Never "works as expected." Subtasks reference
  these rows. Stable upfront. Drop to `GIVEN/WHEN/THEN` in the scenario cell when a case has several
  preconditions.
- **Required constraints**: settled boundaries (routes, schemas, service boundaries, auth/storage
  patterns, compatibility rules) and anti-patterns as `NO X (reason: Y)`.
- **Proposed approach**: a recommendation the agent may improve, with concrete files, components,
  data flow, and known risks.
- **Acceptance criteria**: evidence per R-ID, plus a regression check that out-of-scope behavior
  holds.

Lead with the at-a-glance card so the first lines stand alone; use the chosen variant's fields
(Light leads with Outcome, Problem, User/system; Full uses Primary user and adds Risk). For Full,
sketch the work breakdown as a non-binding table in the parent; do not pre-create it.

Before formalizing the first task, dispatch `cape:codebase-investigator` in default mode (model:
haiku), or verify manually with search and file reads. Confirm file paths, APIs, test setup, helper
reuse, and similar implementation patterns.

The first task must be a vertical slice with:

- Goal, with `Delivers: R1, R2` naming the epic R-IDs it covers
- Interface: inputs, outputs, side effects
- Execution mode: HITL or AFK
- Behaviors small enough for TDD cycles
- References to verified files or patterns
- Success criteria

---

## Step 3: Create Linear epic and first task

Run the epic contract and first-task prose through the global `stop-slop` skill before creating
issues.

Load `cape:tracker` and apply its Agent contract for create-time rules, including dedupe, project
routing, `src:cape`, `Medium`, naming, and `Done when:`. Confirm with the user before creating a new
Linear project. Use MCP Linear `save_issue` for the epic. Put the epic contract in the Linear
description using the chosen variant's shape: at-a-glance card, the R-ID required-behavior table,
required constraints, proposed approach, and acceptance criteria (Full adds before/after, user
journey, release/observability, dependencies/risks, and a work-breakdown sketch). Keep it scannable.
The epic itself stays an untyped parent.

Use MCP Linear `save_issue` again to create exactly one child/sub-issue under the epic for the first
task. Apply the sub-issue labels from the tracker contract: exactly one `type:*` label plus
`agent-ticket`. Put only task-level details in the task description.

After the writes, refresh the local cache. Preferred path:

1. Use MCP Linear `get_issue` on the epic with child/sub-issues included.
2. Pipe the returned epic issue JSON to:

```bash
cape tracker cache-epic '<linear-epic-json>'
```

If the MCP result is easier to pass through stdin:

```bash
printf '%s' '<linear-epic-json>' | cape tracker cache-epic
```

Do not run any tracker network reads from the CLI. `cape tracker` only writes the local cache.

---

## Step 4: Present and stop

Present:

```text
Epic <epic-id> created: <title>
First task <task-id> created: <title>

The epic (<Light|Full>) has R1-R<N> required behaviors, <N> constraints, and <N> acceptance criteria.
The first task delivers <R-IDs> and was codebase-verified and stress-tested.

Continue with cape:execute-plan to start building.
```

Then stop. Do not start implementation in the same invocation.

</the_process>

<skill_references>

## Load `cape:tracker` with the Skill tool when:

- You need the exact MCP Linear plus cache-write protocol
- A cache refresh fails and you need to inspect the expected cache shape

</skill_references>

<examples>

<example>
<scenario>Design summary says "tokens stored securely"</scenario>

**Wrong:** Create a vague requirement that allows localStorage, sessionStorage, or cookies.

**Right:** Tighten it before creation: "Tokens stored in httpOnly cookies; NO localStorage tokens
(reason: XSS token theft)." Then create the Linear epic and first task and refresh the cache with
`cape tracker cache-epic`. </example>

<example>
<scenario>No design summary exists</scenario>

**Wrong:** Invent requirements and create tracker issues from a blank slate.

**Right:** Stop and route to `cape:brainstorm`, or ask the user for the existing design summary.
</example>

</examples>

<key_principles>

- **Formalize, don't explore** -- brainstorm explores; write-plan creates the durable contract
- **Linear is the board** -- MCP creates issues; `cape tracker` only refreshes local cache
- **One task only** -- later tasks should reflect what execution actually teaches
- **Session detail stays session-local** -- expanded breakdowns and validation notes do not belong
  on the board

</key_principles>
