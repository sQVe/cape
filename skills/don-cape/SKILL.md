---
name: don-cape
user-invocable: false
description: >
  Meta-skill that activates cape's workflow system. Injected at session start — always active, never
  manually triggered. Routes every task to the right cape skill and enforces workflow chains:
  brainstorm before planning, plan before coding, TDD during implementation, debug before fixing. If
  you're about to act on a user request, check this skill's routing table first. When a cape skill
  matches the task, using it is mandatory.
---

<skill_overview> Route every task to the right cape skill and enforce the order skills run in. Cape
skills form chains — brainstorm feeds write-plan feeds execute-plan. Skipping a link breaks the
chain.

Core contract: before acting on any user request, check the routing table. If a cape skill matches,
load it with the Skill tool and follow it. </skill_overview>

<rigidity_level> LOW FREEDOM — The meta-process (check routing table, use Skill tool, follow chains)
is immutable. Each individual skill defines its own rigidity. </rigidity_level>

<when_to_use>

Always active. Injected at session start via hook. Applies to every user message.

</when_to_use>

<the_process>

## Step 1: Route the request

Before responding to any user message, scan this table. If a skill matches, load it with the Skill
tool.

| User intent                                                         | Skill                          | Notes                           |
| ------------------------------------------------------------------- | ------------------------------ | ------------------------------- |
| Build, add, create, implement something new                         | `cape:brainstorm`              | Starts the build chain          |
| "How should I approach X", unclear requirements                     | `cape:brainstorm`              | Design before code              |
| Large refactor requiring design decisions                           | `cape:brainstorm`              | When architecture is unclear    |
| Design an interface, API surface, module boundary, type contract    | `cape:design-an-interface`     | Standalone or within brainstorm |
| Formalize a design into an epic                                     | `cape:write-plan`              | Requires brainstorm output      |
| "Continue", "next task", "let's go", "work on the plan", bare br ID | `cape:execute-plan`            | Picks up from br state          |
| Something broken, error, stack trace, "doesn't work"                | `cape:debug-issue`             | Investigation only              |
| Fix a diagnosed bug, "fix br-N"                                     | `cape:fix-bug`                 | Requires br bug to exist        |
| Refine, stress-test, harden a task before executing                 | `cape:task-refinement`         | Between plan and execute        |
| Find untested behavior, test gaps, what's untested                  | `cape:find-test-gaps`          | Standalone                      |
| Audit test quality, tautological tests, coverage gaming             | `cape:analyze-tests`           | Standalone                      |
| Write tests for X, TDD, red-green-refactor, test before code        | `cape:test-driven-development` | Internal to execute/fix-bug     |
| Challenge, audit, check assumptions, "what am I assuming"           | `cape:challenge`               | Standalone                      |
| Create a branch, start work on a branch                             | `cape:branch`                  | Standalone                      |
| Finish, wrap up, close out an epic, all tasks done                  | `cape:finish-epic`             | End of build chain              |
| Commit, save changes                                                | `cape:commit`                  | Standalone                      |
| Create PR, open pull request, "ship it", "ready for review"         | `cape:pr`                      | Standalone                      |
| Review code, "check my code", "look this over", "anything wrong?"   | `cape:review`                  | Standalone                      |
| br/beads operations, issue tracking, bead ID in conversation        | `cape:beads`                   | Reference skill                 |

**Internal skills** (called by other skills, not user-routed):

- `cape:expand-task` — called by `execute-plan` to ground tasks in codebase reality before coding
- `cape:test-driven-development` — called by `execute-plan` and `fix-bug` for RED-GREEN-REFACTOR

If nothing matches, proceed without a skill.

**Agents** (dispatched internally by skills, not user-routed):

| Agent                        | Dispatched by                                                                                            | Purpose                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `cape:bug-tracer`            | debug-issue, fix-bug                                                                                     | Trace execution backward from errors to root cause                           |
| `cape:code-reviewer`         | execute-plan, finish-epic, fix-bug                                                                       | Review implementation against plan and standards                             |
| `cape:codebase-investigator` | brainstorm, debug-issue, fix-bug, expand-task, find-test-gaps, analyze-tests, task-refinement, challenge | Explore codebase structure, find patterns, verify assumptions                |
| `cape:fact-checker`          | brainstorm, execute-plan, task-refinement                                                                | Verify claims and assumptions against codebase evidence                      |
| `cape:internet-researcher`   | brainstorm, debug-issue, fix-bug                                                                         | Research external APIs, libraries, community practices                       |
| `cape:notebox-researcher`    | brainstorm, debug-issue, task-refinement                                                                 | Surface past decisions and research from notes                               |
| `cape:test-auditor`          | analyze-tests                                                                                            | Audit test quality for tautological tests, weak assertions, missing coverage |
| `cape:test-runner`           | test-driven-development, finish-epic                                                                     | Run tests and hooks without polluting context                                |

