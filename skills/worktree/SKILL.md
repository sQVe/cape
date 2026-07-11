---
name: worktree
description: >
  Use this skill whenever the user is deliberately starting or resuming work for an existing epic in
  its own worktree. This includes explicit requests like "start work on ABU-123", "create a worktree
  for this epic", "set up the epic worktree", "/cape:worktree", or being on the default branch
  before BUILD work. Do NOT use for ordinary git branch creation, PR preparation, rebasing, merging,
  deleting worktrees, or creating the epic itself.
---

<skill_overview> Start focused work on one existing epic by ensuring there is one grove-managed
worktree for that epic, entering it, and stamping cape's local `flowPhase` state so the
session-start banner can resume the epic context. The guarantee: grove owns worktrees; cape only
stamps or clears local workflow context. </skill_overview>

<rigidity_level> LOW FREEDOM -- The sequence is rigid: identify an existing epic, use grove for the
per-epic worktree, then run `cape worktree start`; branch naming and base branch adapt to project
conventions. </rigidity_level>

<when_to_use>

- User wants to start BUILD work for an existing epic
- User asks to create or enter an epic worktree
- User invokes `/cape:worktree`
- A hook warns that work is about to start from the default branch

**Don't use for:**

- Creating the epic or tasks; use `cape:write-plan`
- Ordinary git branch management unrelated to an epic
- PR preparation; use `cape:pr`
- Removing or pruning worktrees unless the user explicitly asks for grove cleanup

</when_to_use>

<critical_rules>

1. **One epic, one worktree** -- never reuse a worktree for a different epic
2. **Grove owns worktrees** -- use grove commands; do not use raw `git worktree` as the primary path
3. **Stamp after entering** -- run `cape worktree start <epic-id>` inside the epic worktree before
   BUILD work
4. **Do not require tracker cache freshness** -- stamping writes only local `flowPhase`; if the
   tracker cache lacks the epic, the banner appears after tracker data is refreshed

</critical_rules>

<the_process>

## Step 1: Identify the epic

Confirm the epic ID from the user's request, current plan, or tracker context. The epic must already
exist in Linear and be represented in cape's tracker cache from the planning flow. If no epic
exists, stop and route to `cape:write-plan` instead of creating a worktree.

Check current repository context:

```bash
cape git context
```

Use the detected default branch as the grove base unless the user or repository convention clearly
requires a different base.

---

## Step 2: Derive the branch slug

Fetch the epic's canonical branch name from Linear so the worktree is descriptive and deterministic
rather than an invented summary. Read `gitBranchName` from the `get_issue` MCP tool, then sanitize
it to ASCII kebab-case: lowercase, replace any character outside `[a-z0-9-]` with `-`, and collapse
repeated dashes. For ABU-71 this turns `abu-71-cape-×-herdr-parallel-multi-agent-orchestration` into
`abu-71-cape-herdr-parallel-multi-agent-orchestration`.

---

## Step 3: Ensure the grove worktree

Use grove to create or enter the per-epic worktree. Assume the repository is already inside a grove
workspace; do not convert the cape repo or initialize unrelated workspace metadata.

Recommended shape (omit `--name` so grove derives the directory from the branch):

```bash
grove add --base <default-branch> <type>/<branch-slug>
```

Use the default branch detected in Step 1 as the base. `<type>` is the conventional-commit prefix
for the work (`feat`, `fix`, `chore`, ...); keep it consistent for a given epic. This yields a
branch like `feat/abu-71-cape-herdr-parallel-multi-agent-orchestration` and a matching worktree
directory `feat-abu-71-cape-herdr-parallel-multi-agent-orchestration`. The slug derives from Linear,
so it is stable per epic: re-running with the same `<type>` produces the same name and grove finds
the existing worktree instead of creating a duplicate.

If grove reports that the worktree already exists, enter or switch to it instead of creating another
one. Keep exactly one worktree per epic.

---

## Step 4: Stamp cape context

From inside the epic worktree, stamp the focused epic:

```bash
cape worktree start <epic-id>
```

Then label the herdr workspace to match the phase: `cape workspace phase build` (or
`cape workspace phase plan` for a PLAN worktree). It relabels the herdr rail and tab and is a safe
no-op outside herdr.

Use `--phase PLAN`, `--phase BUILD`, or `--phase SHIP` only when the current phase is not BUILD. The
command writes `flowPhase { phase, issueId, timestamp }` to a per-worktree state file,
`hooks/context/state-<sha256(git-dir)>.json` (non-git callers fall back to
`hooks/context/state-no-repo.json`). It does not call Linear, grove, or br. If the local tracker
cache does not contain the epic yet, the session banner stays quiet until a tracker read refreshes
the cache.

---

## Step 5: Start focused work

Once the worktree exists and the epic is stamped, continue with the correct workflow phase. For
BUILD work, load `cape:execute-plan`. For SHIP work, load `cape:finish-epic` or `cape:pr` as
appropriate.

When stopping or leaving an epic context intentionally, clear the stamp:

```bash
cape worktree stop
```

</the_process>

<skill_references>

## Load `cape:execute-plan` with the Skill tool when:

- The epic worktree is stamped and the user wants to continue BUILD work
- The next ready task should be implemented

## Load `cape:write-plan` with the Skill tool when:

- No existing epic ID is available
- The requested work is still an unplanned feature or design

</skill_references>

<examples>

<example>
<scenario>User is on `main` and says "start ABU-50".</scenario>

**Wrong:** Create a raw git branch and start editing without local workflow state.

**Right:** Confirm ABU-50 is the epic, run grove to create or enter the ABU-50 worktree, run
`cape worktree start ABU-50`, then load `cape:execute-plan`. </example>

<example>
<scenario>The ABU-50 grove worktree already exists.</scenario>

**Wrong:** Create another worktree for ABU-50 with a different name.

**Right:** Enter the existing ABU-50 worktree and rerun `cape worktree start ABU-50` to refresh the
local stamp for the current session. </example>

</examples>

<key_principles>

- **Focused context** -- the current worktree has exactly one active epic stamp
- **External ownership** -- grove creates and manages worktrees; cape records workflow context
- **Offline banner** -- the banner reads local state plus tracker cache and never depends on network

</key_principles>
