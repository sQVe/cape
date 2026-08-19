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

## The cache

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
epic-to-task membership. Ready-task behavior is canonical in
`cli/src/services/hooks/state.ts:isReadyTask`. If cache is missing or corrupt, treat it as empty and
refresh from an MCP result already obtained in the session.

---

## Write to Linear, then refresh the cache

Before any create or update, apply [resources/agent-contract.md](resources/agent-contract.md). Run
user-facing issue descriptions through the `cape:unslop` skill before creating them.

After each Linear MCP write, refresh the matching cache slice (`cape tracker --help` documents each
command):

```bash
cape tracker cache-epic '<linear-epic-json-with-children>'
cape tracker cache-tasks <epic-id> '<linear-task-array-json>'
cape tracker cache-status <issue-id> "In Progress" started
```

Prefer `cache-epic` with a full children-included `get_issue` result so task membership stays
current.

Never close the epic yourself: Linear's GitHub integration moves it to `Done` when the PR
(referencing it with `Fixes ABU-XX`) merges. Mirror that into the cache afterward with
`cache-status <epic-id> Done completed`.

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
