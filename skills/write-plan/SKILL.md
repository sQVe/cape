---
name: write-plan
description: >
  Formalize a brainstorm design into a Linear human-ticket/plan-issue pair with its first sub-issue
  task. Use after cape:brainstorm produces a design summary. Not for exploration (cape:brainstorm)
  or execution (cape:execute-plan).
---

# Write plan

Turn a validated brainstorm design into a Linear human-ticket/plan-issue pair and exactly one first
sub-issue task, then stop. No pair without design context, no task without a parent plan issue, and
every Linear write is followed by a local `cape tracker` cache refresh.

## Rules

1. **Require design context.** Never create the pair without a brainstorm design summary. If none
   exists, stop and route to `cape:brainstorm` or ask the user for it.
2. **STOP after creation.** Present the pair and first task, then wait. Implementation belongs to
   `cape:execute-plan`.
3. **Confirm before creating a new Linear project.** Routing to an existing project needs no
   approval; creating one does.
4. **Keep session detail off the board.** Expanded breakdowns, validation transcripts, and
   divergence logs stay in conversation, not in Linear.

## Process

### 1. Verify the design

Confirm a design summary exists in conversation. Review it for blockers: vague requirements,
anti-patterns without reasoning, open questions that affect implementation, architecture claims
without codebase evidence. Resolve blockers with the user before touching Linear.

Signal the phase for the herdr rail: `cape workspace phase plan`.

### 2. Write the plan contract

Shape the design into the canonical plan-issue shape from `cape:tracker`'s
[linear-templates.md](../tracker/resources/linear-templates.md), picking Light or Full by its
criteria.

When the data shape is not obvious, settle it in required constraints before writing any R-row:
fields, types, what is nullable, which states it makes unrepresentable. The R-table then describes
behavior over a fixed shape.

Keep the four sections separate; never blend them:

- **Required behavior.** A numbered table (R1, R2, ...) of `Scenario → Expected result`. Name the
  actor, action, and observable proof in each row ("When an admin uploads a CSV with missing
  headers, the import lists each missing header"). Never "works as expected". Use `GIVEN/WHEN/THEN`
  in the scenario cell when a case has several preconditions. Subtasks reference these rows.
- **Required constraints.** Settled boundaries (routes, schemas, service boundaries, auth and
  storage patterns, compatibility rules) and anti-patterns as `NO X (reason: Y)`. When the work
  writes, migrates, syncs, or retries, say whether a second run lands where the first did and what
  makes it so (a key, a guard, an upsert). When nothing repeats, say that. Never leave it to the
  implementer.
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

The first task is a vertical slice in the tracker's Task shape; `Delivers` names the plan R-IDs it
covers.

### 4. Create the pair and first task

Load `cape:tracker` and apply its `resources/agent-contract.md`. Create the pair per the tracker
contract's pairing protocol: a concise human ticket in the repo's home team whose description a
human can scan, carrying no R-tables, constraints, or acceptance criteria, plus a plan issue in `AI`
holding the full contract from step 2, created as a sub-issue of that ticket with `state: "Todo"`.
Check the ticket is a leaf first, per the contract's pairing rules. Both stay untyped parents.

Create exactly one sub-issue under the plan issue with `save_issue`, `state: "Todo"`, and only
task-level detail in its description.

Then refresh the cache per `cape:tracker`'s create-work recipe.

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
