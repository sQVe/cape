---
name: worktree
description: >
  Use whenever the user is deliberately starting or resuming work for an existing epic in its own
  worktree. Triggers on: "start work on ABU-123", "create a worktree for this epic", "set up the
  epic worktree", "/cape:worktree", or being on the default branch before BUILD work. Do NOT use for
  ordinary git branch creation, PR preparation, rebasing, merging, deleting worktrees, or creating
  the epic itself.
---

# Worktree

Start focused work on one existing epic: ensure one grove-managed worktree for it, enter it, and
stamp cape's local `flowPhase` state so the session-start banner resumes the epic context. Grove
owns worktrees; cape only stamps or clears local workflow state.

The sequence is rigid: identify the epic, use grove for the worktree, run `cape worktree start`.
Branch naming and base branch adapt to project conventions.

## Rules

1. **One epic, one worktree.** Never reuse a worktree for a different epic. If the epic's worktree
   already exists, enter it instead of creating another.
2. **Grove owns worktrees.** Use grove commands, not raw `git worktree`.
3. **Stamp after entering.** Run `cape worktree start <epic-id>` inside the worktree before BUILD
   work.
4. **Tracker cache freshness is not required.** Stamping writes only local state. If the cache lacks
   the epic, the banner stays quiet until the next tracker read refreshes it.

## Process

### 1. Identify the epic

Confirm the epic ID from the request, current plan, or tracker context. The epic must already exist
in Linear. If it doesn't, stop and load `cape:write-plan` instead.

Check the repository:

```bash
cape git context
```

Use the detected default branch as the grove base unless the user or repo convention requires
another.

### 2. Derive the branch slug

Read `gitBranchName` from Linear's `get_issue` MCP tool, then sanitize it to ASCII kebab-case:
lowercase, replace characters outside `[a-z0-9-]` with `-`, collapse repeated dashes. For ABU-71
this turns `abu-71-cape-×-herdr-parallel-multi-agent-orchestration` into
`abu-71-cape-herdr-parallel-multi-agent-orchestration`. The slug comes from Linear, so re-running
produces the same name and grove finds the existing worktree instead of creating a duplicate.

### 3. Ensure the grove worktree

Create or enter the per-epic worktree. Omit `--name` so grove derives the directory from the branch:

```bash
grove add --base <default-branch> <type>/<branch-slug>
```

`<type>` is the conventional-commit prefix for the work (`feat`, `fix`, `chore`); keep it consistent
for a given epic. If grove reports the worktree already exists, enter it. Assume the repository is
already inside a grove workspace; on any other grove failure, stop and report it. Never convert the
repo or initialize workspace metadata to recover.

### 4. Stamp cape context

From inside the worktree:

```bash
cape worktree start <epic-id>
```

BUILD is the default; pass `--phase PLAN` or `--phase SHIP` only when the current phase differs. The
command writes `flowPhase { phase, issueId, timestamp }` to a per-worktree state file under
`hooks/context/`. It does not call Linear, grove, or br.

Then label the herdr workspace to match: `cape workspace phase build` (or `plan`). It relabels the
herdr rail and tab and is a safe no-op outside herdr.

### 5. Hand off

Load `cape:execute-plan` for BUILD work, `cape:finish-epic` or `cape:pr` for SHIP. When leaving the
epic context intentionally, clear the stamp:

```bash
cape worktree stop
```

## Skills

Load `cape:execute-plan` when:

- The worktree is stamped and the user wants to continue BUILD work

Load `cape:write-plan` when:

- No epic exists yet for the requested work
