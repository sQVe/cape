# Pull request template

## Format

```markdown
[Brief description of what this PR accomplishes]

#### Motivation

[Problem being solved or opportunity. Why now? 1-3 sentences.]

#### Changes

- [Describe key changes made]
- [Include technical implementation details]
- [Highlight any architectural or design decisions]

#### Test plan

<!-- Run these before PR creation, by command or by hand. All must pass. -->

- [ ] Code review by [model and reviewer] on [sha], findings addressed or dismissed
- [ ] [Command or verifiable behavior]
- [ ] [Command or verifiable behavior]

#### Verification performed

<!-- Testing done during development. Evidence, not promises. -->

- [Describe testing done and results observed]

#### Deployment notes

<!-- OPTIONAL. Operational steps for deployers (migrations, cache flushes, feature flags). -->

- [Deployment action required]

#### Manual verification

<!-- OPTIONAL. Only for subjective human judgment (visual/UX). Omit for backend changes. -->

- [Subjective item requiring human judgment]

#### Deferred verification

<!-- OPTIONAL. Acceptance checks that need a deployed env and could not run pre-merge. Plain
     bullets, never checkboxes, never marked done. Verify post-merge. -->

- [Check to run after deploy]

---

<!-- DEFAULT: list the human ticket, the AI plan issue, and every completed task from the
     tracker cache. Incomplete and canceled children excluded, and only ids that exist (AI-only
     work has no human ticket). Use `Related to` with the same set ONLY when this PR does not
     complete the epic (more PRs or a live cutover still pending). Pick one keyword per issue,
     never both on the same id. -->

Fixes ABU-XX, AI-XX, AI-XX
```

## Section guidelines

- **Motivation.** The problem or opportunity driving the change (1-3 sentences)
- **Changes.** What was implemented, with technical details
- **Test plan.** Commands, assertions, and the code review pass. The review item names the model and
  reviewer that actually ran and the commit they read, so a reader outside the repo can judge the
  review and spot a stale one. Every checkbox must be `[x]` before the PR exists.
- **Verification performed.** Evidence of testing already done during development
- **Deployment notes.** Operational steps for deployers (optional, omit if none)
- **Manual verification.** Subjective human judgment only (optional, often omitted)
- **Deferred verification.** Checks that need a deployed environment (optional, plain bullets, never
  marked done)
- **Issues.** Build the closing line from the tracker cache:
  `Fixes <human-id>, <plan-id>, <completed task ids>`, meaning the human ticket, the AI plan issue,
  and every completed child task plus any completed task's own `humanTicketId`. Incomplete and
  canceled children are excluded, and ids that do not exist are omitted (AI-only work has no human
  ticket). Use a non-closing keyword (`Related to`) with the same set ONLY when this PR does not
  complete the epic, meaning more PRs or a live cutover are still pending. A non-closing link still
  moves the issues through pre-merge statuses but never closes them, which is the most common reason
  an epic stays open after its PR merges. Closing keywords: `close`, `fix`, `resolve`, `complete`,
  `implement` (and their tenses). Linear links and closes by Linear identifier, not GitHub issue
  number.

## Test plan format

**Checkboxes** (must all be `[x]` before PR):

- Commands: "Run `npm test`", "Execute `make build`"
- Verifiable behaviors: "API returns 200", "File is created"
- Assertions: "Error message contains 'invalid'"

**Verification performed** (prose, no checkboxes):

- What you tested during development
- Specific outputs or results observed
- Evidence that the change works

**Deployment notes** (optional):

- Migrations to run
- Caches to flush
- Feature flags to enable
- Environment variables to add

**Manual verification** (optional, often omitted):

- Visual design: "Colors match mockup", "Layout looks balanced"
- UX feel: "Animation feels smooth", "Interaction feels responsive"
- Subjective: "Error message tone is appropriate"

**Never in manual verification:**

- CI/CD status (automated by GitHub)
- Text output verification (grep it)
- Status codes or return values
- Deployment actions (cache flush, migrations)
- Anything with deterministic output

If output is deterministic, it belongs in a checkbox. If it is a deployment action, it belongs in
deployment notes. Manual verification means subjective human judgment only; most backend PRs have
none.
