---
name: resolve-conflicts
description: >
  Resolve an in-progress git merge or rebase conflict to completion. Use on "fix conflicts",
  "resolve conflicts", a rebase request, or when a merge or rebase hits conflicts mid-task. Not for
  starting a merge that has no conflicts.
---

# Resolve conflicts

Finish the merge or rebase with both sides' intent intact. Never abort.

## Process

1. **See the current state.** Read the git history of both sides and list the conflicting files.
2. **Find the primary sources.** For each conflict, read the commit messages, the PRs, and the
   original issues. Know why each side changed before touching a hunk.
3. **Resolve each hunk.** Keep both intents where they fit together. Where they cannot, pick the one
   that matches the merge's stated goal and note the trade-off. Never invent behavior. Never
   `--abort`.
4. **Run the project's checks.** Find them in the README or package scripts: typecheck, then tests,
   then format. Fix what the merge broke.
5. **Finish.** Stage everything and commit. For a rebase, `git rebase --continue` until every commit
   is rebased.
