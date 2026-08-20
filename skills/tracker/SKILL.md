---
name: tracker
user-invocable: false
description: >
  Reference for cape's tracker protocol: Linear MCP writes plus local cache refreshes. Use whenever
  a cape skill needs to create, list, update, close, or cache tracker work. Triggers on: issue
  tracking, Linear epic/task/bug workflow, tracker cache, ready work, closing tracked work. Do NOT
  use for implementation planning itself; use the chain skill and load this only for tracker
  protocol details.
---

# Tracker

Cape uses Linear as the tracker and `hooks/context/tracker.json` as the local read cache. Skills
write to Linear through MCP, then refresh the cache with `cape tracker`. Linear is the source of
truth for writes; the cache is the source of truth for reads.

Operation names and cache-write rules are fixed. Issue titles and descriptions adapt to the chain
using the tracker.

## Rules

1. **Use only five operations.** createEpic, createTasks, listReady, updateStatus, close.
2. **Write to Linear first.** Use MCP Linear `save_issue` for create, update, and close.
3. **Read from the cache.** Ready-work listing and orientation read `hooks/context/tracker.json`,
   never Linear. Fetching a chosen issue's full description with MCP `get_issue` is a detail read,
   not orientation, and is allowed.
4. **Refresh the cache after every write.** Pipe the MCP result or status details to `cape tracker`.
5. **No network in the CLI.** `cape tracker` only transforms MCP results you provide into cache
   entries.
6. **Keep fine-grained plans in session.** Never write expanded plans, divergence logs, or
   close-check records to Linear.

## Cache shape

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

The cache stores what banners and ready-work routing need: IDs, titles, statuses, state types, and
epic-to-task membership. It stores no expanded plans or implementation transcripts. Ready-task
behavior is canonical in `cli/src/services/hooks/state.ts:isReadyTask`; follow that definition
instead of restating statuses. Treat a missing or corrupt cache as empty and refresh it from an MCP
result already obtained in the session.

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

Never close the epic yourself. Linear's GitHub integration moves it to `Done` when the PR
(referencing it with `Fixes ABU-XX`) merges. To mirror that status into the cache after a merge, run
`cape tracker cache-status <epic-id> Done completed`, or `cache-epic` if you have the full epic
response with children.

## Examples

**Wrong:** write-plan creates local issue files or hand-rolls a cache object.

**Right:** write-plan uses MCP Linear `save_issue` for the epic and child task, gets the full epic
JSON, then runs `cape tracker cache-epic '<json>'`.

**Wrong:** execute-plan marks the local cache done before Linear accepts the close.

**Right:** execute-plan closes the issue in Linear first, then runs
`cape tracker cache-status <task-id> Done completed`.
