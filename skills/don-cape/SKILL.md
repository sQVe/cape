---
name: don-cape
description: >
  Meta-skill that activates cape's workflow system. Injected at session start; always active and
  never manually triggered. Routes every task to the right cape skill and enforces workflow chains:
  brainstorm before planning, plan before coding, TDD during implementation, diagnosis before
  fixing. If a cape skill matches the user request, using it is mandatory.
---

<skill_overview> Route every task to the right cape skill and enforce the order skills run in. Cape
skills form build (brainstorm -> write-plan -> execute-plan) and fix (fix-bug -> TDD -> commit)
chains.

Core contract: before acting on any user request, check the routing table. If a cape skill matches,
load it with the Skill tool and follow it. </skill_overview>

<rigidity_level> MEDIUM FREEDOM -- The meta-process is immutable: check routing, load the matching
skill, and follow chain order. Each skill defines its own flexibility. </rigidity_level>

<when_to_use>

Always active. Injected at session start via hook. Applies to every user message.

</when_to_use>

<critical_rules>

1. **Check the routing table before every task** -- if a cape skill matches, use it
2. **Use the Skill tool to load skills** -- never work from memory
3. **Follow workflow chains in order** -- brainstorm before write-plan before execute-plan
4. **Stop after brainstorm and write-plan** -- wait for user to explicitly continue
5. **Use tracker for issue state** -- Linear writes through MCP, local reads from tracker cache

</critical_rules>

<the_process>

## Step 1: Route The Request

Short-circuit first when the user has already committed to a specific skill:

- Direct `/cape:<name>` command: load that skill directly.
- Pre-existing tracker task: when the user references a Linear issue ID or the tracker cache shows a
  ready task for the active epic, load `cape:execute-plan`.

Only these signals short-circuit the build chain. Do not infer skill choice from confidence or task
size.

First matching row wins:

| User intent                                                       | Skill               | Notes                      |
| ----------------------------------------------------------------- | ------------------- | -------------------------- |
| Build, add, create, or implement something new                    | `cape:brainstorm`   | Starts build chain         |
| "How should I approach X" or unclear requirements                 | `cape:brainstorm`   | Design before code         |
| Formalize a design into an epic                                   | `cape:write-plan`   | Requires brainstorm output |
| "Continue", "next task", "work on the plan", Linear task ID       | `cape:execute-plan` | Orient from tracker cache  |
| Something broken, error, stack trace, "doesn't work"              | `cape:fix-bug`      | Diagnose then patch        |
| Fix a diagnosed Linear bug issue                                  | `cape:fix-bug`      | Diagnose then patch        |
| Start work in an epic worktree, create/enter per-epic worktree    | `cape:worktree`     | Standalone                 |
| Finish or close a tracker epic, all tasks done                    | `cape:finish-epic`  | End of build chain         |
| Commit, save changes, wrap this up                                | `cape:commit`       | Standalone                 |
| Create PR, open pull request, "ship it", "ready for review"       | `cape:pr`           | Standalone                 |
| Review code, "check my code", "anything wrong?"                   | `cape:review`       | Read-only review           |
| Linear/tracker operations, issue state, ready work, cache refresh | `cape:tracker`      | Reference skill            |

Internal skills:

- `cape:test-driven-development` -- mandatory before production code. Loaded by execute-plan and
  fix-bug; hook safety nets cover resumed sessions.

If nothing matches, proceed without a cape skill.

**Continue / next task pre-check:** Before loading `cape:execute-plan`, read
`hooks/context/tracker.json`. If ready tasks exist, execute-plan handles them. If no ready tasks
remain but an active epic exists, suggest `cape:finish-epic`. If the cache is empty or corrupt, say
that tracker cache needs a refresh from the latest Linear MCP result.

---

## Step 2: Follow The Chain

Build chain:

```text
brainstorm -> write-plan -> STOP -> execute-plan -> finish-epic -> commit
```

- `brainstorm` researches, asks questions, compares approaches, and produces a design summary.
- `write-plan` creates a Linear epic and one first sub-issue task, then refreshes tracker cache.
- `execute-plan` implements one task, verifies it, closes it in Linear, creates or identifies the
  next task, refreshes cache, and stops for review.
- `finish-epic` verifies all success criteria, closes the Linear epic, refreshes cache, and reports.
- `commit` persists completed work.

Fix chain:

```text
fix-bug -> test-driven-development -> commit
```

- `fix-bug` diagnoses to root cause, adopts or creates a Linear bug issue, writes a failing
  regression test, implements the fix, verifies, closes in Linear, and refreshes cache.

Vague feature requests go through the build chain. Direct skill invocation or a ready tracker task
is the user's explicit choice to skip earlier links.

---

## Step 3: Use Skills Correctly

Load matching skills with the Skill tool and follow their instructions. Skills evolve between
sessions; do not work from memory.

</the_process>

<examples>

<example>
<scenario>User asks to build a feature</scenario>

**Wrong:** Start writing code immediately.

**Right:** Route to `cape:brainstorm`, research the codebase, discuss design, then use
`cape:write-plan` to create the Linear epic and first task. </example>

<example>
<scenario>User reports something broken</scenario>

**Wrong:** Guess a fix and patch it without a reproduction.

**Right:** Route to `cape:fix-bug`, reproduce the symptom, trace root cause, track the bug in
Linear, fix with a failing regression test, close, and refresh cache. </example>

<example>
<scenario>User says "continue"</scenario>

**Wrong:** Ask where to start without checking state.

**Right:** Read tracker cache, load `cape:execute-plan` if ready work exists, or suggest
`cape:finish-epic` if all tasks appear done. </example>

</examples>

<key_principles>

- **Skills are mandatory** -- finding a matching skill means using it
- **Chains have order** -- each link feeds the next
- **STOP means STOP** -- after brainstorm and write-plan, present results and wait
- **Tracker is the state seam** -- Linear handles writes; cache powers local reads

</key_principles>
