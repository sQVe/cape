---
name: tracker
user-invocable: false
description: >
  Reference for cape's tracker seam: Linear MCP writes plus local cache refreshes. Use whenever a
  cape skill needs to create, list, update, close, or cache tracker work. Triggers on: issue
  tracking, Linear epic/task/bug workflow, tracker cache, ready work, closing tracked work, and
  rewiring skills that previously used local issue tracking. Do NOT use for implementation planning
  itself; use the chain skill and load this only for tracker protocol details.
---

<skill_overview> Cape uses Linear as the tracker and `hooks/context/tracker.json` as the local read
cache. Skills write to Linear through MCP, then refresh the local cache with `cape tracker`.

Core contract: Linear is the source of truth for writes; cache is the source of truth for reads.
</skill_overview>

<rigidity_level> HIGH FREEDOM -- Operation names and cache-write rules are fixed. Issue titles and
descriptions adapt to the chain using the tracker. </rigidity_level>

<when_to_use>

- A cape skill needs to create an epic, task, or bug issue
- A cape skill needs to list ready work from cache
- A cape skill needs to update status or close work
- A Linear MCP result must be written into `hooks/context/tracker.json`
- A skill needs the tracker cache shape

**Don't use for:**

- Writing implementation code (use the active chain skill)
- Creating detailed expanded plans or validation transcripts
- General Linear administration outside cape's five operations

</when_to_use>

<critical_rules>

1. **Use only five operations** -- createEpic, createTasks, listReady, updateStatus, close
2. **Writes go to Linear first** -- use MCP Linear `save_issue` for create/update/close
3. **Reads come from cache** -- list ready and orientation read `hooks/context/tracker.json`
4. **Refresh cache after every write** -- pipe MCP JSON or status details to `cape tracker`
5. **No network in the CLI** -- `cape tracker` only transforms provided MCP results into cache
6. **Keep fine-grained plans in session** -- do not write expanded plans, divergence logs, or
   close-check records to Linear

</critical_rules>

<the_process>

## Step 1: Understand The Cache

The cache file is `hooks/context/tracker.json`.

```json
{
  "version": 1,
  "timestamp": 1700000000000,
  "epics": {
    "ABU-15": {
      "id": "ABU-15",
      "title": "Cape V2",
      "status": "In Progress",
      "tasks": [
        {
          "id": "ABU-56",
          "title": "Tracker cache CLI",
          "status": "Todo",
          "stateType": "unstarted"
        }
      ]
    }
  }
}
```

The cache stores enough for banners and ready-work routing: IDs, titles, statuses, state types, and
epic-to-task membership. It does not store expanded plans or implementation transcripts.

---

## Agent contract

Apply this agent contract before every issue create or update:

- Dedupe first: search open issues in the target project by title keywords. On a match, comment
  instead of creating a duplicate; the comment states what cape would have created and links the
  match.
- Project: route work to a matching named project. Use `Inbox` when no project matches. Never create
  project-less issues. Confirm a new project with the user before creating it.
- Labels: apply `src:cape` to everything cape creates, plus exactly one `type:*` label on tasks and
  bugs (`type:bug`, `type:feature`, `type:chore`); epics stay untyped parents. Also apply
  `agent-ticket` to every task and bug sub-issue cape creates, never to epics or to human-created
  issues cape only updates: it marks the issue as an agent work ticket whose review surface is the
  PR, not the issue, so humans can filter these out (`-label:agent-ticket`) and review only epics
  and human-created work. These labels are created by the workspace bootstrap — until a given label
  exists, apply it best-effort and skip what is missing. See
  [resources/workspace-setup.md](resources/workspace-setup.md).
- Priority: create issues at `Medium`; use `Urgent` only for detected production breakage. Never use
  `High` — it is reserved for the human-curated `Next` view, and cape-created `High` issues inflate
  it.
- Titles: use an imperative verb-object title in sentence case with no prefix, about 70 characters
  or less. Bug titles start with `Fix <symptom>`.
- Bodies: include a load-bearing `Done when:` line. Use a Mermaid block instead of prose for any
  flow, state, or architecture description longer than about three steps.

---

## Step 2: Create Work

Apply the Agent contract above, then create an epic with MCP Linear `save_issue`. Put the durable
epic contract in the Linear issue description. Then create child task issues with MCP Linear
`save_issue` using the epic as parent.

Before creating user-facing issue descriptions, load the global `stop-slop` skill and run the prose
through it; skip this for pure code or mechanical output.

After creation, refresh cache from the MCP epic result. Preferred:

1. Use MCP Linear `get_issue` for the epic with children included.
2. Cache it:

```bash
cape tracker cache-epic '<linear-epic-json-with-children>'
```

Stdin form is equivalent:

```bash
printf '%s' '<linear-epic-json-with-children>' | cape tracker cache-epic
```

If you have a Linear list result for tasks only, cache it under the epic:

```bash
cape tracker cache-tasks <epic-id> '<linear-task-array-json>'
```

---

## Step 3: List Ready Work

Read `hooks/context/tracker.json`; do not call Linear for ready-work reads.

Ready-task behavior is canonical in `cli/src/services/hooks/state.ts:isReadyTask`; follow that
definition instead of restating statuses here.

If cache is missing or corrupt, treat it as empty. If the user expects work that is not in cache,
refresh cache from an MCP result already obtained in the session before continuing.

---

## Step 4: Update Status

Update Linear first through MCP. Then refresh the matching cached issue:

```bash
cape tracker cache-status <issue-id> "In Progress" started
cape tracker cache-status <issue-id> Done completed
```

If the MCP response includes a full refreshed epic with children, prefer `cache-epic` so task
membership stays current.

---

## Step 5: Close Work

Close a task or bug in Linear through MCP. Then update the cache:

```bash
cape tracker cache-status <issue-id> Done completed
```

Never close the epic yourself: Linear's GitHub integration moves it to `Done` when the PR
(referencing it with `Fixes ABU-XX`) merges. To mirror that status into the cache after a merge, use
`cache-status <epic-id> Done completed`, or `cache-epic` if you have the full epic response with
children.

</the_process>

<examples>

<example>
<scenario>write-plan creates an epic and first task</scenario>

**Wrong:** Create local issue files or write a hand-rolled cache object.

**Right:** Use MCP Linear `save_issue` for the epic and child task, get the full epic JSON, then run
`cape tracker cache-epic '<json>'`. </example>

<example>
<scenario>execute-plan closes a completed task</scenario>

**Wrong:** Mark local cache done before Linear accepts the close.

**Right:** Close the issue in Linear first. After success, run
`cape tracker cache-status <task-id> Done completed`. </example>

</examples>

<key_principles>

- **Linear first, cache second** -- local state mirrors successful MCP writes
- **Cache powers reads** -- banner and ready-work orientation stay fast and offline-safe
- **Small seam** -- cape only needs create, list ready, update status, and close
- **Clean board** -- implementation breakdowns stay in the active session

</key_principles>
