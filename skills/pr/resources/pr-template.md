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

- [ ] Code review by <model> (<reviewer>) on <sha>, findings addressed or dismissed
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

<!-- DEFAULT: list the human ticket and the AI plan issue from the tracker cache, plus any
     completed task's own human ticket, never the tasks, and only ids that exist (AI-only work has
     no human ticket). Use `Related to` with the same set ONLY when this PR does not complete the
     epic (more PRs or a live cutover still pending); it moves the issues through pre-merge
     statuses but never closes them, the most common reason an epic stays open after merge. Pick
     one keyword per issue, never both on the same id. Closing keywords: `close`, `fix`,
     `resolve`, `complete`, `implement` (and their tenses). Linear links and closes by Linear
     identifier, not GitHub issue number. -->

Fixes ABU-XX, AI-XX
```
