---
name: pr-feedback
description: >
  Resolve inbound PR review comments end to end: fetch the threads with their node IDs, judge each
  comment's validity, fix the accepted ones, then reply, resolve the matching threads via GraphQL,
  and commit referencing the review. Use whenever the user wants to act on review feedback: "fetch
  comments on PR, are they valid?", "resolve threads that are fixed", "push and resolve threads we
  fixed", "resolve the comment threads that are fixed or ignored", "fix the valid issues and
  resolve", "/cape:pr-feedback". Do NOT use for reviewing your own pre-PR diff (use cape:review),
  fixing a single diagnosed defect with no PR thread (use cape:fix-bug), or creating a PR (use
  cape:pr).
---

<skill_overview> Drive the inbound review loop for a pull request: fetch every open review thread
with its node ID, triage each comment as valid or not with a file-line rationale, decide an action
per comment (fix, reply and dismiss, or already handled), apply the accepted fixes, then reply,
resolve the matching threads, and commit. Edits nits directly and escalates real changes to cape's
TDD and fix-bug skills; commits through cape:commit.

Core contract: every fetched comment ends in a tracked state — applied with a pushed code change, or
dismissed with a stated reason — and a thread is resolved only after its action lands. Thread IDs
are recovered once, up front, and carried per comment so resolution never depends on hand-pasted
IDs. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — The fetch → triage → confirm → apply → respond/resolve order is
fixed, thread node IDs come only from the `reviewThreads` query, and the per-comment tracking table
is mandatory. Validity judgment and fix depth adapt to each comment. </rigidity_level>

<when_to_use>

- User wants accepted PR review comments turned into code changes and the threads resolved
- "Fetch comments on PR, are they valid?", "resolve threads that are fixed"
- "Resolve the comment threads that are fixed or ignored", "push and resolve threads we fixed"
- After a reviewer leaves inline comments and the author wants to respond and resolve

**Don't use for:**

- Reviewing your own staged or uncommitted code (use cape:review)
- Fixing one diagnosed defect with no PR thread behind it (use cape:fix-bug)
- Creating or describing a PR (use cape:pr)
- Committing unrelated work (use cape:commit directly)

</when_to_use>

<critical_rules>

1. **Thread IDs come only from `reviewThreads`** — the REST comments endpoint never exposes thread
   node IDs (`PRRT_…`). Recover them once with the GraphQL `reviewThreads` query and carry each
   comment's parent thread ID from that fetch. Never hand-paste or re-look-up IDs; that manual
   correlation is the failure mode this skill exists to remove.
2. **Fetch before judging** — pull the live threads with `gh`; never act on remembered or summarized
   comments.
3. **Judge validity with evidence** — each comment is valid, invalid, or out-of-scope with a
   file-line rationale, not deference to the reviewer.
4. **Track every comment** — maintain the triage table so applied vs dismissed is explicit and
   re-verifiable.
5. **Confirm the triage before fixing** — present validity calls and proposed actions, wait for
   approval, then apply.
6. **Edit directly by default; escalate only for real changes** — a nit (rename, typo, comment, null
   guard, import, formatting) is a direct edit. Load `cape:test-driven-development` only when an
   accepted comment demands a behavioral change worth a test, and `cape:fix-bug` only when it
   diagnoses a specific defect that warrants diagnosis to closure. Never wrap a one-line nit in TDD
   ceremony.
7. **Commit through cape:commit** — never write the commit by hand.
8. **Resolve only what landed** — resolve a thread after its fix is pushed, or after a reply states
   why it was dismissed. Skip threads already `isResolved`. Never resolve silently or on an unpushed
   change. A review summary body has no thread node ID; reply via a top-level PR comment at most,
   never resolve it.
9. **Replies use simple language and clear structure** — short, plain sentences; lead with a capital
   letter; one point per reply; no filler, hedging, or emoji padding. Run reply prose through the
   global `stop-slop` skill before posting.

</critical_rules>

<the_process>

