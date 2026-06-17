---
name: don-cape
description: >
  Meta-skill that activates cape's workflow system. Injected at session start — always active, never
  manually triggered. Routes every task to the right cape skill and enforces workflow chains:
  brainstorm before planning, plan before coding, TDD during implementation, diagnosis before
  fixing. If you're about to act on a user request, check this skill's routing table first. When a
  cape skill matches the task, using it is mandatory.
---

<skill_overview> Route every task to the right cape skill and enforce the order skills run in. Cape
skills form build (brainstorm → write-plan → execute-plan) and fix (fix-bug → tdd → commit) chains.
Skipping a link breaks the chain.

Core contract: before acting on any user request, check the routing table. If a cape skill matches,
load it with the Skill tool and follow it. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — The meta-process (check routing table, use Skill tool, follow
chains) is immutable. Each individual skill defines its own rigidity. </rigidity_level>

<when_to_use>

Always active. Injected at session start via hook. Applies to every user message.

</when_to_use>

<critical_rules>

1. **Check the routing table before every task** — if a cape skill matches, use it
2. **Use the Skill tool to load skills** — never work from memory
3. **Follow workflow chains in order** — brainstorm before write-plan before execute-plan
4. **STOP after brainstorm and write-plan** — wait for user to explicitly continue

</critical_rules>

<the_process>

## Step 1: Route the request

**Short-circuit first.** Before scanning the routing table, check for objective signals that the
user has already committed to a specific skill — in which case, skip the brainstorm/write-plan chain
and load that skill directly:

- **Direct skill invocation.** The user's message begins with a `/cape:<name>` slash command (e.g.
  `/cape:pr`, `/cape:fix-bug`). Load the named skill. Do not reroute to brainstorm or write-plan.
- **Pre-existing br task.** An open br task with a `Design` section already exists for the work in
  question (user references the bead ID, or `br ready` surfaces it as the next task). Load
  `cape:execute-plan`. Planning is already done — do not rerun it.

Only these two signals short-circuit the chain. Do not infer scope/size/complexity from prose —
those judgments are unreliable.

If neither signal fires, scan the routing table below. If a skill matches, load it with the Skill
tool. **First match wins** — stop scanning after the first row whose intent matches.

| User intent                                                         | Skill                  | Notes                                                                                   |
| ------------------------------------------------------------------- | ---------------------- | --------------------------------------------------------------------------------------- |
| Build, add, create, implement something new                         | `cape:brainstorm`      | Starts the build chain                                                                  |
| "How should I approach X", unclear requirements                     | `cape:brainstorm`      | Design before code                                                                      |
| Large restructuring requiring design decisions                      | `cape:brainstorm`      | When target design is unclear                                                           |
| Formalize a design into an epic                                     | `cape:write-plan`      | Requires brainstorm output                                                              |
| "Continue", "next task", "let's go", "work on the plan", bare br ID | `cape:execute-plan`    | Run `br ready` first; if empty + open epic exists, suggest finish-epic (see note below) |
| Something broken, error, stack trace, "doesn't work"                | `cape:fix-bug`         | Diagnose-then-patch                                                                     |
| Fix a diagnosed bug, "fix br-N"                                     | `cape:fix-bug`         | Diagnose-then-patch                                                                     |
| Challenge, audit, check assumptions, "what am I assuming"           | `cape:challenge`       | Standalone                                                                              |
| Refine a task, stress-test br-N, "is this task ready", edge cases   | `cape:task-refinement` | Opt-in between write-plan and execute-plan                                              |
| Start work in an epic worktree, create/enter per-epic worktree      | `cape:worktree`        | Standalone                                                                              |
| Finish or close a br epic, all epic tasks done                      | `cape:finish-epic`     | End of build chain                                                                      |
| Commit, save changes, wrap this up                                  | `cape:commit`          | Standalone                                                                              |
| Create PR, open pull request, "ship it", "ready for review"         | `cape:pr`              | Standalone                                                                              |
| Review code, "check my code", "look this over", "anything wrong?"   | `cape:review`          | Standalone; covers bugs/logic plus conventions under reviewer contract                  |
| br/beads operations, issue tracking, bead ID in conversation        | `cape:beads`           | Reference skill                                                                         |

**Internal skills** (called by other skills, not user-routed):

- `cape:expand-task` — called by `execute-plan` to ground tasks in codebase reality before coding
- `cape:test-driven-development` — mandatory before any production code. Loaded by `execute-plan` in
  Step 2 and `fix-bug` in Step 3; user-prompt-submit hook serves as safety net for resumed sessions

If nothing matches, proceed without a skill.

**"Continue / next task" pre-check:** Before loading `cape:execute-plan`, run `br ready`. If it
returns tasks, load execute-plan as normal. If it returns empty, run
`br list --status open --type epic`. If an open epic exists, surface it: "All tasks appear done —
did you mean to run finish-epic?" The user can confirm finish-epic or override to load execute-plan
anyway.

