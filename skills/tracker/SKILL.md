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
epic-to-task membership. It stores no expanded plans or implementation transcripts.

## Agent contract

Apply before every issue create or update.

- **Dedupe first.** Search open issues in the target project by title keywords. On a match, comment
  instead of creating a duplicate; the comment states what cape would have created and links the
  match.
- **Project.** Route work to a matching named project. Use `Inbox` when no project matches. Never
  create project-less issues. Confirm a new project with the user before creating it.
- **Labels.** Apply `src:cape` to everything cape creates, plus exactly one `type:*` label on tasks
  and bugs (`type:bug`, `type:feature`, `type:chore`); epics stay untyped parents. Also apply
  `agent-ticket` to every task and bug sub-issue cape creates, never to epics or to human-created
  issues cape only updates. It marks the issue as an agent work ticket reviewed in the PR, not the
  issue, so humans can filter these out (`-label:agent-ticket`) and review only epics and
  human-created work. The workspace bootstrap creates these labels; until a given label exists,
  apply it best-effort and skip what is missing. See
  [resources/workspace-setup.md](resources/workspace-setup.md).
- **Priority.** Create issues at `Medium`; use `Urgent` only for detected production breakage. Never
  use `High`. It is reserved for the human-curated `Next` view, and cape-created `High` issues
  inflate it.
- **Titles.** Use an imperative verb-object title in sentence case with no prefix, about 70
  characters or less. Bug titles start with `Fix <symptom>`.
- **Bodies.** Include a load-bearing `Done when:` line. Use a Mermaid block instead of prose for any
  flow, state, or architecture description longer than about three steps.

## Create work

Apply the agent contract, then create the epic with MCP Linear `save_issue`. Put the durable epic
contract in the Linear issue description. Create child task issues with `save_issue` using the epic
as parent.

Run user-facing issue descriptions through the `cape:unslop` skill before creating them.

After creation, refresh the cache from the epic result:

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

## List ready work

Read `hooks/context/tracker.json`; never call Linear for ready-work reads.

Ready-task behavior is canonical in `cli/src/services/hooks/state.ts:isReadyTask`; follow that
definition instead of restating statuses here.

Treat a missing or corrupt cache as empty. If the user expects work that is not in the cache,
refresh it from an MCP result already obtained in the session before continuing.

## Update status

Update Linear first through MCP. Then refresh the matching cached issue:

```bash
cape tracker cache-status <issue-id> "In Progress" started
cape tracker cache-status <issue-id> Done completed
```

If the MCP response includes a full refreshed epic with children, prefer `cache-epic` so task
membership stays current.

## Close work

Close a task or bug in Linear through MCP. Then update the cache:

```bash
cape tracker cache-status <issue-id> Done completed
```

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
