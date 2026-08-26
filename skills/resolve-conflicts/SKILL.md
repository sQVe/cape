---
name: resolve-conflicts
description: >
  Resolve an in-progress git merge or rebase conflict to completion. Use on "fix conflicts",
  "resolve conflicts", or when a merge or rebase hits conflicts mid-task. Not for starting a merge
  or rebase that has no conflicts.
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
4. **Finish.** Stage the resolved files by name with `git add <file>...`. Then, for a merge,
   `cape commit --no-edit` keeps git's merge message. For a rebase,
   `GIT_EDITOR=true git rebase --continue` keeps the replayed commit's message without opening an
   editor. When the resolution leaves that commit empty, confirm its change already landed on the
   base (`git diff HEAD` is empty and `git log` shows it), then `git rebase --skip`; never skip a
   commit whose change is still missing. Repeat from step 1 for each later conflict until every
   commit is rebased.
5. **Run the project's checks.** Find them in the README or package scripts: typecheck, then tests,
   then format. Run them once the merge or rebase is complete, since a half-applied rebase is not
   buildable history. Fix what the merge broke and commit the fix on its own.
