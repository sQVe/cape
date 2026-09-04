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

## Rules

1. **Check the routing table before every task.** If a cape skill matches, use it. `cape:set-goal`
   is the exception: point the user to `/cape:set-goal` and never load it yourself.
2. **Load skills with the Skill tool.** Never work from memory; skills change between sessions.
3. **Follow chains in order.** PLAN before BUILD before SHIP.
4. **Stop after write-plan and after each execute-plan task.** Wait for the user to continue. In a
   declared-unattended (AFK) run, the staged run prompt owns continuation instead; when in doubt, a
   human is present and the stops apply.
5. **Use tracker for issue state.** Linear writes go through MCP, local reads through the tracker
   cache.
6. **Ask questions in the user's terms.** An `AskUserQuestion` label names an outcome in plain
   words: "Rebase onto main", "Keep the current base". Commit shas and session internals stay out of
   labels; put them in the option description when the user needs them to decide. A name stays in a
   label only when it is the thing being chosen. State what happened and where things stand before
   asking, and never re-ask a confirmation the user already gave this session.
7. **Expand internal vocabulary on first use.** HITL, AFK, R-IDs, and workflow codenames get a
   plain-word expansion the first time they appear in a message, ticket, or PR: "R3, the permission
   check". Panes, tabs, workflow ids, and subagent names stay out of user-facing prose.
8. **Report at state changes the user can act on.** While waiting, say nothing. One message when
   results land beats ten countdown pings.

## Routing

Short-circuit when the user has already chosen a skill or phase:

- A direct `/cape:<name>` command loads that skill.
- `/plan` loads `cape:brainstorm`, `/build` loads `cape:execute-plan`, `/ship` loads
  `cape:finish-epic`.
- A Linear issue ID, or a ready task in the tracker cache for the active epic, loads
  `cape:execute-plan`. Only these signals skip earlier chain links. Never infer skill choice from
  confidence or task size. One event routes without any request: a merge or rebase that hits
  conflicts mid-task loads `cape:resolve-conflicts` and returns to the interrupted skill once it
  finishes.

Otherwise, first matching row wins:

| User intent                                                       | Skill                    | Notes                      |
| ----------------------------------------------------------------- | ------------------------ | -------------------------- |
| Build, add, create, or implement something new                    | `cape:brainstorm`        | Starts build chain         |
| "How should I approach X" or unclear requirements                 | `cape:brainstorm`        | Design before code         |
| Formalize a design into an epic                                   | `cape:write-plan`        | Requires brainstorm output |
| "Continue", "next task", start/resume epic work, Linear task ID   | `cape:execute-plan`      | Worktree entry is Step 0   |
| Set up an autonomous run, draft a `/goal`, prep an AFK run        | `/cape:set-goal`         | User-invoked; never loaded |
| Resolve merge or rebase conflicts, "fix conflicts"                | `cape:resolve-conflicts` | Finishes the merge         |
| Something broken, a bug to file or fix, error, or stack trace     | `cape:fix-bug`           | Diagnose then patch        |
| Finish or hand off a tracker epic, all tasks done                 | `cape:finish-epic`       | End of build chain         |
| Commit, save changes, wrap this up                                | `cape:commit`            | Standalone                 |
| Create PR, open pull request, "ship it", "ready for review"       | `cape:pr`                | Standalone                 |
| Act on inbound PR review comments, resolve review threads         | `cape:pr-feedback`       | Inbound review loop        |
| Remove AI tells from prose, "unslop", clean up a draft            | `cape:unslop`            | Standalone                 |
| "Explain that", "what does that mean", "in plain english", "eli5" | `cape:bro`               | Restates the last message  |

Two skills are internal. `cape:execute-plan` and `cape:fix-bug` load `cape:test-driven-development`
before any production code. `cape:write-plan`, `cape:execute-plan`, `cape:fix-bug`,
`cape:finish-epic`, and `cape:set-goal` load `cape:tracker`.

Code review has no cape skill. The user runs the builtin `/code-review`, or a skill dispatches
`cape:code-reviewer`. That agent returns its findings as JSON, and whoever dispatched it relays them
through one `ReportFindings` call, which renders them the way the builtin does. A dispatched agent
cannot call that tool itself, so a skipped relay means the findings never render. `cape:pr` carries
the review requirement as a test-plan checkbox.

If nothing matches, proceed without a cape skill.

## Chains

```text
PLAN   brainstorm -> write-plan -> STOP for epic approval
BUILD  execute-plan -> test-driven-development -> commit, then STOP after each task
SHIP   finish-epic -> STOP for PR approval -> pr
BUG    fix-bug -> test-driven-development -> commit, then rejoin BUILD tail
```

Each link's contract lives in its own skill; load it and follow it. The STOP points are mandatory.
