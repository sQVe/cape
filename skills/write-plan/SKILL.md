---
name: write-plan
description: >
  Formalize a brainstorm design into a Linear human-ticket/plan-issue pair with one first sub-issue
  task. Use after cape:brainstorm has produced a design summary. Triggers on: user runs
  /cape:write-plan, "create the epic", "formalize this design", "write the plan", transitioning from
  brainstorm to implementation. Do NOT use for initial exploration (use cape:brainstorm), executing
  existing plans (use cape:execute-plan), or bug diagnosis and fixes (use cape:fix-bug).
---

# Write plan

Turn a validated brainstorm design into a Linear human-ticket/plan-issue pair and exactly one first
sub-issue task, then stop. No pair without design context, no task without a parent plan issue, and
every Linear write is followed by a local `cape tracker` cache refresh.

The plan contract, first-task stress test, cache refresh, and stop after creation are fixed;
validation depth adapts to the design's complexity.

## Rules

1. **Require design context.** Never create the pair without a brainstorm design summary. If none
   exists, stop and route to `cape:brainstorm` or ask the user for it.
2. **STOP after creation.** Present the pair and first task, then wait. Implementation belongs to
   `cape:execute-plan`.
3. **Confirm before creating a new Linear project.** Routing to an existing project needs no
   approval; creating one does.
4. **Create only the first task.** Later tasks should reflect what execution teaches, so
   execute-plan creates them iteratively.
5. **Stress-test the first task before creation.** Verify paths, patterns, edge cases, and test gaps
   against the codebase.
6. **Keep session detail off the board.** Expanded breakdowns, validation transcripts, and
   divergence logs stay in conversation, not in Linear.
7. **Refresh the cache after every Linear write.** MCP Linear creates issues; `cape tracker` only
   writes the local cache and never reads the network.

## Process

### 1. Verify the design

Confirm a design summary exists in conversation. Review it for blockers: vague requirements,
anti-patterns without reasoning, open questions that affect implementation, architecture claims
without codebase evidence. Resolve blockers with the user before touching Linear.

### 2. Write the plan contract

Shape the design into the canonical plan-issue shape from `cape:tracker`'s
[linear-templates.md](../tracker/resources/linear-templates.md). Pick **Light** by default; pick
**Full** when a user journey changes, a new lifecycle or state exists, a migration runs,
authorization matters, multiple systems or teams are involved, or rollout, observability, or
rollback matters.

Keep the four sections separate; never blend them:

- **Required behavior.** A numbered table (R1, R2, ...) of `Scenario → Expected result`. Name the
  actor, action, and observable proof in each row ("When an admin uploads a CSV with missing
  headers, the import lists each missing header"). Never "works as expected". Use `GIVEN/WHEN/THEN`
  in the scenario cell when a case has several preconditions. Subtasks reference these rows.
- **Required constraints.** Settled boundaries (routes, schemas, service boundaries, auth and
  storage patterns, compatibility rules) and anti-patterns as `NO X (reason: Y)`.
- **Proposed approach.** A recommendation the builder may improve, with concrete files, data flow,
  and known risks.
- **Acceptance criteria.** Evidence per R-ID, plus a regression check that out-of-scope behavior
  holds.

Lead with the at-a-glance card so the first lines stand alone (Light: Outcome, Problem, User/system;
Full: Primary user, plus Risk). For Full, sketch the work breakdown as a non-binding table in the
parent; do not pre-create those issues.

### 3. Stress-test the first task

Dispatch `cape:codebase-investigator` (default mode, model: haiku), or verify manually with search
and file reads: file paths, APIs, test setup, helpers to reuse, similar implementation patterns.

The first task is a vertical slice with:

- Goal, with `Delivers: R1, R2` naming the plan R-IDs it covers
- Interface: inputs, outputs, side effects
- Execution mode: HITL or AFK
- Behaviors small enough for TDD cycles
- References to verified files or patterns
- Success criteria

### 4. Create the pair and first task

Run all human-ticket, plan-issue, and task prose through the `cape:unslop` skill before writing to
Linear.

Load `cape:tracker` and apply its `resources/agent-contract.md`; it owns team routing, dedupe,
project routing, labels, priority, and naming. Create the pair per the tracker contract's pairing
protocol: a concise human ticket in the repo's home team whose description a human can scan,
carrying no R-tables, constraints, or acceptance criteria, plus a plan issue in `AI` holding the
full contract from step 2, linked bidirectionally. When the work has no user-informational value,
use the tracker contract's AI-only exception and skip the human ticket. Both stay untyped parents.

Create exactly one sub-issue under the plan issue with `save_issue`, with only task-level detail in
its description.

Then refresh the cache per `cape:tracker`'s create-work recipe: fetch the plan issue with
`get_issue` (sub-issues included), stamp `humanTicketId`, and pass the JSON to
`cape tracker cache-epic`.

### 5. Present and STOP

```text
Human ticket <human-id> created: <title>
Plan issue <plan-id> created: <title>
First task <task-id> created: <title>

The plan issue (<Light|Full>) has R1-R<N> required behaviors, <N> constraints, and <N> acceptance criteria.
The first task delivers <R-IDs> and was codebase-verified and stress-tested.

Continue with cape:execute-plan to start building.
```

Omit the human-ticket line for AI-only work.

**STOP.** Do not start implementation in the same invocation.

## Agents

Dispatch `cape:codebase-investigator` when:

- Stress-testing the first task (step 3) and manual verification would take longer than a dispatch

## Skills

Load `cape:tracker` when:

- You need the exact MCP Linear plus cache-write protocol
- A cache refresh fails and you need the expected cache shape

## Examples

**Wrong:** The design says "tokens stored securely" and the requirement goes to Linear as written.
It permits localStorage, sessionStorage, or cookies, and the builder picks one at random.

**Right:** Tighten it first: "Tokens stored in httpOnly cookies; NO localStorage tokens (reason: XSS
token theft)." Then create the human/AI pair and first task and refresh the cache.
