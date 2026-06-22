---
name: execute-plan
description: >
  Build from a Linear tracker epic, one task at a time. The counterpart to cape:write-plan:
  write-plan creates the epic and first sub-issue, execute-plan implements it. Triggers on:
  "continue", "next task", "resume", "let's go", "work on the plan", a Linear issue ID, or
  transitioning after planning is complete. Uses the local tracker cache for orientation and
  refreshes that cache after every Linear write.
---

<skill_overview> Implement one tracker task, verify it, close it in Linear, create or identify the
next task, refresh the cache, and stop for review.

Core contract: one task per invocation in HITL mode; all fine-grained plans and reflections stay in
session, not on the Linear board. </skill_overview>

<rigidity_level> MEDIUM FREEDOM -- The one-task loop, TDD requirement, verification before close,
and cache refresh after writes are fixed. Implementation tactics adapt to the task.
</rigidity_level>

<when_to_use>

- A tracker epic exists with ready or in-progress tasks
- User wants to implement the next task in a plan
- Resuming planned work after context was cleared

**Don't use for:**

- No epic exists yet (use `cape:brainstorm` then `cape:write-plan`)
- Diagnosing or fixing a defect (use `cape:fix-bug`)
- Requirements still unclear (use `cape:brainstorm`)

</when_to_use>

<critical_rules>

1. **Orient from cache** -- use `hooks/context/tracker.json` and active worktree state for ready
   tasks; do not use network reads for orientation
2. **Mark status through Linear MCP** -- update status in Linear first, then run `cape tracker`
3. **Test before code** -- load `cape:test-driven-development` before production edits
4. **Keep expansion in session** -- no expanded-plan, divergence, close-check, or outcome ceremony
   is written to Linear
5. **Close only after verification** -- tests and task success criteria must pass first
6. **Stop after each task in HITL mode** -- present checkpoint and wait for user input

</critical_rules>

<the_process>

## Step 1: Orient From Tracker Cache

Read `hooks/context/tracker.json`. The cache shape is documented in `cape:tracker`:

```json
{
  "version": 1,
  "timestamp": 0,
  "epics": {
    "ABU-15": {
      "id": "ABU-15",
      "title": "Cape V2",
      "status": "In Progress",
      "tasks": [{ "id": "ABU-56", "title": "Task", "status": "Todo", "stateType": "unstarted" }]
    }
  }
}
```

Pick work in this order:

- In-progress task under the active epic
- Ready task with `stateType` of `unstarted` or a status such as `Todo`
- If no ready tasks remain and success criteria appear met, route to `cape:finish-epic`
- If multiple epics are active, ask the user which one to continue

If the cache is missing, corrupt, or stale for the work the user requested, use `cape:tracker` to
refresh it from the current MCP result available in the session. Do not invent task state.

---

## Step 2: Expand In Session

Load the epic contract and task details from the active session context. If the detailed Linear
description is not present in the session, use the cache to identify the task and ask the user to
provide the current task description or re-run the chain step that created it.

Before coding, build an in-session implementation breakdown:

- Task goal and success criteria
- Relevant epic requirements and anti-patterns
- Files and patterns verified by `cape:codebase-investigator` or manual search
- TDD slices, each with one behavior and one verification command
- Risks, assumptions, and explicit out-of-scope items

Do not persist this expanded breakdown to Linear. If the task is too large, stop and recommend a
split; create split tasks only after the user agrees.

Then update Linear status to in-progress using MCP Linear `save_issue` or the available state-update
operation. Immediately refresh the local cache:

```bash
cape tracker cache-status <task-id> "In Progress" started
```

Signal workflow state:

```bash
cape state set workflowActive
```

Load `cape:test-driven-development` with the Skill tool before production edits.

---

## Step 3: Implement And Verify

Execute the in-session breakdown one slice at a time:

1. Write the smallest failing test for the current behavior.
2. Confirm the failure is for the expected reason.
3. Implement the minimum production change.
4. Re-run the focused test and affected broader suite.
5. Clean up only when it clearly improves the result.
6. Run the slice verification command before moving on.

When obstacles appear, re-read the epic contract from the session. If a requirement or anti-pattern
forces a change of approach, explain the divergence in the conversation and continue only when the
new approach still satisfies the contract. Keep the divergence in session.

Before closing, run the chain's own verification:

- All task success criteria satisfied with evidence
- Relevant tests pass
- `cape check` or the repository's expected verification command passes
- Critical code-review findings are addressed

Dispatch `cape:code-reviewer` for non-trivial changes. Dispatch `cape:fact-checker` when the
implementation depends on claims about codebase structure or APIs.

---

## Step 4: Close Task And Plan Next

Close the task in Linear through MCP. Then update the local cache:

```bash
cape tracker cache-status <task-id> Done completed
cape state clear workflowActive
```

Reflect in session:

- What was built
- What changed from the original assumption
- Whether the epic approach still holds
- What the next smallest vertical slice should be

If a ready task already exists in the cache, checkpoint to it. If a new task is needed, create it as
a Linear sub-issue through MCP. Load `cape:tracker` and apply its Agent contract for create-time
rules, including dedupe, labels, priority, naming, and `Done when:`. Then refresh the epic cache
from an MCP `get_issue` result:

```bash
cape tracker cache-epic '<linear-epic-json-with-children>'
```

If no more work remains, load `cape:finish-epic`.

---

## Step 5: Checkpoint And Stop

Present:

```text
Checkpoint - <task-id> complete

Done: <what changed and what was verified>
Next: <next-id or finish-epic>
Verification: <commands and results>
```

In HITL mode, stop and wait for user input. In AFK mode, load `cape:commit`, then continue only if
the next task is already clear and within the same approved scope.

</the_process>

<agent_references>

## Dispatch `cape:codebase-investigator` when:

- The task references files, APIs, or patterns that need verification
- A failure suggests the original plan misunderstood the codebase

## Dispatch `cape:code-reviewer` when:

- A task changes behavior across modules or public interfaces
- You need an implementation review against the epic contract

## Dispatch `cape:fact-checker` when:

- The plan or outcome depends on claims about codebase structure, API behavior, or dependencies

</agent_references>

<skill_references>

## Load `cape:test-driven-development` with the Skill tool when:

- Step 2 completes and before any production code is written

## Load `cape:tracker` with the Skill tool when:

- You need to create, update, close, list ready work, or refresh the cache

</skill_references>

<examples>

<example>
<scenario>First task reveals the next planned slice is unnecessary</scenario>

**Wrong:** Create and implement the next task anyway because it sounded plausible during planning.

**Right:** Explain the discovery in session, close the completed task in Linear, refresh the cache,
and create the next sub-issue that reflects current reality. </example>

<example>
<scenario>Expanded plan would take more than one implementation cycle</scenario>

**Wrong:** Write a huge expanded plan into the issue description and try to complete it all.

**Right:** Keep the breakdown in session, recommend a split, and wait for user approval before
creating smaller Linear sub-issues. </example>

</examples>

<key_principles>

- **Learn forward** -- each next task is based on what execution revealed
- **Cache follows writes** -- Linear is written first; local cache is refreshed immediately after
- **Session detail stays session-local** -- the board tracks issues, not implementation transcripts
- **Verification replaces ceremony** -- tests and success criteria decide closure

</key_principles>
