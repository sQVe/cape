# Pull request template

## Format

```markdown
**[One sentence that stands alone: what this PR does.]**

[Two or three sentences: the problem and why this approach. Not how; the diff shows how. Written for
a reviewer who knows the domain but not this branch.]

#### Decisions

<!-- OPTIONAL. Only tradeoffs and shortcomings a reviewer would otherwise question. One sentence
     each, in the third person. Not a list of what changed; the diff shows that. -->

- [Decision and its reason]

#### Test plan

<!-- Run these before PR creation, by command or by hand. All must pass. -->

- [ ] Code review by <model> (<reviewer>) on <sha>, findings addressed or dismissed
- [ ] [Command or verifiable behavior]
- [ ] [Command or verifiable behavior]

#### Deployment notes

<!-- OPTIONAL. Operational steps for deployers (migrations, cache flushes, feature flags). -->

- [Deployment action required]

#### Deferred verification

<!-- OPTIONAL. Acceptance checks that need a deployed env and could not run pre-merge. Plain
     bullets, never checkboxes, never marked done. Verify post-merge. -->

- [Check to run after deploy]

---

<!-- DEFAULT: list the human ticket and the AI plan issue from the tracker cache, plus any
     completed task's own human ticket, never the tasks, and only ids that exist (AI-only work has
     no human ticket). Use `Related to` with the same set ONLY when this PR does not complete the
     epic (more PRs or a live cutover still pending); it never closes the issues. One keyword per
     issue, never both on the same id. -->

Fixes ABU-XX, AI-XX
```
