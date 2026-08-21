---
name: execute-plan
description: >
  Implement a Linear tracker epic one task at a time. Use on "continue", "next task", a Linear issue
  ID, or after planning completes. Not for bug fixes (cape:fix-bug) or design (cape:brainstorm).
---

# Execute plan

Implement one tracker task, verify it, mark it done in the cache, line up the next task, and stop
for review. One task per invocation in HITL mode, and all fine-grained plans and reflections stay in
session, never on the Linear board.

The one-task loop, TDD, verification before close, and cache refresh after every Linear write are
fixed. Implementation tactics adapt to the task.

## Rules

1. **STOP after each task in HITL mode.** Present the checkpoint and wait for the user.
2. **Close only after verification.** Tests and the task's success criteria must pass first.
3. **Orient from the cache.** Use `cape tracker show` and the current git branch to pick work. No
   network reads to pick work; once a task is chosen, fetching its description with MCP `get_issue`
   is fine. Never invent task state.
4. **Task status is cache-only during build.** Track it with `cape tracker cache-status`; no MCP
   status writes mid-build; the PR closing line catches Linear up at merge. Content writes
   (descriptions, new sub-issues) still go to Linear first, followed immediately by the matching
   `cape tracker` command.
5. **Test before code.** Load `cape:test-driven-development` before any production edit.
6. **Keep expansion in session.** No expanded plans, divergence notes, or close-out ceremony go to
   Linear. The board tracks issues, not implementation transcripts.

## Process

### 0. Enter the epic worktree

Skip this step only when already on the epic's branch. From any other branch, the default branch or
an unrelated feature branch alike, set up the per-epic worktree first, so epic changes never land on
the wrong branch. One epic, one worktree:

1. Read `gitBranchName` for the epic from Linear (`get_issue`), sanitize to ASCII kebab-case.
2. Use grove: `grove add --base <default-branch> <type>/<branch-slug>` (`<type>` is the
   conventional-commit prefix). If the worktree exists, enter it instead of creating another.
3. From inside it, run `cape workspace phase build` (safe no-op outside herdr).

### 1. Orient from the tracker cache

Run `cape tracker show` (shape documented in `cape:tracker`). Pick work in this order:

1. The in-progress task under the active epic.
2. A ready task: `stateType` of `unstarted`, or a status such as `Todo`.
3. None left and the epic's success criteria look met: load `cape:finish-epic`.

If multiple epics are active, ask the user which one to continue. A missing or stale cache follows
the `cape:tracker` cache rule: treat it as empty and refresh from an MCP result already in session.

### 2. Expand in session

Load the epic contract from the AI plan issue, where it lives and never on the human ticket, and the
task details from session context. If the task's Linear description is not in the session, fetch it
with MCP `get_issue`; if MCP is unavailable, ask the user for the description instead.

Build an in-session breakdown before coding:

- Task goal and success criteria
- Epic R-IDs and required constraints that apply
- Files and patterns, verified by `cape:codebase-investigator` or manual search
- TDD slices, each with one behavior and one verification command
- Risks, assumptions, and explicit out-of-scope items

A delegate's summary is a claim, not evidence. Open the files it names, or read the diff when it
wrote one, before acting on what it reports about the codebase. That holds for
`cape:codebase-investigator` here and for any later delegate whose report shapes the change. It does
not apply to a delegate you dispatched to keep output out of context, such as `cape:test-runner`;
re-reading what it summarized would undo the dispatch.

**STOP if the task is too large for one cycle.** Recommend a split and create the smaller sub-issues
only after the user agrees.

Mark the task in progress in the cache only, with no MCP status writes during build, per the tracker
contract. Then signal the phase:

```bash
cape tracker cache-status <task-id> "In Progress" started
cape workspace phase build
```

Load `cape:test-driven-development` with the Skill tool.

### 3. Implement and verify

Execute the breakdown one slice at a time: write the smallest failing test, confirm it fails for the
expected reason, make the minimum production change, re-run the focused test and the affected suite,
clean up only when it clearly improves the result, then run the slice's verification command.

Threading a new signal through several layers is a stop-and-look moment, not routine work. Search
for a more direct path first, such as a path that already reaches the destination or a value the
endpoint can derive on its own. Go through the layers only after naming why the direct path fails.

If an R-ID or required constraint forces a change of approach, explain the divergence in
conversation and continue only when the new approach still satisfies the epic contract. The
divergence stays in session.

Before closing, confirm:

- Every task success criterion is satisfied, with evidence
- Relevant tests pass
- The repository's documented check commands pass (for cape itself: `pnpm check`, `pnpm typecheck`,
  and `pnpm test`)
- Every `CONFIRMED` code-review finding is fixed, and every `PLAUSIBLE` one is fixed or dismissed
  with a reason

### 4. Close and plan next

Mark the task done in the cache only, never through MCP. The PR closing line moves it to `Done` in
Linear at merge, per the tracker contract:

```bash
cape tracker cache-status <task-id> Done completed
```

Reflect in session: what was built, what changed from the original assumption, whether the epic
approach still holds, and the next smallest vertical slice. The next task comes from what execution
revealed, not from what planning assumed.

If a ready task already exists in the cache, checkpoint to it. If a new task is needed, create it as
a sub-issue of the AI plan issue through MCP: load `cape:tracker`, apply its
`resources/agent-contract.md`, and run the issue text through `cape:unslop` before posting. Then
refresh the epic cache per `cape:tracker`'s create-work recipe: a fresh `get_issue` result piped to
`cape tracker cache-epic`.

If no work remains, load `cape:finish-epic`.

### 5. Checkpoint and stop

Present:

```text
Checkpoint: <task-id> complete

Done: <what changed and what was verified>
Next: <next-id or finish-epic>
Verification: <commands and results>
```

**STOP in HITL mode.** Wait for user input. In AFK mode, load `cape:commit`, then continue only if
the next task is already clear and within the approved scope.

## Agents

Dispatch `cape:codebase-investigator` when:

- The task references files, APIs, or patterns that need verification
- A failure suggests the plan misunderstood the codebase

Dispatch `cape:code-reviewer` when:

- A change is non-trivial: it crosses modules or touches public interfaces

It returns one JSON object. Relay its `findings` through a single `ReportFindings` call, which is
what renders them; the agent has no such tool of its own.

Dispatch `cape:fact-checker` when:

- The implementation depends on claims about codebase structure, API behavior, or dependencies

## Examples

**Wrong:** The first task reveals the next planned slice is unnecessary, but you create and
implement it anyway because it sounded plausible during planning.

**Right:** Explain the discovery in session, mark the completed task done in the cache, and create
the next sub-issue that reflects current reality.
