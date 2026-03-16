---
name: challenge
description: >
  Challenge assumptions in designs, implementations, or requirements. Use when reviewing a proposed
  design before committing, auditing completed work for scope creep, or when the user asks to
  challenge/question/audit assumptions. Triggers on: "challenge this", "check my assumptions",
  "what am I assuming", "audit this design", "did I over-engineer", reviewing a plan before
  execution, or reflecting after implementation. Also dispatched by brainstorm (pre-design) and
  execute-plan (post-task) as a lightweight checkpoint. Do NOT use for code review (use review),
  test gap analysis (use test), or debugging (use debug-issue).
---

<skill_overview> Surface hidden assumptions in designs, implementations, and requirements before
they become expensive mistakes. Produces an interactive report where each assumption is confirmed
(documented as intentional constraint) or rejected (triggers a scope change, requirement fix, or
question to resolve).

Core contract: every assumption found is categorized, risk-assessed, and resolved with the user
before work continues. </skill_overview>

<rigidity_level> HIGH FREEDOM -- Adapt depth to complexity (light touch for simple work, full audit
for complex designs). The three steps and the interactive resolution are non-negotiable.
</rigidity_level>

<when_to_use>

- User asks to challenge, question, or audit assumptions
- Reviewing a proposed design before creating an epic
- Auditing completed work for scope creep or unrequested additions
- Requirements feel vague or ambiguous before implementation
- Dispatched as checkpoint by brainstorm, write-plan, or execute-plan skills

**Don't use for:**

- Code review (use `cape:review`)
- Test coverage analysis (use `cape:test`)
- Bug investigation (use `cape:debug-issue`)

</when_to_use>

<the_process>

## Step 1: Gather context

**Announce:** "I'm using the challenge skill to surface hidden assumptions."

Determine what's being challenged. Sources:

- **Conversation context** -- read back through the current discussion for designs, decisions, plans
- **Code changes** -- if post-implementation, review recent commits and diffs
- **br state** -- if within a brainstorm or execute-plan flow, read the epic and current task
- **User-provided artifact** -- the user may point at a specific design doc, PR, or plan

Categorize the phase:

| Phase | Focus | Depth |
|-------|-------|-------|
| Design (pre-implementation) | Scope, ambiguity, over-engineering | Full audit |
| Implementation (post-task) | Scope creep, unrequested additions | Compare against task spec |
| Ad-hoc review | All categories | Proportional to complexity |

---

## Step 2: Extract and assess assumptions

Scan through six categories:

| Category | What to look for |
|----------|-----------------|
| Scope creep | Features or handling nobody requested |
| Implicit constraints | Ambiguous terms, assumed boundaries |
| Unstated requirements | Assumed needs never confirmed |
| Hidden dependencies | Assumed library, service, or environment behavior |
| Over-engineering | Premature abstraction, unnecessary configurability |
| Under-specification | Vague requirements that could go multiple directions |

For each assumption found, assess risk as impact multiplied by reversibility:

- **High** -- fundamental design issue, hard to undo (wrong data model, wrong architecture)
- **Medium** -- requires rework but contained (unnecessary feature, wrong default)
- **Low** -- cosmetic or easily fixed (naming, minor scope addition)

**Depth calibration:** For simple tasks or lightweight checkpoints (dispatched by other skills),
skip low-risk items and focus on high and medium. For complex designs or full audits, include all.

---

## Step 3: Present and resolve

Present findings grouped by risk level (high first). For each assumption:

```
### [Risk] Assumption: [short description]

**Where:** [location -- conversation context, code file:line, task description, etc.]
**Impact:** [what goes wrong if this assumption is wrong]
**Resolution:** [question to answer, constraint to add, or scope to cut]
```

Ask the user to confirm or reject each finding:

- **Confirmed** -- the assumption is intentional. Document it as an explicit constraint.
- **Rejected** -- the assumption needs to change. Capture the correction.

After resolution, summarize results:

```
## Challenge summary

**Confirmed:** [N] assumptions documented as constraints
**Rejected:** [N] assumptions flagged for change
**Skipped:** [N] low-risk items (if depth was calibrated down)

### Changes needed
- [List of rejected assumptions and their resolutions]

### Documented constraints
- [List of confirmed assumptions, now explicit]
```

When dispatched by another skill, feed results back:

- **brainstorm**: confirmed assumptions become design summary requirements or anti-patterns;
  rejected ones trigger scope reductions or requirement changes
- **write-plan**: confirmed assumptions become epic requirements or anti-patterns; rejected ones
  become scope reductions or requirement changes before `br create`
- **execute-plan**: rejected assumptions become scope corrections or new tasks; confirmed ones
  become outcome notes on the completed task

</the_process>

<examples>

<example>
<scenario>Internal tool design includes unnecessary timezone handling</scenario>

User: "I'm designing a date picker for our internal tool. It handles formatting, validation,
timezone conversion, and locale-aware display. The tool is only used by our team in Stockholm."

**Wrong:** Accept the design as-is. Timezone conversion and locale handling ship, adding complexity
nobody needs. Three months later someone asks why the date picker has 200 lines of timezone code.

**Right:** Flag timezone conversion and locale-aware display as scope creep -- single-region
internal tool doesn't need them. User confirms they're unnecessary, cuts scope to formatting and
validation only. Design shrinks by half. </example>

<example>
<scenario>Implementation exceeds original requirement</scenario>

User: "I just added login to our app. Built session management, password hashing, email
verification, password reset, and rate limiting. Original requirement was 'add basic login with
email and password'."

**Wrong:** Praise the thorough implementation. Email verification, password reset, and rate limiting
ship as undocumented features with no tests and no requirement backing them.

**Right:** Flag email verification, password reset, and rate limiting as scope creep beyond "basic
login." User decides: either expand the requirement (making them official with tests and docs) or
remove them. Either way, nothing ships silently. </example>

<example>
<scenario>Vague requirements before implementation</scenario>

User: "We need to build a notification system. Users should get notified about important events."

**Wrong:** Start implementing with assumptions about what "users", "important", "events", and
"notified" mean. Ship email notifications for all users on all events because nothing was specified.

**Right:** Flag four under-specifications: "users" (which users?), "important" (who decides
importance?), "events" (which specific events?), "notified" (email, push, in-app?). Each becomes a
question to answer before implementation begins. </example>

</examples>

<key_principles>

- **Everything is challengeable** -- including user requirements, not just agent assumptions
- **Depth matches risk** -- lightweight for simple tasks, full audit for complex designs
- **Assumptions are binary** -- each is either confirmed (becomes a documented constraint) or
  rejected (triggers a change)
- **Challenge early, challenge often** -- cheaper to catch assumptions in design than in production
- **No silent assumptions** -- if something was assumed, it gets surfaced and resolved explicitly

</key_principles>

<critical_rules>

1. **Always present findings interactively** -- the user confirms or rejects each assumption
2. **Group by risk level** -- high-risk assumptions first, always
3. **Include resolution for every finding** -- not just "this is an assumption" but "here's what to
   do about it"
4. **Feed results back to calling skill** -- when dispatched by brainstorm, write-plan, or
   execute-plan, results must flow into their artifacts (design summary, epic, task, etc.)
5. **Never skip high-risk assumptions** -- even in lightweight mode, high-risk items are always
   surfaced

</critical_rules>