Skills dispatch agents when deep investigation is needed. If agent dispatch fails, the skill
continues manually with Glob/Grep/Read/WebSearch.

---

## Step 2: Follow the chain

Cape skills form two workflow chains. Each link hands off to the next. Don't skip links.

**Build chain** — for new features, integrations, system changes:

```
brainstorm [includes challenge] → write-plan → STOP → [task-refinement] → execute-plan (expand-task → TDD → review → commit loop) → finish-epic → commit
```

- `brainstorm` produces a design summary
- `challenge` is invoked by brainstorm to surface hidden assumptions before locking the design
- `write-plan` formalizes it into a br epic with one first task
- **STOP** — present the epic and wait. The user decides when to start building.
- `task-refinement` (optional) stress-tests the task before implementation
- `execute-plan` implements one task, challenges completed work, creates the next task, stops for
  review
  - `expand-task` (internal, automatic) grounds the task in codebase reality before coding starts
  - `commit` persists each completed unit of work
- `finish-epic` verifies all success criteria, runs final checks, closes the epic
- `commit` persists any remaining changes

**Fix chain** — for bugs and defects:

```
debug-issue → fix-bug → commit
```

- `debug-issue` investigates to root cause, creates a br bug
- `fix-bug` writes a failing test, implements the minimal fix, verifies, prompts for commit
- `commit` persists the fix

**Why chains matter:** brainstorm researches the codebase and surfaces assumptions before you commit
to an approach. write-plan locks requirements before implementation begins. Skipping these steps
means building on unvalidated assumptions — the kind of shortcut that creates rework.

**User intent is WHAT, not HOW.** When a user says "add feature X", that's what they want built —
not permission to skip brainstorm and write-plan. The chain determines how.

---

## Step 3: Use skills correctly

**Load with the Skill tool.** Never work from memory. Skills evolve between sessions.

**Announce usage.** Before using a skill, state which one and why:

- "I'm using cape:brainstorm to refine your idea into a design."
- "I'm using cape:debug-issue to investigate this systematically."
- "I'm using cape:commit to stage and commit these changes."

**Track checklists.** If a skill has a checklist, create TodoWrite todos for each item. Mental
tracking leads to skipped steps.

</the_process>

<examples>

<example>
<scenario>User asks to build a feature</scenario>

User: "Add OAuth support to our app"

**Wrong:** Start writing auth code. No research, no design, no plan. Discovers halfway through that
passport.js already exists in the codebase.

**Right:**

1. Route: "build something new" → cape:brainstorm
2. "I'm using cape:brainstorm to refine your requirements."
3. Research codebase (finds passport.js), ask clarifying questions, propose approaches
4. Present design summary
5. "Run `/cape:write-plan` to formalize this into a br epic."
6. STOP — do not start coding </example>

<example>
<scenario>User reports something broken</scenario>

User: "The API returns 500 when the request body has unicode characters"

**Wrong:** Grep for encoding, guess the fix, apply it. The fix masks the symptom while the root
cause (missing charset header in the middleware) remains.

**Right:**

1. Route: "something broken" → cape:debug-issue
2. "I'm using cape:debug-issue to investigate this systematically."
3. Reproduce, trace to root cause, create br bug with evidence
4. Route: diagnosed bug → cape:fix-bug
5. Write failing test, implement minimal fix, verify, commit </example>

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

<critical_rules>

1. **Check the routing table before every task** — if a cape skill matches, use it
2. **Use the Skill tool to load skills** — never work from memory
3. **Follow workflow chains in order** — brainstorm before write-plan before execute-plan
4. **STOP after brainstorm and write-plan** — wait for user to explicitly continue
5. **Announce skill usage** — state which skill and why before starting

</critical_rules>
