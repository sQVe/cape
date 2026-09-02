---
name: commit
description: >
  Create atomic git commits with conventional messages and selective staging. Use whenever changes
  need committing. Not for pushing, PRs, or branch operations.
---

# Commit

Stage selectively and commit one logical change at a time in conventional commit format. Read the
diff, group changes by concern, propose staging and a message, and commit only after approval.

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
4. **Stage only through `cape commit <files>`.** Never run `git add`. `cape commit` commits the
   whole index, not just the named files, so anything staged earlier leaks into the commit; unstage
   it first.

## Process

### 1. Gather context

```bash
cape git context
git diff HEAD
```

From `recentLog`, note the project's conventions: which types appear, whether scopes are used,
subject style. If there are no changes, tell the user and stop.

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

Subject: imperative mood, lowercase, no period, under 72 characters. Describe the change, not the
file. Scope: follow the pattern in recent commits; omit if the project doesn't use scopes.

The body is required and explains why, never what; the diff shows the what. Keep it to one short
paragraph of at most three sentences, holding the decision a future reader needs. Diagnosis
narratives and per-file essays go in the PR or ticket. Related fixes committed together get one
short line each, never a semicolon chain.

Staging: exclude files outside this group. Warn about untracked files that look like they belong.

### 4. STOP: confirm

Wait. Apply the user's edits exactly. Skip only with `--no-confirm`.

### 5. Execute

```bash
cape commit src/cache.ts src/config.ts -m "$(cat <<'EOF'
refactor(cache): replace LRU with TTL-based eviction

Why this change, in one to three sentences.
EOF
)"
```

If the commit fails on a pre-commit hook or lint error: analyze the output, auto-fix what you can
(formatting, lint), and retry. After 3 failures, report the issues and ask the user to fix manually.

After success, report the hash and subject in one line, plus any remaining uncommitted changes. If
another group remains, loop back to step 3.
