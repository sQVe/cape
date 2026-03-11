---
name: beads
description: >
  How to use br (beads) — the CLI issue tracker for epics, tasks, and bugs.
  Use this skill whenever the user mentions br, beads, .beads, or issue tracking.
  Triggers on: creating/updating/closing/querying br issues, br command errors
  (e.g. --design not working on br create), asking what task to work on next,
  tracking findings from code review or test gap analysis as br issues, setting
  up a beads workspace, or building a skill that should output br items.
  Also use when the user says "create a bead", "log this bug", "track this",
  or asks about issue priorities, types, dependencies, or ready/blocked status.
---

<skill_overview>
`br` is a git-backed issue tracker CLI. It stores epics, tasks, and bugs in a `.beads/` directory (SQLite + JSONL) within each repository. This skill is the single reference for how cape skills interact with `br`.

Two roles:
1. **Command reference** — correct syntax, flags, and common mistakes.
2. **Output conventions** — how cape skills should create br items as their output artifacts.
</skill_overview>

<rigidity_level>
HIGH FREEDOM — Adapt commands to context, but always use the correct flags documented here. The gotchas section is rigid: violating it produces silent failures.
</rigidity_level>

<when_to_use>
- Any cape skill needs to create, update, or query br items
- User asks about br commands or beads workflows
- Building a new cape skill that should output tracked work items
- Debugging br command failures (wrong flags, missing workspace)

**Don't use for:**
- Creating epics during brainstorming (use `cape:brainstorm`)
- Advanced operations like splitting/merging tasks (use `hyperpowers:managing-br-tasks`)
</when_to_use>

<workspace_setup>

## Initializing a workspace

```bash
br init
```

Creates a `.beads/` directory in the current repository with:
- `beads.db` — SQLite database
- `issues.jsonl` — JSONL export (git-tracked)
- `config.yaml` — configuration
- `metadata.json` — workspace metadata

Check if a workspace exists before creating issues:

```bash
br where 2>/dev/null || br init
```

## Syncing with git

`br` never runs git commands. After creating or modifying issues, sync manually:

```bash
br sync --flush-only
git add .beads/
git commit -m "sync beads"
```

</workspace_setup>

<command_reference>

## Core concepts

| Concept | Description |
|---------|-------------|
| **Epic** | Immutable design contract — requirements, anti-patterns, success criteria |
| **Task** | Implementation work item, child of an epic |
| **Bug** | Defect report with reproduction steps |
| **Feature** | Feature request or enhancement |
| **Dependency** | Blocking relationship: A depends on B means do B first |
| **Parent-child** | Structural grouping: task belongs to epic |

## Creating issues

```bash
br create "Epic: Feature Name" \
  --type epic \
  --priority 2 \
  --description "Full epic content here"

br create "Task: Specific deliverable" \
  --type task \
  --priority 2 \
  --parent <epic-id> \
  --description "Task details here"

br create "Bug: Description of defect" \
  --type bug \
  --priority 1 \
  --description "## Reproduction steps
1. Do X
2. Observe Y

## Expected behavior
Z

## Actual behavior
W"
```

Quick capture (prints ID only):

```bash
br q Fix flaky test in auth module -t bug -p 2
```

## Reading issues

```bash
br show br-3                  # Full issue details
br list                       # All open issues
br list --status open         # Filter by status
br list -t epic               # Filter by type
br ready                      # Unblocked, not deferred
br search "auth"              # Search by text
br dep tree br-1              # Dependency tree for epic
br epic status                # Progress of all epics
```

## Updating issues

```bash
br update br-3 --status in_progress   # Start work
br update br-3 --design "Updated design notes"
br update br-3 --priority 1           # Change priority
br update br-3 --add-label "security" # Add label
```

## Closing issues

```bash
br close br-3                              # Complete
br close br-3 --reason "Duplicate of br-7" # With reason
br close br-3 --suggest-next               # Show newly unblocked
br reopen br-3                             # Reopen
```

## Managing dependencies

```bash
# br-5 depends on br-3 (do br-3 first)
br dep add br-5 br-3

# br-5 is child of br-1
br dep add br-5 br-1 --type parent-child

# Remove dependency
br dep remove br-5 br-3

# View tree
br dep tree br-1

# Detect cycles
br dep cycles
```

## Common queries

```bash
br list --status in_progress           # What's active
br ready --parent br-1                 # Ready tasks in epic
br list --status open -t bug           # Open bugs
br blocked                             # What's stuck
br stale                               # Neglected issues
br stats                               # Project overview
br count --group-by status             # Count by status
```

