---
name: challenge
description: >
  Challenge assumptions in designs, implementations, or requirements. Use when reviewing a proposed
  design before committing, auditing completed work for scope creep, or when the user asks to
  challenge/question/audit assumptions. Triggers on: "challenge this", "check my assumptions", "what
  am I assuming", "audit this design", "did I over-engineer", reviewing a plan before execution, or
  reflecting after implementation. Do NOT use for test gap analysis (use cape:find-test-gaps) or
  debugging (use cape:debug-issue).
---

<skill_overview> Surface hidden assumptions in designs, implementations, and requirements before
they become expensive mistakes. Walks each assumption interactively — one per turn — with a
researched recommendation, options, and trade-offs. Every assumption is confirmed (documented as
intentional constraint) or rejected (triggers a scope change, requirement fix, or question to
resolve).

Core contract: every assumption found is categorized, risk-assessed, and resolved with the user
through interactive turn-by-turn interrogation before work continues. </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt depth to complexity (light touch for simple work, full audit
for complex designs). The three steps and the interactive resolution are non-negotiable.
</rigidity_level>

<when_to_use>

- User asks to challenge, question, or audit assumptions
- Reviewing a proposed design before creating an epic
- Auditing completed work for scope creep or unrequested additions
- Requirements feel vague or ambiguous before implementation
- Mid-brainstorm when the user wants to stress-test the design before locking it

**Don't use for:**

- Test coverage analysis (use `cape:find-test-gaps`)
- Bug investigation (use `cape:debug-issue`)

</when_to_use>

<the_process>

## Step 1: Gather context

Determine what's being challenged. Sources:

- **Conversation context** — read back through the current discussion for designs, decisions, plans
- **Code changes** — if post-implementation, run `cape git context` for recent commits and diffs
- **br state** — if within a brainstorm or execute-plan flow, read the epic and current task
- **User-provided artifact** — the user may point at a specific design doc, PR, or plan

**Research before presenting.** Dispatch `cape:codebase-investigator` to explore the codebase and
self-answer questions before surfacing them. If agents aren't available, investigate manually with
Glob/Grep/Read. Only present assumptions that require human judgment — priorities, preferences,
business constraints. If you can resolve an assumption by reading code, resolve it silently and move
on.

Read the `flowPhase` key from `hooks/context/state.json` to determine the current phase. If the file
is absent, unreadable, or the key is missing, default to `"design"`. Use the phase value to set the
depth cap:

| Phase            | Focus                              | Depth cap |
| ---------------- | ---------------------------------- | --------- |
| `design`         | Scope, ambiguity, over-engineering | Up to 5   |
| `implementation` | Scope creep, unrequested additions | Up to 3   |
| `adhoc`          | All categories                     | Up to 5   |

---

## Step 2: Extract and assess assumptions

Scan through six categories:

| Category              | What to look for                                     |
| --------------------- | ---------------------------------------------------- |
| Scope creep           | Features or handling nobody requested                |
| Implicit constraints  | Ambiguous terms, assumed boundaries                  |
| Unstated requirements | Assumed needs never confirmed                        |
| Hidden dependencies   | Assumed library, service, or environment behavior    |
| Over-engineering      | Premature abstraction, unnecessary configurability   |
| Under-specification   | Vague requirements that could go multiple directions |

For each assumption found, assess risk as impact multiplied by reversibility:

- **High** — fundamental design issue, hard to undo (wrong data model, wrong architecture)
- **Medium** — requires rework but contained (unnecessary feature, wrong default)
- **Low** — cosmetic or easily fixed (naming, minor scope addition)

**Depth calibration:** Skip low-risk items when the depth cap is tight. Always surface high and
medium risk items.

Sort findings: high risk first, then medium, then low.

---

## Step 3: Present and resolve interactively

Walk each assumption **one per turn** — not a batch dump. This builds shared understanding through
back-and-forth rather than overwhelming the user.

**Question format:**

```
**Assumption [N/total]: [Topic]** [Risk]

[Context — why this matters and what you found in the codebase]

Recommended: [Your recommendation with reasoning from research]

a) [Recommendation] — [trade-off]
b) [Alternative] — [trade-off]
c) [Different direction] — [trade-off]
```

For each assumption the user resolves:

- **Confirmed** — the assumption is intentional. Document it as an explicit constraint.
- **Rejected** — the assumption needs to change. Capture the correction.

**Termination:**

