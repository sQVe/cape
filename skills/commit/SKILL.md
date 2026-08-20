---
name: commit
description: >
  Create atomic git commits with conventional messages and selective staging. Use whenever changes
  need committing. Not for pushing, PRs, or branch operations.
---

# Commit

Stage selectively and commit one logical change at a time in conventional commit format. Read the
diff, group changes by concern, propose staging and a message, and commit only after approval.

Message style and body depth adapt to project conventions. The staging plan, the conventional
format, and the approval gate do not.

## Arguments

- `--no-confirm` (optional): skip the confirmation in step 4. For other cape skills that call
  commit.
- `commit-message` (optional): use this message instead of generating one. Still present the staging
  plan unless `--no-confirm` is also passed.

## Rules

1. **Never commit without approval.** Present the staging plan and message, then wait. Only
   `--no-confirm` waives this.
2. **Never skip hooks.** No `--no-verify` unless the user explicitly asks.
3. **One logical change per commit.** Split mixed concerns into separate commits.
4. **Stage files by name.** Never `git add .` or `git add -A`.
5. **Never amend.** Create new commits unless the user asks to amend.

## Process

### 1. Gather context

```bash
cape git context
git diff HEAD
```

From `recentLog`, note the project's conventions: which types appear, whether scopes are used,
subject style, whether bodies are common. If there are no changes, tell the user and stop.

### 2. Group the diff

Split the changes into logical groups, each a set of files serving one concern: a function and its
tests, a config change across files, a rename, a bug fix. Split into separate commits when files are
unrelated, when a fix mixes with a cleanup, or when the groups take different commit types.

One group proceeds alone. Multiple groups each get their own cycle of steps 3 to 5, most
foundational first.

### 3. Propose staging and message

Present the plan:

```
Staging: src/cache.ts, src/config.ts
Message: refactor(cache): replace LRU with TTL-based eviction

LRU eviction caused stale entries to persist when access patterns
were uniform. TTL guarantees freshness regardless of access frequency.
```

Pick the type:

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

Subject: imperative mood, lowercase, no period, under 72 characters. Describe the change, not the
file. Scope: follow the pattern in recent commits; omit if the project doesn't use scopes.

Add a body only when the subject alone doesn't carry the reasoning: a non-obvious design decision,
or implications beyond the diff. The body explains why, never what; the diff shows the what. Run the
body through `cape:unslop` before presenting.

Staging: exclude files outside this group. Warn about untracked files that look like they belong,
and about anything sensitive (`.env`, credentials, secrets).

### 4. STOP: confirm

**Do not call `git commit` until the user approves.**

Wait. If the user edits the message or staging, apply their changes exactly. If they reject, ask
what they'd prefer. Skip this step only when `--no-confirm` was passed.

### 5. Execute

```bash
cape commit src/cache.ts src/config.ts -m "$(cat <<'EOF'
refactor(cache): replace LRU with TTL-based eviction

Body if warranted.
EOF
)"
```

The CLI validates the message format, detects sensitive files, and stages and commits in one
operation.

If the commit fails on a pre-commit hook or lint error: analyze the output, auto-fix what you can
(formatting, lint), and retry. After 3 failures, report the issues and ask the user to fix manually.

After success, show the commit hash, `git status --short`, and any remaining uncommitted changes. If
another group remains, loop back to step 3.

## Examples

**Wrong:** `git add -A` then `chore: various updates` covering a new auth middleware and a readme
typo fix. Two concerns in one blob, and the message says nothing.

**Right:** two commits. First `feat(auth): add authentication middleware` staging `src/auth.ts` and
`tests/auth.test.ts`, then `docs: fix typo in readme` staging `README.md`.
