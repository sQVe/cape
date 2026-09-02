---
name: tracker
user-invocable: false
description: >
  Reference for cape's tracker protocol: Linear MCP writes, team routing between human tickets and
  agent plans, and local cache refreshes. Load when a cape skill needs to create, update, close, or
  cache tracker work.
---

# Tracker

Cape uses Linear as the tracker and a per-repository local read cache. Work is two-tier:
human-facing tickets live in the repo's home team (Aburaya for cape); agent-facing plan issues and
tasks live in the workspace's `AI` team. Skills write to Linear through MCP, then refresh the cache
with `cape tracker`.

## Rules

1. **Route by audience.** Agent-facing issues (plans, contracts, task sub-issues) go to the
   workspace's `AI` team; human-facing issues go to the repo's home team, resolved per
   [resources/agent-contract.md](resources/agent-contract.md). Team routing is a `save_issue`
   parameter, with no config layer.
2. **Write content to Linear first.** Use MCP Linear `save_issue` for creates and content updates.
3. **Read from the cache.** Ready-work listing and orientation read `cape tracker show`, never
   Linear. Fetching a chosen issue's full description with MCP `get_issue` is a detail read, not
   orientation, and is allowed.
4. **Linear holds status; the cache copies it.** Create plan issues, tasks, and AI bug issues with
   `state: "Todo"`. When a task starts or finishes, write the state to Linear with `save_issue`,
   then copy it with `cape tracker cache-status`. The human ticket and plan issue close at merge,
   via the PR closing line.
5. **Refresh the cache after every write.** Pipe the MCP result or status details to `cape tracker`.
6. **No network in the CLI.** `cape tracker` only transforms MCP results you provide into cache
   entries.
7. **Keep fine-grained plans in session.** Never write expanded plans, divergence logs, or
   close-check records to Linear.

## Cache shape

Read the cache with `cape tracker show`, which prints it as JSON. The file itself is named after the
repository, so `cape tracker path` prints its location; never hardcode a cache filename.

The `epics` map is keyed by the AI plan issue; its tasks are the plan's sub-issues. `humanTicketId`
carries the pair (human ticket ↔ plan issue) so `cape:pr` can build the closing line from the cache;
a task may carry its own for a per-ticket pair (for example a bug pair created under an epic). The
cache stores what banners and ready-work routing need: IDs, titles, statuses, state types, pairing,
and plan-to-task membership, never expanded plans or implementation transcripts. Ready-task behavior
is canonical in `cli/src/services/hooks/state.ts:isReadyTask`; follow that definition instead of
restating statuses. Treat a missing or corrupt cache as empty and refresh it from an MCP result
already obtained in the session.

## Write to Linear, then refresh the cache

Before any create or update, apply [resources/agent-contract.md](resources/agent-contract.md).

Create paired work with MCP Linear `save_issue`, using the shapes in
[resources/linear-templates.md](resources/linear-templates.md):

1. Human ticket in the repo's home team: a concise, scannable description, no agent contract
   material.
2. Plan issue in `AI`: the full agent contract (required behavior, constraints, approach, acceptance
   criteria), with `state: "Todo"`.
3. Set the plan issue's `parentId` to the human ticket. That parent is the pair. Write no
   `relatedTo` relation and no counterpart link in either body.
4. Create the first task with `save_issue` as a sub-issue of the AI plan issue, with
   `state: "Todo"`.

A plan issue keeps its own team and takes nothing from the parent. Sub-issues may live in any team,
and the API applies none of the UI's inheritance, so `AI` stays `AI` and the parent's project does
not carry over.

Pairing rules:

- AI-only exception: work with no user-informational value (internal chores) gets an AI-only issue,
  no human ticket.
- Pairing is per ticket, not per tree: any human ticket, including human sub-issues, can carry its
  own AI pair.
- Pair at the leaf: a plan issue attaches only to a human ticket with no home-team children. Run
  `list_issues(parentId: <ticket>, team: <home team>)` first; anything it returns means the ticket
  is a container, so stop and ask which child to build against. Leaf counts home-team issues only,
  since the plan and its tasks become the deepest nodes once attached.
- A leaf that later gains children keeps the plan it already has. Never re-parent it, and never
  treat it as a violation on a later read.

After each Linear MCP write, refresh the matching cache slice (`cape tracker --help` documents each
command):

```bash
cape tracker cache-epic '<linear-plan-issue-json-with-children>'
cape tracker cache-tasks <plan-id> '<linear-task-array-json>'
```

`cache-epic` is authoritative: it prunes cached tasks the payload omits unless they already
advanced. Compose the payload, never passing a bare `get_issue` result: take the epic fields from
`get_issue` and fill `children.nodes` from `list_issues(parentId: <plan-id>)`, since `get_issue`
returns no children. `cache-epic` rejects a childless payload for that reason; `--no-tasks` accepts
one when the empty list is the real answer, which covers a plan with no sub-issues and a
`list_issues` that skipped archived ones. To refresh task membership alone, use `cache-tasks` with
the same `list_issues` result; it rejects an empty array for the same reason.

The plan issue needs no stamp: `cache-epic` reads its pair from `parentId`. Task-level pairs still
do. Add `"humanTicketId": "<human-ticket-id>"` to the paired child inside `children`, because a bug
child keeps the plan issue as its parent and so has no parent of its own to derive from. The cache
preserves the stamp across later refreshes that omit it.

## Update status during build

Write the state to Linear first, then copy it into the cache. Starting a task:

```text
save_issue(id: <task-id>, state: "In Progress")
```

```bash
cape tracker cache-status <task-id> "In Progress" started
```

The first start on an epic also moves its parents. Run this once, while `cape tracker show` lists
the plan issue as not started (`Todo`, or `Backlog` for plans created before states were set); the
epic entry's `humanTicketId` is the human ticket, and AI-only work has none:

```text
save_issue(id: <plan-id>, state: "In Progress")
save_issue(id: <human-id>, state: "In Progress")   # the home team's in-progress state name
```

```bash
cape tracker cache-status <plan-id> "In Progress" started
```

A standalone bug with no plan issue skips this block.

Finishing a task:

```text
save_issue(id: <task-id>, state: "Done")
```

```bash
cape tracker cache-status <task-id> Done completed
```

The plan issue and human ticket stay `In Progress` until the PR opens; the GitHub integration takes
them from there.

Reopening: the forward-only merge keeps a completed task completed through every refresh, even when
Linear reopens it. To put a task back in play, write the downgrade to both. `cache-status` bypasses
the ranking:

```text
save_issue(id: <issue-id>, state: "Todo")
```

```bash
cape tracker cache-status <issue-id> Todo unstarted
```

## Close work at PR time

Never close the human ticket or plan issue through MCP. They close when the PR merges, via the PR
closing line:

```text
Fixes <human-id>, <plan-id>
```

Tasks are already `Done` and stay off the line, and so is a standalone bug's AI issue: its line
lists the human ticket alone, or nothing for AI-only work. On merge the integration moves the listed
issues to `Done`; copy that into the cache with
`cape tracker cache-status <plan-id> Done completed`, or `cache-epic` if you have the full refreshed
plan issue with children. The human ticket has no cached status of its own.
