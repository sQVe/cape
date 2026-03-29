---
name: branch
description: >
  Use this skill whenever the user wants to CREATE or SET UP a new git branch. This includes any
  request to generate a branch name, start a new branch, check out a fresh branch, or begin work
  that requires branching. Covers explicit requests ("create a branch", "new branch", "branch for
  this") and implicit ones ("set up a branch for X", "start working on X" when no branch exists).
  Also applies to `/cape:branch`. Do NOT use for operations on existing branches: switching,
  deleting, listing, rebasing, merging, pushing, or comparing branches.
---

<skill_overview> Generate a well-formatted git branch name from session context and create it. Pulls
context from active br tasks, conversation history, and user input to build a descriptive branch
name without interrogating the user. </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt naming format to user preferences and project conventions. The
only rigid rule: always confirm the name before creating the branch. </rigidity_level>

<when_to_use>

- User wants to create a new branch for their work
- User says "create a branch", "new branch", "branch for this"
- User says "start working on X" and no branch exists yet
- A br task is in progress and user needs a branch for it

**Don't use for:**

- Switching to an existing branch
- Deleting or managing branches
- Cherry-picking or rebasing </when_to_use>

<the_process>

## Step 1: Gather context

Check git state:

```bash
cape git context
```

If not in a git repo, stop and tell the user. If there are uncommitted changes, warn but don't
block.

Check for active br task context:

```bash
br list --status in_progress 2>/dev/null
```

If a br task is active, use its title and type to inform the branch name. If multiple tasks are
in-progress, prefer the most recently updated one, or ask the user which task the branch is for. If
the user referenced a specific task, look it up. Otherwise, infer from the conversation what the
work is about.

---

## Step 2: Generate branch name

Build the name from two parts: **prefix** and **description**.

**Prefix** — derive from the nature of the work:

| Prefix      | When to use                           |
| ----------- | ------------------------------------- |
| `feat/`     | New features and functionality        |
| `fix/`      | Bug fixes                             |
| `chore/`    | Maintenance, config, dependencies     |
| `refactor/` | Restructuring without behavior change |
| `docs/`     | Documentation changes                 |
| `test/`     | Test-only changes                     |

**Description** — kebab-case, 2-5 words summarizing the work. When a br task provides context,
derive the description from the task title rather than embedding the task ID in the branch name.

Examples:

- `feat/add-branch-skill` (from br task "Skill: branch")
- `fix/resolve-auth-timeout`
- `chore/update-dependencies`

---

## Step 3: Confirm and create

Present the generated name to the user. Once approved (or after applying their edits):

```bash
cape git validate-branch <branch-name>
git checkout -b <branch-name>
```

If validation fails (existing branch, bad ref format, missing prefix), show the errors and ask: fix
the name, pick a different name, or abort.

</the_process>

<examples>

<example>
<scenario>User has an active br task</scenario>

br task `cape-2vo.2` ("Skill: branch") is in_progress.

**Generated:** `feat/add-branch-skill`

Description derived from task title. No task ID in the branch name.

User says "looks good" → `git checkout -b feat/add-branch-skill` </example>

<example>
<scenario>User describes work without a br task</scenario>

User: "Create a branch for fixing the login timeout bug"

**Generated:** `fix/login-timeout`

Prefix inferred from "fixing". Description summarizes the work. </example>

<example>
<scenario>Branch already exists</scenario>

Generated name `feat/add-oauth` already exists.

**Response:** "Branch `feat/add-oauth` already exists. Switch to it, pick a different name, or
abort?" </example>

</examples>

<key_principles>

- **Infer, don't interrogate** — pull context from br tasks, conversation, and git state before
  asking questions
- **Confirm before creating** — always show the name and wait for approval
- **Short names** — 2-5 word descriptions in kebab-case, no redundancy

</key_principles>

<critical_rules>

1. **Verify git repo** — stop if not inside a git working tree
2. **Confirm before creating** — never create a branch without user approval
3. **Check for existing branch** — always check before `git checkout -b`
4. **Warn on uncommitted changes** — don't block, but inform the user

</critical_rules>