## Step 1: Resolve the PR and fetch threads and review summaries

Identify the PR. If the user gave a number or URL use it; otherwise resolve the current branch's PR:

```bash
gh repo view --json owner,name
gh pr status --json number,headRefName,url
```

A review has two parts and they live in two places. **Inline thread comments** ("shards") are in
`reviewThreads`. The **top-level review summary body** — the main message a reviewer types when
hitting Approve / Request changes / Comment — is in `reviews.nodes.body`, a separate field. Fetch
both in one call, or the summary is silently dropped:

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

Keep only `isResolved: false` threads, and only `reviews` nodes with a non-empty `body` (most are
empty — a reviewer who only left inline comments produces a bodyless review; bots emit boilerplate).
If neither remains, report that and stop. Both connections paginate independently: if
`reviewThreads.pageInfo.hasNextPage` is true, repeat with `-F after=<threads endCursor>`; if
`reviews.pageInfo.hasNextPage` is true, repeat with `-F reviewsAfter=<reviews endCursor>`. Keep
paging each until its `hasNextPage` is false so no thread or summary body is dropped on long-lived
PRs.

---

## Step 2: Triage validity

For each open thread and each non-empty review summary, read the cited code and judge it:

- **Valid** — a real bug, regression, convention violation, or correctness issue; cite the
  `file:line` evidence
- **Invalid** — the concern does not hold; state why against the current code
- **Out of scope** — legitimate but belongs in a separate change; note it

A review summary often restates points already raised inline. Fold those into the matching thread
row rather than triaging them twice; triage only the summary's net-new points. A summary has no
thread node ID, so it can never be resolved — its only outcomes are a fix plus an optional top-level
reply, or no action.

Surface scope creep here: if a comment asks for a refactor or feature beyond the PR's intent, flag
it out of scope rather than silently expanding the work. A polite or confident comment is not
evidence.

Before presenting the triage prose, load the global `stop-slop` skill and run the rationales through
it; skip for pure code or mechanical output. Write in simple language with clear, scannable
structure.

Present the tracking table, keyed by source (thread ID, or `summary:<author>@<submittedAt>` so two
non-empty bodies from the same reviewer stay distinct), with the decided action per comment:

```text
PR #<number> — review feedback triage

| # | source       | file:line   | comment (short)     | verdict      | action         |
|---|--------------|-------------|---------------------|--------------|----------------|
| 1 | PRRT_a…      | auth.ts:42  | null deref on token | Valid        | Fix (edit)     |
| 2 | PRRT_b…      | cache.ts:88 | races under load    | Valid        | Fix (TDD)      |
| 3 | PRRT_c…      | util.ts:10  | rename for clarity  | Valid        | Fix (edit)     |
| 4 | PRRT_d…      | api.ts:200  | add retry layer     | Out of scope | Reply, defer   |
| 5 | summary:alice@2026-06-30T07:24:25Z | — | missing rollback | Valid | Fix (edit) |

Apply the fixes marked Fix and respond to the rest?
```

The `source` column carries the thread node ID for inline comments, or
`summary:<author>@<submittedAt>` for a review summary body (no thread ID exists for it; the
timestamp keeps multiple bodies from one author unambiguous).

---

## STOP — Step 3: Confirm

Wait for approval. The user may overrule any verdict, drop a fix, or add one. Apply their edits to
the table exactly before proceeding. Do not change code until the user approves the triage.

---

## Step 4: Apply accepted fixes

Signal the build phase: `cape workspace phase build`.

For each comment marked **Fix**, apply the change at the right weight:

- **Default — edit directly.** A nit (rename, typo, comment, null guard, import, formatting, a small
  local change) is just an edit. Do not invoke a sub-skill for it.
- **Behavioral change worth a test** → load `cape:test-driven-development` and drive
  RED-GREEN-REFACTOR with the comment's concern as the test target.
- **A diagnosed defect** (bug, regression, broken behavior the comment pins down) → load
  `cape:fix-bug` and let it run diagnosis to closure.

