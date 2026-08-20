---
description: Review the current branch with the cape:code-reviewer agent
---

Dispatch the `cape:code-reviewer` agent over the branch diff, then relay what it returns.

Scope is `$ARGUMENTS` when given, either a git range, a PR number, or paths to confine the review
to. Default to `git diff main...HEAD`, plus `git diff HEAD` when the working tree is dirty, since a
review often runs before the commit.

Give the agent three things beyond the diff, because a review without them degrades into generic
quality notes:

- **The contract.** What this change is supposed to do, and what would count as a violation. Pull it
  from the AI plan issue when the tracker cache names one, otherwise from the branch's commits and
  the user's own description.
- **What has already been reviewed.** List findings that earlier passes fixed, so the agent verifies
  those hold instead of re-reporting them.
- **Where to look hardest.** Name the code most likely to be wrong: whatever the branch changed
  last, anything that has already been fixed more than once, and any invariant the change depends
  on.

The agent returns one JSON object. Relay its `findings` through a single `ReportFindings` call,
which is what renders them; a dispatched agent has no such tool of its own. Report `status` and the
`dropped` count in a line of your own.

Then work the findings. Fix what is real, and for anything dismissed, say why against the code. When
findings get fixed later in the same session, call `ReportFindings` again with the same findings,
each carrying an `outcome`.