- **Natural end:** all assumptions resolved
- **User escape:** reply "lock it" to end early — summarize remaining unresolved assumptions as open
  questions
- **Hard cap:** after reaching the depth limit, summarize remaining unresolved items

**Output contract (when called by brainstorm or execute-plan):**

The calling skill incorporates this summary: confirmed constraints feed the design summary's
Requirements or Anti-patterns section; rejected assumptions trigger revisions before proceeding.

**Present challenge summary after resolution:**

```
## Challenge summary

**Confirmed:** [N] assumptions documented as constraints
**Rejected:** [N] assumptions flagged for change
**Skipped:** [N] low-risk items (if depth was calibrated down)

### Changes needed
- [List of rejected assumptions and their resolutions]

### Documented constraints
- [List of confirmed assumptions, now explicit]

### Open questions (if ended early)
- [Unresolved assumptions that may need attention later]
```

</the_process>

<examples>

<example>
<scenario>Internal tool design includes unnecessary timezone handling</scenario>

User: "I'm designing a date picker for our internal tool. It handles formatting, validation,
timezone conversion, and locale-aware display. The tool is only used by our team in Stockholm."

**Wrong:** Accept the design as-is. Timezone conversion and locale handling ship, adding complexity
nobody needs. Three months later someone asks why the date picker has 200 lines of timezone code.

**Right:** Surface timezone conversion and locale-aware display as scope creep one at a time:

```
**Assumption [1/2]: Timezone conversion** [Medium]

The tool is used by a single team in Stockholm. Timezone conversion adds complexity
for a single-timezone use case.

Recommended: Remove timezone conversion — single-region tool doesn't need it.

a) Remove timezone conversion — simpler code, no conversion bugs
b) Keep it — future-proofs for remote team members
c) Add a flag — off by default, available if needed
```

User confirms they're unnecessary — scope shrinks by half. </example>

<example>
<scenario>Implementation exceeds original requirement</scenario>

User: "I just added login to our app. Built session management, password hashing, email
verification, password reset, and rate limiting. Original requirement was 'add basic login with
email and password'."

**Wrong:** Praise the thorough implementation. Email verification, password reset, and rate limiting
ship as undocumented features with no tests and no requirement backing them.

**Right:** Flag email verification, password reset, and rate limiting as scope creep one at a time.
User decides: either expand the requirement (making them official with tests and docs) or remove
them. Either way, nothing ships silently. </example>

<example>
<scenario>Mid-brainstorm design challenge</scenario>

User runs `/cape:challenge` during a brainstorm session to stress-test the proposed approach.

**Wrong:** Dump all assumptions at once. User is overwhelmed and confirms everything to move on.

**Right:** Walk each decision branch one per turn. Research the codebase between questions to
provide informed recommendations. Challenge the notification system design:

```
**Assumption [1/4]: Push notification service** [High]

The design assumes a third-party push service. Codebase investigation shows
`src/notifications/email.ts` exists but no push infrastructure.

Recommended: Start with email only — proven infrastructure exists.

a) Email only — reuses existing infrastructure, ships faster
b) Add push via Firebase — new dependency, new failure mode
c) Abstract behind interface — implement email now, add push later
```

Continue through remaining branches until all resolved or user says "lock it". </example>

</examples>

<key_principles>

- **Everything is challengeable** — including user requirements, not just agent assumptions
- **Research before surfacing** — investigate the codebase to provide informed recommendations
- **One per turn** — interactive back-and-forth, not a batch dump
- **Depth matches risk** — lightweight for simple tasks, full audit for complex designs
- **Assumptions are binary** — each is either confirmed (becomes a documented constraint) or
  rejected (triggers a change)
- **Challenge early, challenge often** — cheaper to catch assumptions in design than in production
- **No silent assumptions** — if something was assumed, it gets surfaced and resolved explicitly

</key_principles>

<critical_rules>

1. **One assumption per turn** — walk interactively, never batch-dump findings
2. **Research before presenting** — investigate codebase to self-answer what you can
3. **Include recommendation with options** — not just "this is an assumption" but "here's what I
   recommend and here are alternatives with trade-offs"
4. **Group by risk level** — high-risk assumptions first, always
5. **Respect depth caps** — 3 for post-implementation, 5 for design and ad-hoc
6. **Never skip high-risk assumptions** — even in lightweight mode, high-risk items are always
   surfaced
7. **Support "lock it" escape** — user can end early; summarize remaining as open questions

</critical_rules> </output>