Scope guard: fix only what the accepted comment asks. Do not refactor adjacent code or fold in the
out-of-scope items.

Update each row's action to **Applied** (with the change or test reference) or **Dismissed** as you
go, so the table stays the source of truth.

---

## Step 5: Commit, respond, and resolve

Load `cape:commit` to commit the fixes, referencing the review. Let cape:commit split into atomic
commits if the fixes span unrelated concerns. If the user asked to push, push after the commit lands
— a thread is not eligible to resolve until its fix is on the remote.

Reply on GitHub, then loop the resolve mutation over exactly the threads whose fix is pushed or
whose dismissal reply is posted. Keep each reply simple and clearly structured per critical rule 9 —
a fixed thread gets a one-line "Fixed in `<sha>`"; a dismissal states the reason plainly. Each
`threadId` is the `id` carried from Step 1 — no re-lookup:

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

A review summary has no thread to reply into or resolve. When a summary point warrants a reply, post
it once as a top-level PR comment — never resolve it:

```bash
gh pr comment <number> --body '<reply>'
```

Confirm each resolve response shows `isResolved: true`. Present the final table so applied vs
dismissed vs left-open is recorded for later verification:

```text
Resolved <K>/<N> threads on PR #<number>

Fixed + resolved:     <count>  (<paths>)
Dismissed + resolved: <count>  (<paths>, reason)
Left open:            <count>  (<paths>, needs your call)
Summary points:       <count>  (fixed / replied / no action — no thread to resolve)
```

</the_process>

<skill_references>

## Load `cape:test-driven-development` with the Skill tool when:

- An accepted comment requires a behavioral code change worth a test (not a nit)

## Load `cape:fix-bug` with the Skill tool when:

- An accepted comment diagnoses a specific defect that warrants the full diagnose-to-closure
  workflow

## Load `cape:commit` with the Skill tool when:

- The accepted fixes are ready to commit referencing the review

## Load the global `stop-slop` skill with the Skill tool when:

- Writing triage rationales or thread replies that a human will read

</skill_references>

<examples>

<example>
<scenario>User says "push and resolve the threads we fixed" on the current branch's PR</scenario>

**Wrong:** Pull comments from the REST endpoint, hand-paste `PRRT_` IDs into a one-off resolve loop,
and resolve threads whose fixes are still uncommitted locally.

**Right:** Fetch threads via the `reviewThreads` GraphQL query (the only source of thread IDs),
triage each in a table keyed by source, fix the valid ones (nits edited directly, behavioral changes
through TDD), commit and push, then loop `resolveReviewThread` over exactly the threads whose fixes
are now on the remote. </example>

<example>
<scenario>A reviewer leaves a one-line "rename `data` to `rows` for clarity"</scenario>

**Wrong:** Spin up `cape:test-driven-development` and write a RED test for a rename.

**Right:** Mark it Valid / Fix (edit), rename directly, commit through cape:commit, reply "Fixed in
`<sha>`", and resolve the thread. </example>

<example>
<scenario>A reviewer comment asks for a broad refactor the PR never intended</scenario>

**Wrong:** Expand the change to satisfy it and balloon the diff.

**Right:** Mark it out of scope in the table, reply on the thread proposing a follow-up, and resolve
it — leaving the PR scoped. </example>

</examples>

<key_principles>

- **IDs from the right endpoint** — thread node IDs live in `reviewThreads`, never in REST comments;
  recover them once and carry them
- **Triage is judgment, not deference** — a reviewer comment is a hypothesis until the code confirms
  it
- **Fix at the right weight** — edit nits directly; reserve TDD and fix-bug for real behavioral
  changes and diagnosed defects
- **Every comment lands somewhere** — applied with a pushed change or dismissed with a reason; the
  table proves it
- **Resolve follows a pushed action** — never close a thread on an unverified or unpushed fix
- **Replies stay simple and clear** — short plain sentences, one point each, run through stop-slop

</key_principles>