**Agents** (dispatched internally by skills, not user-routed):

| Agent                                                                  | Dispatched by                                                | Purpose                                                                                     |
| ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `cape:code-reviewer` (model: sonnet)                                   | execute-plan, finish-epic, fix-bug                           | Review implementation against plan and standards                                            |
| `cape:codebase-investigator` (model: haiku default, sonnet bug-tracer) | brainstorm, challenge, expand-task, fix-bug, task-refinement | Explore codebase structure; modes: default / bug-tracer / test-auditor / notebox-researcher |
| `cape:fact-checker` (model: sonnet)                                    | brainstorm, execute-plan, task-refinement                    | Verify claims and assumptions against codebase evidence                                     |
| `cape:internet-researcher` (model: sonnet)                             | brainstorm, fix-bug                                          | Research external APIs, libraries, community practices                                      |
| `cape:test-runner` (model: haiku)                                      | test-driven-development, finish-epic                         | Run tests and hooks without polluting context                                               |

Skills dispatch agents when deep investigation is needed. If agent dispatch fails, the skill
continues manually with Glob/Grep/Read/WebSearch.

---

## Step 2: Follow the chain

Cape skills form workflow chains. Each link hands off to the next. Don't skip links.

**Build chain** — for new features, integrations, system changes:

```
brainstorm [challenge optional] → write-plan → STOP → execute-plan (expand-task → TDD → review → commit loop) → finish-epic → commit
```

- `brainstorm` is conversational — never enters plan mode. It checkpoints after research and after
  proposing approaches, waiting for user input each time. Produces a design summary.
- `challenge` is offered by brainstorm (opt-in) to surface hidden assumptions before locking
- `write-plan` formalizes it into a br epic with one first task
- **STOP** — present the epic and wait. The user decides when to start building.
- `execute-plan` implements one task, challenges completed work, creates the next task, stops for
  review
  - `expand-task` (internal, automatic) grounds the task in codebase reality before coding starts
  - `commit` persists each completed unit of work
- `finish-epic` verifies all success criteria, runs final checks, closes the epic
- `commit` persists any remaining changes

**Fix chain** — for bugs and defects:

```
fix-bug (diagnose-then-patch) → tdd → commit
```

- `fix-bug` diagnoses to root cause, creates or adopts a br bug, writes a failing test, implements
  the minimal fix, and verifies
- `commit` persists the fix

**Why chains matter:** brainstorm researches the codebase and surfaces assumptions before you commit
to an approach. write-plan locks requirements before implementation begins. Skipping these steps
means building on unvalidated assumptions — the kind of shortcut that creates rework.

**Vague feature requests go through the chain.** When a user says "add feature X" with no `/cape:*`
invocation and no pre-existing br task, that's a WHAT statement — brainstorm and write-plan still
apply. Direct `/cape:<name>` invocation, or executing against a br task that already has a design,
is the user's explicit choice of HOW and short-circuits the chain (see Step 1).

---

## Step 3: Use skills correctly

**Load with the Skill tool.** Never work from memory. Skills evolve between sessions.

</the_process>

<examples>

<example>
<scenario>User asks to build a feature</scenario>

User: "Add OAuth support to our app"

**Wrong:** Start writing auth code. No research, no design, no plan. Discovers halfway through that
passport.js already exists in the codebase.

**Right:**

1. Route: "build something new" → cape:brainstorm
2. Research codebase (finds passport.js), ask clarifying questions, propose approaches
3. Present design summary
4. Suggest `cape:write-plan` as next step.
5. STOP — do not start coding </example>

<example>
<scenario>User reports something broken</scenario>

User: "The API returns 500 when the request body has unicode characters"

**Wrong:** Grep for encoding, guess the fix, apply it. The fix masks the symptom while the root
cause (missing charset header in the middleware) remains.

**Right:**

1. Route: "something broken" → cape:fix-bug
2. Reproduce, trace to root cause, create br bug with evidence
3. Write failing test, implement minimal fix, verify, commit </example>

<example>
<scenario>User gives a specific instruction that still needs the chain</scenario>

User: "Create a caching layer for our database queries using Redis"

**Wrong:** "The user was specific, so I can skip brainstorm." Start implementing Redis caching. Miss
that the project already has an in-memory cache, creating a conflicting layer.

**Right:** Specific instructions describe WHAT to build. The build chain determines HOW.

1. Route: "build something new" → cape:brainstorm
2. Research reveals existing cache at `src/cache/memory.ts`
3. Design addresses migration from memory cache to Redis, not a second cache layer
4. Proceed through write-plan → execute-plan as normal </example>

</examples>

<key_principles>

- **Skills are mandatory** — finding a matching skill means using it, not considering it
- **Chains have order** — each link feeds the next; skipping a link produces weaker output
- **STOP means STOP** — after brainstorm and write-plan, present results and wait
- **Research before code** — brainstorm exists because building on unvalidated assumptions creates
  rework that costs more than the research

</key_principles>
