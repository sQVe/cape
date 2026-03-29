---
name: commit
description: >
  Create atomic git commits with conventional commit format and selective staging. Use whenever the
  user wants to commit changes — explicit requests ("commit this", "make a commit", "let's commit",
  "/cape:commit") and implicit ones ("we're done, save this", "wrap this up"). Also use when another
  cape skill finishes a unit of work and needs to commit. Covers staging decisions, splitting large
  diffs into separate logical commits, and writing thorough commit messages that explain the change.
  Do NOT use for pushing, creating PRs, or branch operations.
---

<skill_overview> Stage selectively and commit one logical change at a time using conventional commit
format. Reads the diff, groups changes by concern, proposes staging and a message, then commits
after approval. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — Adapt message style and body depth to project conventions. The
staging plan, conventional format, and user confirmation before committing are non-negotiable.
</rigidity_level>

<when_to_use>

- User says "commit", "commit this", "let's commit", "wrap this up"
- After completing a unit of work that should be saved
- Another cape skill finishes and needs to persist changes

**Don't use for:**

- Pushing to remote
- Creating pull requests
- Branch operations </when_to_use>

<arguments>

- **--no-confirm** (optional): Skip confirmation (step 4). Useful when other cape skills call
  commit.
- **commit-message** (optional): Use this message instead of generating one. Still present the
  staging plan for review unless `--no-confirm` is also passed.

</arguments>

<critical_rules>

1. **NEVER commit without user approval** — present the staging plan and message first, then wait
   for confirmation. This is the most important rule.
2. **Never skip hooks** — no `--no-verify` unless the user explicitly asks
3. **One logical change per commit** — if the diff has mixed concerns, split
4. **Conventional commit format** — `type(scope): subject` matching project conventions
5. **Never amend without being asked** — always create new commits

</critical_rules>

<the_process>

## Step 1: Gather context

```bash
cape git context
git diff HEAD
```

From `recentLog`, note the project's commit conventions — type prefixes used, whether scope is
common, subject line style, whether bodies are used.

If there are no changes to commit, tell the user and stop.

---

## Step 2: Analyze the diff

Read through all changes and identify **logical groups** — sets of changes that belong to a single
concern. A logical group might be:

- A new function and its tests
- A config change across several files
- A rename or move
- A bug fix touching one or two files

Signs that changes should be **separate commits**:

- Unrelated files changed (e.g., a feature file and an unrelated config tweak)
- Mixed concerns (e.g., a bug fix and a formatting cleanup)
- Different types of work (e.g., `feat` and `chore` mixed together)

If everything belongs to one logical change, proceed to step 3 with a single group. If multiple
groups exist, present them and handle each as a separate commit cycle (steps 3-5), starting with the
most foundational change.

---

## Step 3: Propose staging and message

Present the plan:

```
Staging: path/to/file.ts, path/to/other.ts
Message: type(scope): subject line

Optional body explaining why this change was made,
not what it does (the diff shows the what).
```

**Conventional commit format:**

| Type       | When to use                                |
| ---------- | ------------------------------------------ |
| `feat`     | New functionality                          |
| `fix`      | Bug fix                                    |
| `chore`    | Maintenance, config, dependencies, tooling |
| `refactor` | Restructuring without behavior change      |
| `docs`     | Documentation only                         |
| `test`     | Test-only changes                          |
| `style`    | Formatting, whitespace (no logic change)   |
| `perf`     | Performance improvement                    |

**Subject line rules:**

- Imperative mood, lowercase, no period
- Under 72 characters
- Describe the change, not the file

**Scope** is optional. Use it when the change is clearly scoped to a module, feature, or directory.
Derive scope from the project's recent commits — if the project uses scopes, follow the pattern; if
it doesn't, omit.

**Body** is warranted when:

- The subject alone doesn't explain the reasoning
- There's a non-obvious design decision
- The change has implications beyond the obvious

When writing the body, explain **why** the change was made, not what it does. The diff already shows
the what.

**Staging rules:**

- Stage specific files by name — never `git add .` or `git add -A`
- Exclude files that don't belong to this logical change
- Warn about untracked files that look like they should be included
- Warn about files that look sensitive (`.env`, credentials, secrets)

---

## STOP — Step 4: Confirm

**You MUST stop here and get user approval before committing.**

Wait for user approval. If the user edits the message or staging, apply their changes exactly. If
they reject entirely, ask what they'd prefer. Do not call `git commit` until the user approves.

---

## Step 5: Execute

Stage and commit in one turn:

```bash
git add path/to/file.ts path/to/other.ts
git commit -m "$(cat <<'EOF'
type(scope): subject line

Body if warranted.
EOF
)"
```

If the commit **fails** (pre-commit hook, lint error):

1. Analyze the failure output
2. Auto-fix if possible (formatting, lint issues)
3. Re-stage and re-attempt the commit
4. After 3 failures: report the issues and ask the user to fix manually

After a successful commit, show:

- Commit hash and message summary
- `git status --short` to confirm state
- Remaining uncommitted changes, if any

If there are remaining changes from another logical group, loop back to step 3 for the next commit.

</the_process>

<examples>

<example>
<scenario>Single logical change, no scope needed</scenario>

```
$ git diff HEAD
 - changes to .gitignore and plugin.json

Staging: .gitignore, plugin.json
Message: chore: add gitignore and update plugin config
```

Two files, one concern (project setup), no scope needed. </example>

<example>
<scenario>Mixed concerns requiring split</scenario>

```
$ git diff HEAD
 - new auth middleware (src/auth.ts, tests/auth.test.ts)
 - unrelated typo fix in README.md

Group 1 (commit first):
  Staging: src/auth.ts, tests/auth.test.ts
  Message: feat(auth): add authentication middleware

Group 2:
  Staging: README.md
  Message: docs: fix typo in readme
```

Two unrelated changes split into two commits. </example>

<example>
<scenario>Change that warrants a body</scenario>

```
Staging: src/cache.ts, src/config.ts
Message: refactor(cache): replace LRU with TTL-based eviction

LRU eviction caused stale entries to persist when access patterns
were uniform. TTL guarantees freshness regardless of access frequency.
```

The subject says what changed; the body explains why. </example>

</examples>

<key_principles>

- **One logical change per commit** — split unrelated changes into separate commits
- **Selective staging** — name files explicitly, never bulk-add
- **Explain the why** — subjects describe the change, bodies explain the reasoning
- **Match project style** — read `recentLog` from context and follow existing conventions
- **Confirm before committing** — always present the plan and wait for approval

</key_principles>

<anti_patterns>

After presenting the staging plan and message, NEVER:

- "Let me create/start/begin..."
- "I'll now..."
- "Starting with the first..."
- "Now I will..."

Present findings completely, then immediately proceed to the confirm step (or execute if
`--no-confirm`).

</anti_patterns>
