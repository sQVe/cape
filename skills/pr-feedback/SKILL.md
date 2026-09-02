---
name: pr-feedback
argument-hint: '[pr number or url]'
description: >
  Act on inbound PR review comments: judge validity, fix what's accepted, reply, resolve threads,
  commit. Use whenever the user wants review feedback handled. Not for creating a PR (cape:pr).
---

# PR feedback

Every fetched review comment ends in a tracked state: applied with a pushed code change, or
dismissed with a stated reason. A thread is resolved only after its action lands, using the node ID
recovered once from the `reviewThreads` query and carried per comment.

## Arguments

- PR number or URL (optional): the PR to act on. Without it, resolve the current branch's PR.

## Rules

1. **Never change code before triage approval.** Present the table, wait for the user, apply their
   edits to it exactly, then fix.
2. **Thread IDs come only from `reviewThreads`.** The REST comments endpoint never exposes thread
   node IDs (`PRRT_…`). Recover them once with the GraphQL query and carry each comment's thread ID
   from that fetch. Never hand-paste or re-look-up IDs; that manual correlation is the failure mode
   this skill exists to remove.
3. **Fetch live threads with `gh`.** Never act on remembered or summarized comments.
4. **Judge validity against the code, not the reviewer.** Each comment is valid, invalid, or out of
   scope with a `file:line` rationale.
5. **Edit nits directly.** A rename, typo, comment, null guard, import, or formatting fix is a
   direct edit. Load `cape:test-driven-development` only for a behavioral change worth a test, and
   `cape:fix-bug` only for a diagnosed defect. Never wrap a one-line nit in TDD ceremony.
6. **Resolve only what landed.** A thread resolves after its fix is pushed or its dismissal reply is
   posted, never silently or on an unpushed change. Skip threads already `isResolved`. A review
   summary body has no thread node ID; reply with a top-level PR comment at most, never resolve it.

## Process

### 1. Fetch threads and review summaries

If the user gave a number or URL, use it. Otherwise resolve the current branch's PR:

```bash
gh repo view --json owner,name
gh pr status --json number,headRefName,url
```

A review lives in two places. Inline thread comments are in `reviewThreads`. The top-level summary
body, the message a reviewer types when hitting Approve, Request changes, or Comment, is in
`reviews.nodes.body`. Fetch both in one call, or the summary is silently dropped:

```bash
gh api graphql -F owner=<owner> -F repo=<repo> -F pr=<number> -f query='
  query($owner:String!, $repo:String!, $pr:Int!, $after:String, $reviewsAfter:String) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$pr) {
        reviewThreads(first:100, after:$after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id isResolved
            comments(first:20) { nodes { databaseId body path line author { login } } }
          }
        }
        reviews(first:100, after:$reviewsAfter) {
          pageInfo { hasNextPage endCursor }
          nodes { author { login } state body submittedAt }
        }
      }
    }
  }'
```

Keep only `isResolved: false` threads and `reviews` nodes with a non-empty `body` (a reviewer who
only left inline comments produces a bodyless review; bots emit boilerplate). If neither remains,
report that and stop. The two connections paginate independently: while
`reviewThreads.pageInfo.hasNextPage` is true, repeat with `-F after=<threads endCursor>`; while
`reviews.pageInfo.hasNextPage` is true, repeat with `-F reviewsAfter=<reviews endCursor>`.

### 2. Triage validity

For each open thread and each non-empty summary body, read the cited code and judge it:

- Valid: a real bug, regression, convention violation, or correctness issue; cite the `file:line`
  evidence
- Invalid: the concern does not hold; state why against the current code
- Out of scope: legitimate but belongs in a separate change

A summary often restates points already raised inline. Fold those into the matching thread row and
triage only the summary's net-new points. A summary's only outcomes are a fix plus an optional
top-level reply, or no action.

Flag scope creep: a comment asking for a refactor or feature beyond the PR's intent is out of scope,
not extra work. A polite or confident comment is not evidence.

Present the table. The source column names the reviewer (`Copilot #1`, `alice summary`). Thread node
IDs stay internal and never print. Comments asking for the same change share one row.

```text
PR #<number> review feedback triage

| # | source        | file:line   | comment (short)     | verdict      | action         |
|---|---------------|-------------|---------------------|--------------|----------------|
| 1 | Copilot #1    | auth.ts:42  | null deref on token | Valid        | Fix (edit)     |
| 2 | Copilot #2    | cache.ts:88 | races under load    | Valid        | Fix (TDD)      |
| 3 | bob #1        | util.ts:10  | rename for clarity  | Valid        | Fix (edit)     |
| 4 | bob #2        | api.ts:200  | add retry layer     | Out of scope | Reply, defer   |
| 5 | alice summary | (none)      | missing rollback    | Valid        | Fix (edit)     |

Apply the fixes marked Fix and respond to the rest?
```

### 3. STOP: confirm the triage

**STOP. Wait for approval.** The user may overrule any verdict, drop a fix, or add one. Apply their
edits to the table exactly before proceeding.

**AFK branch.** Take this branch only when the invoking run explicitly states it is unattended; when
in doubt, a human is present and the stop above applies unchanged. Print the triage table to the
transcript so the calls are on record, then continue as if the triage were approved.

### 4. Apply accepted fixes

Run `cape workspace phase build`.

For each row marked Fix, apply the change at the right weight per rule 5.

Fix only what the accepted comment asks. Leave adjacent code and the out-of-scope items alone. The
reasoning behind a fix goes in the commit message, not in a code comment. Update each row to Applied
(with the change or test reference) or Dismissed as you go, so the table stays the source of truth.

### 5. Commit, respond, and resolve

Load `cape:commit` to commit the fixes referencing the review; let it split unrelated concerns into
atomic commits. If the user asked to push, push after the commit lands.

Reply, then resolve, over exactly the threads whose fix is pushed or whose dismissal reply is
posted. One point per reply. A fixed thread gets "Fixed in `<sha>`"; a dismissal states the reason.

```bash
# Reply in a thread (dismissed or out-of-scope, with the reason, or "Fixed in <sha>")
gh api graphql -F threadId=<PRRT_id> -F body='<reason>' -f query='
  mutation($threadId:ID!, $body:String!) {
    addPullRequestReviewThreadReply(input:{pullRequestReviewThreadId:$threadId, body:$body}) {
      comment { id }
    }
  }'

# Resolve once the fix landed or a dismissal reply was posted (threads only)
gh api graphql -F threadId=<PRRT_id> -f query='
  mutation($threadId:ID!) {
    resolveReviewThread(input:{threadId:$threadId}) { thread { id isResolved } }
  }'
```

A summary point that warrants a reply gets one top-level PR comment, never a resolve:

```bash
gh pr comment <number> --body '<reply>'
```

Confirm each resolve response shows `isResolved: true`. When every thread resolved the same way,
report one sentence ("Fixed and resolved all 3 threads: <paths>"). Use the tally only when outcomes
are mixed:

```text
Resolved <K>/<N> threads on PR #<number>

Fixed + resolved:     <count>  (<paths>)
Dismissed + resolved: <count>  (<paths>, reason)
Left open:            <count>  (<paths>, needs your call)
Summary points:       <count>  (fixed / replied / no action; no thread to resolve)
```
