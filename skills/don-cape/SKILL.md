---
name: don-cape
description: >
  Meta-skill that routes every task to the right cape skill and enforces the workflow chain.
  Injected at session start, always active, never manually triggered.
---

# Don cape

Route every task to the right cape skill and enforce the order skills run in. Before acting on any
user request, check the routing table. If a cape skill matches, load it with the Skill tool and
follow it.

The meta-process is fixed: check routing, load the matching skill, follow chain order. Each skill
defines its own flexibility.

## Rules

1. **Check the routing table before every task.** If a cape skill matches, use it.
2. **Load skills with the Skill tool.** Never work from memory; skills change between sessions.
3. **Follow chains in order.** PLAN before BUILD before SHIP.
4. **Stop after write-plan and after each execute-plan task.** Wait for the user to continue. In a
   declared-unattended (AFK) run, the staged run prompt owns continuation instead; when in doubt, a
   human is present and the stops apply.
5. **Use tracker for issue state.** Linear writes go through MCP, local reads through the tracker
   cache.
6. **When editing a cape skill, spend prose only on what no check can enforce.** Anything a lint
   rule, a hook, or a `cape validate` check can hold belongs in the check.

## Routing

Short-circuit when the user has already chosen a skill or phase:

- A direct `/cape:<name>` command loads that skill.
- `/plan` loads `cape:brainstorm`, `/build` loads `cape:execute-plan`, `/ship` loads
  `cape:finish-epic`.
- A Linear issue ID, or a ready task in the tracker cache for the active epic, loads
  `cape:execute-plan`.

Only these signals skip earlier chain links. Never infer skill choice from confidence or task size.

Otherwise, first matching row wins:

| User intent                                                       | Skill               | Notes                      |
| ----------------------------------------------------------------- | ------------------- | -------------------------- |
| Build, add, create, or implement something new                    | `cape:brainstorm`   | Starts build chain         |
| "How should I approach X" or unclear requirements                 | `cape:brainstorm`   | Design before code         |
| Formalize a design into an epic                                   | `cape:write-plan`   | Requires brainstorm output |
| "Continue", "next task", start/resume epic work, Linear task ID   | `cape:execute-plan` | Worktree entry is Step 0   |
| Set up an autonomous run, draft a `/goal`, prep an AFK run        | `cape:set-goal`     | Stages a run draft         |
| Something broken, error, stack trace, or a diagnosed Linear bug   | `cape:fix-bug`      | Diagnose then patch        |
| Finish or hand off a tracker epic, all tasks done                 | `cape:finish-epic`  | End of build chain         |
| Commit, save changes, wrap this up                                | `cape:commit`       | Standalone                 |
| Create PR, open pull request, "ship it", "ready for review"       | `cape:pr`           | Standalone                 |
| Act on inbound PR review comments, resolve review threads         | `cape:pr-feedback`  | Inbound review loop        |
| Linear/tracker operations, issue state, ready work, cache refresh | `cape:tracker`      | Reference skill            |
| Remove AI tells from prose, "unslop", clean up a draft            | `cape:unslop`       | Standalone                 |
| "Explain that", "what does that mean", "in plain english", "eli5" | `cape:bro`          | Restates the last message  |

`cape:test-driven-development` is internal: `cape:execute-plan` and `cape:fix-bug` load it before
any production code.

Code review has no cape skill. The user runs the builtin `/code-review`, or a skill dispatches
`cape:code-reviewer`. That agent returns its findings as JSON, and whoever dispatched it relays them
through one `ReportFindings` call, which renders them the way the builtin does. A dispatched agent
cannot call that tool itself, so a skipped relay means the findings never render. `cape:pr` carries
the review requirement as a test-plan checkbox.

If nothing matches, proceed without a cape skill.

Before loading `cape:execute-plan` for "continue" or "next task", run `cape tracker show`. If ready
tasks exist, execute-plan handles them. If none remain but an active epic exists, suggest
`cape:finish-epic`. A missing or stale cache follows the `cape:tracker` cache rule: treat it as
empty and say it needs a refresh from the latest MCP result.

## Chains

```text
PLAN   brainstorm -> write-plan -> STOP for epic approval
BUILD  execute-plan -> test-driven-development -> commit, then STOP after each task
SHIP   finish-epic -> STOP for PR approval -> pr
BUG    fix-bug -> test-driven-development -> commit, then rejoin BUILD tail
```

Each link's contract lives in its own skill; load it and follow it. The STOP points are mandatory.
Vague feature requests enter at brainstorm. Direct skill invocation or a ready tracker task is the
user's explicit choice to skip earlier links.

## Examples

**Wrong:** User asks to build a feature; start writing code immediately.

**Right:** Route to `cape:brainstorm`, research the codebase and discuss design, then
`cape:write-plan` creates the Linear epic and first task.
