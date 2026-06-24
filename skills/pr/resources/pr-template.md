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

<!-- Automatable items — run these before PR creation. All must pass. -->

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

---

<!-- DEFAULT: `Fixes ABU-XX` so the epic auto-closes on merge. Use `Related to ABU-XX`
     ONLY when this PR does not complete the epic (more PRs or a live cutover still pending).
     Pick one keyword per issue — never both on the same id. -->

Fixes ABU-XX
```

## Section guidelines

- **Motivation**: Problem or opportunity driving the change (1-3 sentences)
- **Changes**: Focus on "what" was implemented with technical details
- **Test plan**: Automatable commands and assertions — checkboxes that must all be `[x]` before PR
- **Verification performed**: Evidence of testing already done during development
- **Deployment notes**: Operational steps for deployers (optional, omit if none)
- **Manual verification**: Subjective human judgment only (optional, often omitted)
- **Issues**: Reference the Linear epic by its identifier. **Default to a closing keyword**
  (`Fixes ABU-XX`) so the epic auto-closes on merge. Use a non-closing keyword (`Related to ABU-XX`)
  ONLY when this PR does not complete the epic — more PRs or a live cutover still pending. A
  non-closing link still moves the issue through pre-merge statuses but never closes it, which is
  the most common reason an epic stays open after its PR merges. Closing keywords: `close`, `fix`,
  `resolve`, `complete`, `implement` (and their tenses). Linear links and closes by Linear
  identifier, not GitHub issue number.

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

If output is deterministic, it's a checkbox. If it's a deployment action, it's a deployment note.
Manual = subjective human judgment only. Most backend PRs have no manual verification.
