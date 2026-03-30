---
name: beads
user-invocable: false
description: >
  How to use br (beads) — the CLI issue tracker for epics, tasks, and bugs. Use this skill whenever
  the user mentions br, beads, .beads, or issue tracking. Triggers on:
  creating/updating/closing/querying br issues, br command errors (e.g. --design not working on br
  create), asking what task to work on next, tracking findings from code review or test gap analysis
  as br issues, setting up a beads workspace, or building a skill that should output br items. Also
  use when the user says "create a bead", "log this bug", "track this", or asks about issue
  priorities, types, dependencies, or ready/blocked status. Also triggers when the conversation
  contains strings that look like bead IDs — the pattern is `<prefix>-<hash>[.<number>]` where
  prefix is a workspace name (e.g. cape, nit.nvim, br), hash is 3-8 alphanumeric characters, and an
  optional dot-number suffix for subtasks. Examples: cape-2vo, cape-2vo.13, nit.nvim-7f5, br-3. If
  you see an identifier matching this pattern, it is likely a bead ID — use this skill to look it up
  with `br show`.
---

<skill_overview> `br` is a git-backed issue tracker CLI. It stores epics, tasks, and bugs in a
`.beads/` directory (SQLite + JSONL) within each repository. This skill is the single reference for
how cape skills interact with `br`.

Two roles:

1. **Command reference** — correct syntax, flags, and common mistakes.
2. **Output conventions** — how cape skills should create br items as their output artifacts.
   </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt commands to context, but always use the correct flags
documented here. The critical rules are rigid: violating them produces silent failures.
</rigidity_level>

<when_to_use>

- Any cape skill needs to create, update, or query br items
- User asks about br commands or beads workflows
- Building a new cape skill that should output tracked work items
- Debugging br command failures (wrong flags, missing workspace)

**Don't use for:**

- Creating epics from designs (use `cape:write-plan`)
- Advanced operations like splitting/merging tasks </when_to_use>

<the_process>

## Step 1: Ensure workspace

Check if a workspace exists before creating issues:

```bash
br where 2>/dev/null || br init
```

`br init` creates a `.beads/` directory with:

- `beads.db` — SQLite database
- `issues.jsonl` — JSONL export (git-tracked)
- `config.yaml` — configuration
- `metadata.json` — workspace metadata

`br` never runs git commands. After creating or modifying issues, sync manually:

```bash
br sync --flush-only
git add .beads/
git commit -m "sync beads"
```

---

## Step 2: Work with issues

### Core concepts

| Concept          | Description                                                               |
| ---------------- | ------------------------------------------------------------------------- |
| **Epic**         | Immutable design contract — requirements, anti-patterns, success criteria |
| **Task**         | Implementation work item, child of an epic                                |
| **Bug**          | Defect report with reproduction steps                                     |
| **Feature**      | Feature request or enhancement                                            |
| **Dependency**   | Blocking relationship: A depends on B means do B first                    |
| **Parent-child** | Structural grouping: task belongs to epic                                 |

### Recognizing bead IDs

Bead IDs follow the pattern `<prefix>-<hash>[.<subtask>]`:

- **Prefix** — the workspace name configured via `issue_prefix` (e.g. `cape`, `nit.nvim`, `br`)
- **Hash** — 3-8 base62 characters (letters and digits, e.g. `2vo`, `my4`, `7f5`)
- **Subtask** — optional dot-separated number for child tasks (e.g. `.13`, `.1`)

Examples: `cape-2vo`, `cape-2vo.13`, `nit.nvim-7f5`, `br-3`, `cape-my4.1`.

When you encounter a string matching this pattern, use context to decide whether it's a bead ID or a
common hyphenated name (like `node-v18`, `react-dom`, `my-app`). Strong signals it's a bead: the
prefix matches a known workspace name, the conversation involves issue tracking, or the hash looks
random rather than meaningful. When uncertain, run `br show <id>` — if it resolves, it's a bead.

### Creating issues

```bash
br create "Epic: Feature Name" \
  --type epic \
  --priority 2 \
  --description "Full epic content here"

br create "Task: Specific deliverable" \
  --type task \
  --priority 2 \
  --parent <epic-id> \
  --labels "refactor,auth" \
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
br q Fix flaky test in auth module -t bug -p 2 -l test-gap
```

Use `--parent` on `br create` instead of a separate `br dep add` call:

```bash
br create "Task" --type task --parent br-1 --description "..."
```

For multi-line descriptions, use heredoc to avoid shell escaping:

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

### Reading issues

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

### Updating issues

```bash
br update br-3 --status in_progress   # Start work
cat <<'EOF' | cape br design br-3 "Design heading"
Updated design notes
EOF
br update br-3 --priority 1           # Change priority
br update br-3 --add-label "security"    # Add label
br update br-3 --remove-label "security" # Remove label
br update br-3 --set-labels "auth,api"   # Replace all labels
```

### Closing issues

```bash
br close br-3                              # Complete
br close br-3 --reason "Duplicate of br-7" # With reason
br close br-3 --suggest-next               # Show newly unblocked
br reopen br-3                             # Reopen
```

### Managing dependencies

```bash
br dep add br-5 br-3                    # br-5 depends on br-3 (do br-3 first)
br dep add br-5 br-1 --type parent-child # br-5 is child of br-1
br dep remove br-5 br-3                 # Remove dependency
br dep tree br-1                        # View tree
br dep cycles                           # Detect cycles
```

