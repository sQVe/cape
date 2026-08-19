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
two-tier: human-facing tickets live in the Aburaya team; agent-facing plan issues and tasks live in
the Agents team (AI). Skills write to Linear through MCP, then refresh the cache with
`cape tracker`. Linear is the source of truth for issue content; the cache is the source of truth
for reads — and for task status during build.

Operation names, team routing, and cache-write rules are fixed. Issue titles and descriptions adapt
to the chain using the tracker.

## Rules

1. **Use only five operations.** createEpic, createTasks, listReady, updateStatus, close.
2. **Route by audience.** Agent-facing issues (plans, contracts, task sub-issues) go to the team
   `Agents`; human-facing issues go to `Aburaya`. Team routing is a `save_issue` parameter — no
   config layer.
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
carries the pair (human ticket ↔ plan issue) so `cape:pr` can build the closing line from the cache.
A task may carry its own `humanTicketId` when it has a per-ticket pair (for example a bug pair
created under an epic). The cache stores what banners and ready-work routing need: IDs, titles,
statuses, state types, pairing, and plan-to-task membership. It stores no expanded plans or
implementation transcripts.

## Agent contract

Apply before every issue create or update.

- **Team.** Route by audience. Agent-facing issues (plans, contracts, task sub-issues) go to the
  team `Agents` (AI); human-facing issues go to `Aburaya`. Pass the team as a `save_issue`
  parameter.
- **Dedupe first.** Search open issues in the target project by title keywords. On a match, comment
  instead of creating a duplicate; the comment states what cape would have created and links the
  match.
- **Project.** Route work to a matching named project. Use `Inbox` when no project matches. Never
  create project-less issues. Confirm a new project with the user before creating it.
- **Labels.** Apply `src:cape` to everything cape creates, plus exactly one `type:*` label on tasks
  and bugs (`type:bug`, `type:feature`, `type:chore`); human tickets and plan issues stay untyped
  parents. The team boundary marks agent work — the retired `agent-ticket` label is never applied.
  The workspace bootstrap creates these labels; until a given label exists, apply it best-effort and
  skip what is missing. See [resources/workspace-setup.md](resources/workspace-setup.md).
- **Priority.** Create issues at `Medium`; use `Urgent` only for detected production breakage. Never
  use `High`. It is reserved for the human-curated `Next` view, and cape-created `High` issues
  inflate it.
- **Titles.** Use an imperative verb-object title in sentence case with no prefix, about 70
  characters or less. Bug titles start with `Fix <symptom>`.
- **Bodies.** Include a load-bearing `Done when:` line. Use a Mermaid block instead of prose for any
  flow, state, or architecture description longer than about three steps.

## Create work

Apply the agent contract, then create the pair with MCP Linear `save_issue`, using the shapes in
[resources/linear-templates.md](resources/linear-templates.md):

1. Human ticket in `Aburaya`: a concise, scannable description — no agent contract material.
2. Plan issue in `Agents`: the full agent contract (required behavior, constraints, approach,
   acceptance criteria).
3. Link the two bidirectionally: a `relatedTo` relation plus a markdown link to the counterpart in
   each body.
4. Create the first task with `save_issue` as a sub-issue of the AI plan issue.

Pairing rules:

- AI-only exception: work with no user-informational value (internal chores) gets an AI-only issue,
  no human ticket.
- Pairing is per ticket, not per tree: any human ticket, including human sub-issues, can carry its
  own AI pair.

Run user-facing issue descriptions through the `cape:unslop` skill before creating them.

After creation, refresh the cache from the MCP plan-issue result:

1. Use MCP Linear `get_issue` for the plan issue with children included.
2. Stamp the pair into the JSON: add a top-level `"humanTicketId": "<human-ticket-id>"` field (the
   Linear payload does not carry it). Stamp paired child issues the same way inside `children`. The
   cache preserves both across later refreshes that omit them.
3. Cache it:

```bash
cape tracker cache-epic '<linear-plan-issue-json-with-children>'
```

Stdin form is equivalent:

```bash
printf '%s' '<linear-plan-issue-json-with-children>' | cape tracker cache-epic
```

If you have a Linear list result for tasks only, cache it under the plan issue:

```bash
cape tracker cache-tasks <plan-id> '<linear-task-array-json>'
```

## List ready work

Read `hooks/context/tracker.json`; never call Linear for ready-work reads.

Ready-task behavior is canonical in `cli/src/services/hooks/state.ts:isReadyTask`; follow that
definition instead of restating statuses here.

Treat a missing or corrupt cache as empty. If the user expects work that is not in the cache,
refresh it from an MCP result already obtained in the session before continuing.

## Update status

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

## Close work

Never close issues through MCP. Linear catches up when the PR merges, via the PR closing line:

```text
Fixes <human-id>, <plan-id>, <completed task ids>
```

Linear's GitHub integration moves every listed issue to `Done` on merge. To mirror that into the
cache afterwards, run `cape tracker cache-status <issue-id> Done completed` per issue, or
`cache-epic` if you have the full refreshed plan issue with children.

## Examples

**Wrong:** write-plan puts the full agent contract (R-tables, constraints, acceptance criteria) in
the Aburaya ticket, or creates everything in one team.

**Right:** write-plan creates a concise human ticket in `Aburaya` and a plan issue in `Agents`
holding the full contract, links them via `relatedTo` plus a markdown link in each body, creates the
first task as a sub-issue of the plan issue, then runs `cape tracker cache-epic '<json>'`.

**Wrong:** execute-plan writes a task's `Done` status to Linear with MCP `save_issue` mid-build.

**Right:** execute-plan runs `cape tracker cache-status <task-id> Done completed`. The PR closing
line (`Fixes <human-id>, <plan-id>, <completed task ids>`) updates Linear at merge.
