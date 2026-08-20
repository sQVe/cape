---
name: tracker
user-invocable: false
description: >
  Reference for cape's tracker protocol: Linear MCP writes plus local cache refreshes. Use whenever
  a cape skill needs to create, list, update, close, or cache tracker work. Triggers on: issue
  tracking, Linear ticket/plan/task/bug workflow, team routing between human and agent issues,
  tracker cache, ready work, closing tracked work. Do NOT use for implementation planning itself;
  use the chain skill and load this only for tracker protocol details.
---

# Tracker

Cape uses Linear as the tracker and `hooks/context/tracker.json` as the local read cache. Work is
two-tier: human-facing tickets live in the repo's home team (Aburaya for cape); agent-facing plan
issues and tasks live in the workspace's `AI` team. Skills write to Linear through MCP, then refresh
the cache with `cape tracker`. Linear is the source of truth for issue content; the cache is the
source of truth for reads — and for task status during build.

Operation names, team routing, and cache-write rules are fixed. Issue titles and descriptions adapt
to the chain using the tracker.

## Rules

1. **Use only five operations.** createEpic, createTasks, listReady, updateStatus, close.
2. **Route by audience.** Agent-facing issues (plans, contracts, task sub-issues) go to the
   workspace's `AI` team; human-facing issues go to the repo's home team, resolved per
   [resources/agent-contract.md](resources/agent-contract.md). Team routing is a `save_issue`
   parameter — no config layer.
3. **Write content to Linear first.** Use MCP Linear `save_issue` for creates and content updates.
4. **Read from the cache.** Ready-work listing and orientation read `hooks/context/tracker.json`,
   never Linear. Fetching a chosen issue's full description with MCP `get_issue` is a detail read,
   not orientation, and is allowed.
5. **Build-time status is cache-only.** Track task status with `cape tracker cache-status` during
   build; no MCP `save_issue` status writes mid-build. The PR closing line catches Linear up at
   merge.
6. **Refresh the cache after every write.** Pipe the MCP result or status details to `cape tracker`.
7. **No network in the CLI.** `cape tracker` only transforms MCP results you provide into cache
   entries.
8. **Keep fine-grained plans in session.** Never write expanded plans, divergence logs, or
   close-check records to Linear.

## Cache shape

The cache file is `hooks/context/tracker.json`.

```json
{
  "version": 1,
  "timestamp": 1700000000000,
  "epics": {
    "AI-15": {
      "id": "AI-15",
      "title": "Cape V2",
      "status": "In Progress",
      "humanTicketId": "ABU-14",
      "tasks": [
        {
          "id": "AI-56",
          "title": "Tracker cache CLI",
          "status": "Todo",
          "stateType": "unstarted"
        }
      ]
    }
  }
}
```

The `epics` map is keyed by the AI plan issue; its tasks are the plan's sub-issues. `humanTicketId`
carries the pair (human ticket ↔ plan issue) so `cape:pr` can build the closing line from the cache;
a task may carry its own for a per-ticket pair (for example a bug pair created under an epic). The
cache stores what banners and ready-work routing need: IDs, titles, statuses, state types, pairing,
and plan-to-task membership — no expanded plans or implementation transcripts. Ready-task behavior
is canonical in `cli/src/services/hooks/state.ts:isReadyTask`; follow that definition instead of
restating statuses. Treat a missing or corrupt cache as empty and refresh it from an MCP result
already obtained in the session.

## Write to Linear, then refresh the cache

Before any create or update, apply [resources/agent-contract.md](resources/agent-contract.md). Run
user-facing issue descriptions through the `cape:unslop` skill before creating them.

Create paired work with MCP Linear `save_issue`, using the shapes in
[resources/linear-templates.md](resources/linear-templates.md):

1. Human ticket in the repo's home team: a concise, scannable description — no agent contract
   material.
2. Plan issue in `AI`: the full agent contract (required behavior, constraints, approach, acceptance
   criteria).
3. Link the two bidirectionally: a `relatedTo` relation plus a markdown link to the counterpart in
   each body.
4. Create the first task with `save_issue` as a sub-issue of the AI plan issue.

Pairing rules:

- AI-only exception: work with no user-informational value (internal chores) gets an AI-only issue,
  no human ticket.
- Pairing is per ticket, not per tree: any human ticket, including human sub-issues, can carry its
  own AI pair.

After each Linear MCP write, refresh the matching cache slice (`cape tracker --help` documents each
command):

```bash
cape tracker cache-epic '<linear-plan-issue-json-with-children>'
cape tracker cache-tasks <plan-id> '<linear-task-array-json>'
```

Prefer `cache-epic` with a full children-included `get_issue` result so task membership stays
current. Stamp the pair into the JSON before caching: add a top-level
`"humanTicketId": "<human-ticket-id>"` field (the Linear payload does not carry it), and stamp
paired child issues the same way inside `children`. The cache preserves both across later refreshes
that omit them.

## Update status during build

Task status is cache-only during build. Update the cache directly; do not write status to Linear
with MCP `save_issue` mid-build:

```bash
cape tracker cache-status <issue-id> "In Progress" started
cape tracker cache-status <issue-id> Done completed
```

Content updates (bodies, titles, new sub-issues) still go to Linear first; only status stays local
until PR time.

Reopening: the forward-only merge keeps a completed task completed through every refresh, even when
Linear reopens it. To put a task back in play, write the downgrade explicitly — `cache-status`
bypasses the ranking:

```bash
cape tracker cache-status <issue-id> Todo unstarted
```

## Close work at PR time

Never close issues through MCP. Linear catches up when the PR merges, via the PR closing line:

```text
Fixes <human-id>, <plan-id>, <completed task ids>
```

Linear's GitHub integration moves every listed issue to `Done` on merge. To mirror that into the
cache afterwards, run `cape tracker cache-status <issue-id> Done completed` per issue, or
`cache-epic` if you have the full refreshed plan issue with children.

## Examples

**Wrong:** write-plan puts the full agent contract (R-tables, constraints, acceptance criteria) in
the human ticket, or creates everything in one team.

**Right:** write-plan creates a concise human ticket in the repo's home team (`Aburaya` in cape) and
a plan issue in `AI` holding the full contract, links them via `relatedTo` plus a markdown link in
each body, creates the first task as a sub-issue of the plan issue, then runs
`cape tracker cache-epic '<json>'`.

**Wrong:** execute-plan writes a task's `Done` status to Linear with MCP `save_issue` mid-build.

**Right:** execute-plan runs `cape tracker cache-status <task-id> Done completed`. The PR closing
line (`Fixes <human-id>, <plan-id>, <completed task ids>`) updates Linear at merge.