</command_reference>

<gotchas>

## Common mistakes

These cause silent failures or wrong behavior. Follow the correct patterns exactly.

### `--description` vs `--design`

`br create` has `--description` but NO `--design` flag.
`br update` has BOTH `--description` and `--design` (different fields).

```bash
# WRONG — --design does not exist on br create
br create "Task" --type task --design "details"

# CORRECT — use --description on br create
br create "Task" --type task --description "details"

# CORRECT — --design works on br update
br update br-3 --design "updated design notes"
```

### Status values use underscores

```bash
# WRONG
br update br-3 --status in-progress
br update br-3 --status done

# CORRECT
br update br-3 --status in_progress
br close br-3
```

Valid status values: `open`, `in_progress`, `blocked`, `closed`

### `br status` vs `br update --status`

```bash
# WRONG — br status shows database overview, not issue status
br status br-3 --status in_progress

# CORRECT — use br update to change status
br update br-3 --status in_progress
```

### Parent linking on create

Use `--parent` on `br create` instead of a separate `br dep add` call:

```bash
# VERBOSE — works but unnecessary
br create "Task" --type task --description "..."
br dep add br-5 br-1 --type parent-child

# SIMPLER — --parent does both at once
br create "Task" --type task --parent br-1 --description "..."
```

### Long descriptions with heredoc

For multi-line descriptions, use heredoc to avoid shell escaping issues:

```bash
br create "Task: Auth endpoints" \
  --type task \
  --parent br-1 \
  --description "$(cat <<'EOF'
## Goal
Implement login and logout endpoints.

## Success criteria
- [ ] POST /api/login validates credentials
- [ ] POST /api/logout invalidates session
- [ ] Tests pass
EOF
)"
```

</gotchas>

<output_conventions>

## How cape skills should output br items

Cape skills that discover actionable findings should create br items, not just print text. This makes findings trackable, prioritizable, and closeable.

### Mapping skill outputs to br types

| Skill | br type | Example title |
|-------|---------|---------------|
| `find-test-gaps` | `task` | "Add missing edge-case tests for parseConfig" |
| `review` | `bug` or `task` | "Bug: XSS in user input rendering" |
| `debug-issue` | `bug` | "Bug: Race condition in session cleanup" |
| `fix-bug` | `bug` | "Bug: Off-by-one in pagination offset" |
| `lint` | `task` | "Fix eslint violations in auth module" |

### Conventions for skill-created issues

1. **Always set `--type`** — use the appropriate type from the table above.
2. **Always set `--priority`** — skills should assess severity:
   - P0: security vulnerability, data loss
   - P1: broken functionality, test failure
   - P2: code quality, missing tests (default for most skill output)
   - P3: style, minor improvements
   - P4: nice-to-have, backlog
3. **Link to parent when context exists** — if working within an epic, use `--parent`.
4. **Include actionable descriptions** — file paths, line numbers, reproduction steps.
5. **Use labels for categorization** — `--labels "test-gap,auth"`.

### Template for skill output

```bash
br create "Type: Concise finding" \
  --type <bug|task|feature> \
  --priority <0-4> \
  --parent <epic-id-if-applicable> \
  --labels "<skill-name>" \
  --description "$(cat <<'EOF'
## Finding
[What was discovered, with file:line references]

## Evidence
[Code snippet, test output, or reproduction steps]

## Suggested fix
[Concrete next step]

## Success criteria
- [ ] [Measurable outcome]
EOF
)"
```

### Batch output

Skills that produce multiple findings (e.g., `find-test-gaps` finding 5 gaps) should:
1. Create one issue per finding — not a single issue with a checklist.
2. Use `br q` for lightweight batch creation when descriptions are short.
3. Summarize at the end: "Created br-10 through br-14 (5 test gap tasks)."

</output_conventions>

<commit_references>

## Referencing br items in commits

Include the br ID in commit messages to link work to tracked issues:

```
feat(br-3): implement login endpoint

Implements step 1 of br-3: Auth API endpoints
```

Format: `type(br-N): description`

</commit_references>

<critical_rules>

1. **Use `--description` on `br create`** — `--design` does not exist on create
2. **Use underscores in status** — `in_progress` not `in-progress`
3. **Use `br close` to complete** — not `--status done`
4. **Check workspace exists** — `br where` before creating issues
5. **Skills create br items** — actionable findings become tracked issues, not just text
6. **One issue per finding** — batch skills create separate issues, not checklists
7. **Always set type and priority** — never leave these as defaults

</critical_rules>