### Managing labels

```bash
br label add br-3 br-5 -l security    # Add label to multiple issues
br label remove br-3 -l security      # Remove label from issue
br label list br-3                     # Labels on a specific issue
br label list-all                      # All labels with counts
br label rename "test-gaps" "test-gap" # Rename across all issues
```

### Common queries

```bash
br list --status in_progress           # What's active
br ready --parent br-1                 # Ready tasks in epic
br list --status open -t bug           # Open bugs
br list -l security                    # Filter by label (AND, repeatable)
br list --label-any security --label-any auth  # OR filtering
br search "auth" -l pr-review          # Combine text + label search
br blocked                             # What's stuck
br stale                               # Neglected issues
br stats                               # Project overview
br count --group-by status             # Count by status
```

---

## Step 3: Preserve task history

When updating a task's design field, preserve existing content and append new content. Never
overwrite.

### Appending to design fields

Use `cape br design <id> <heading>` with content on stdin. It reads existing content and appends
atomically. This applies to tasks only — epics keep immutable requirements per existing convention.

### Frozen sections

Once created, these sections are immutable:

- **Goal** — what the task delivers
- **Implementation** — how it gets built
- **Success criteria** — measurable outcomes

New content goes only in the Divergence log and Outcome sections below.

### Divergence log

When execution diverges from the original plan, append a dated entry. Trigger moments: approach
changes, task abandoned or descoped, assumption proves wrong, unexpected discovery changes design.

```markdown
## Divergence log

### YYYY-MM-DD: [Short description]

**What changed:** [What diverged from original plan] **Why:** [Why the original approach was wrong]
**New approach:** [What we're doing instead]
```

### Outcome

Before closing a task with `br close`, append a summary of what actually shipped:

```markdown
## Outcome

[1-3 sentences: what actually shipped, how it differs from the original plan]
```

---

## Step 4: Output from skills

Cape skills that discover actionable findings should create br items, not just print text. This
makes findings trackable, prioritizable, and closeable.

### Mapping skill outputs to br types

| Skill            | br type         | Example title                                 |
| ---------------- | --------------- | --------------------------------------------- |
| `find-test-gaps` | `task`          | "Add missing edge-case tests for parseConfig" |
| `review`         | `bug` or `task` | "Bug: XSS in user input rendering"            |
| `debug-issue`    | `bug`           | "Bug: Race condition in session cleanup"      |
| `fix-bug`        | `bug`           | "Bug: Off-by-one in pagination offset"        |

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
5. **Use labels for categorization** — `--labels "test-gap,auth"`. Lowercase, hyphenated. Always
   include the skill name as a label. Common categories: `test-gap`, `pr-review`, `security`,
   `refactor`, `debt`.
6. **Validate after creation** — run `cape br validate <id>` after every `br create` to catch
   missing required sections.
7. **Use `cape br template --type <type>`** to get the required section skeleton for a given issue
   type when constructing descriptions.

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

</the_process>

<examples>

<example>
<scenario>Creating an issue with --design instead of --description</scenario>

**Wrong:** `br create "Task" --type task --design "details"` — `--design` does not exist on
`br create`. The flag is silently ignored and the issue has no description.

**Right:** `br create "Task" --type task --description "details"` — use `--description` on create.
`--design` only works on `br update`. </example>

<example>
<scenario>Setting status with wrong values</scenario>

**Wrong:** `br update br-3 --status in-progress` or `--status done` — hyphenated status and "done"
are not valid values.

**Right:** `br update br-3 --status in_progress` (underscore) or `br close br-3` (not
`--status done`). Valid values: `open`, `in_progress`, `blocked`, `closed`. </example>

<example>
<scenario>Using br status to change an issue's status</scenario>

**Wrong:** `br status br-3 --status in_progress` — `br status` shows a database overview, not
individual issue status.

**Right:** `br update br-3 --status in_progress` — use `br update` to change issue status.
</example>

<example>
<scenario>Updating task design after approach changes</scenario>

**Wrong:** `br update br-3 --design "New approach: use Redis instead"` — overwrites the original
plan. No record of what was tried or why it changed.

**Right:** Append a divergence entry atomically:
`echo '### 2026-03-11: Switched to Redis\n**What changed:** ...' | cape br design br-3 "Divergence log"`.
Original Goal and Implementation sections preserved. </example>

</examples>

<key_principles>

- **Skills create br items** — actionable findings become tracked issues, not just conversation text
- **One issue per finding** — batch skills create separate issues, not checklists
- **Always set type and priority** — never leave these as defaults; skills should assess severity
- **Include skill name as label** — every skill-created issue includes the skill name for
  traceability

</key_principles>

<critical_rules>

1. **Use `--description` on `br create`** — `--design` does not exist on create
2. **Use underscores in status** — `in_progress` not `in-progress`
3. **Use `br close` to complete** — not `--status done`
4. **Check workspace exists** — `br where` before creating issues
5. **Skills create br items** — actionable findings become tracked issues, not just text
6. **One issue per finding** — batch skills create separate issues, not checklists
7. **Always set type and priority** — never leave these as defaults
8. **Append to design fields** — use `cape br design <id> <heading>` with content on stdin

</critical_rules>
