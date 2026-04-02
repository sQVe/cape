---
name: write-plan
description: >
  Formalize a brainstorm design into a br epic with immutable requirements and a first task. Use
  after cape:brainstorm has produced a design summary. Triggers on: user runs /cape:write-plan,
  "create the epic", "formalize this design", "write the plan", transitioning from brainstorm to
  implementation. Do NOT use for initial exploration (use cape:brainstorm), executing existing plans
  (use cape:execute-plan), or bug investigation (use cape:debug-issue).
---

<skill_overview> Formalize a validated design into a `br` epic with immutable requirements,
anti-patterns, and a first task. The bridge between exploration (brainstorm) and implementation
(execute-plan).

Core contract: no epic without a design summary in conversation context. No task without an epic.
</skill_overview>

<rigidity_level> LOW FREEDOM -- The epic structure (from the template) and first-task creation are
non-negotiable. Validation depth and detail-filling adapt to the design's complexity.
</rigidity_level>

<when_to_use>

- Design summary exists in conversation from brainstorm
- User wants to formalize a design into a tracked epic
- Transitioning from brainstorm to implementation

**Don't use for:**

- No design exists yet (use `cape:brainstorm`)
- Epic already exists (use `cape:execute-plan`)
- Bug investigation (use `cape:debug-issue`)

</when_to_use>

<the_process>

## Step 1: Verify design context

Verify that a design summary exists in conversation context. If not, offer `cape:brainstorm` as an
option to explore and lock a design — but acknowledge that an organic design developed in
conversation is equally valid. If no design of any kind exists, stop and ask the user to share one.

Review the design summary. Identify any gaps that would prevent creating a complete epic:

- Missing or vague requirements
- Anti-patterns without reasoning
- Unresolved open questions that block implementation
- Architecture lacking concrete file paths or components

---

## Step 2: Validate and flesh out

Present the design in sections for chunk-by-chunk validation (200-300 word chunks). This is where
the brainstorm's high-level design gets refined into epic-grade specifics:

- **Requirements:** convert design summary bullets into specific, testable statements
- **Durable decisions:** extract decisions that survive refactors (routes, schema shapes, auth
  patterns, external service boundaries) into their own section
- **Anti-patterns:** ensure every entry has reasoning ("NO X (reason: Y)")
- **Architecture:** flesh out with concrete files, components, data flow
- **Success criteria:** derive from requirements, make objectively measurable

Confirm each chunk: "Does this look right so far?"

If the design summary has open questions that block epic creation, resolve them with the user now.
Don't defer questions that would make requirements ambiguous.

---

## Step 3: Create epic and first task

Ensure a beads workspace exists:

```bash
br where 2>/dev/null || br init
```

Create the `br` epic using this template (every section is required):

!`cat "${CLAUDE_SKILL_DIR}/resources/epic-template.md"`

```bash
br create "Epic: [Feature Name]" \
  --type epic \
  --priority [0-4] \
  --labels "[skill-name]" \
  --description "$(cat <<'EOF'
## Requirements
[Specific, testable statements derived from the design summary]
- Requirement 1
- Requirement 2

## Durable decisions
[Choices that survive refactors — routes, schemas, auth patterns, external boundaries]
- Decision 1
- Decision 2

## Anti-patterns
[What NOT to do, with reasoning]
- NO X (reason: Y)

## Success criteria
[Objectively measurable outcomes]
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Tests passing
- [ ] Pre-commit hooks passing
EOF
)"
cape br validate <epic-id>
```

Create exactly one task as a child of the epic. The task should be a **vertical slice** — a thin
end-to-end path through all layers (schema, API, UI, tests), not a horizontal layer. A completed
slice is independently demonstrable.

```bash
br create "Task 1: [Specific deliverable]" \
  --type task \
  --priority [match epic] \
  --parent [epic-id] \
  --labels "[hitl or afk]" \
  --description "$(cat <<'EOF'
## Goal
[What this task delivers — one clear outcome]

## Execution mode
[HITL (needs human decisions during implementation) or AFK (can be executed autonomously)]

## Behaviors
[Sequential — each becomes exactly one RED-GREEN-REFACTOR cycle. Never test or implement more than one at a time.]
1. [Behavior 1: "returns error when input is empty"]
2. [Behavior 2: "parses valid input into sections"]
...

## References
[Point to 1-3 similar implementations or patterns: file:line]

## Success criteria
- [ ] [Specific, measurable outcome]
- [ ] Tests passing
- [ ] Pre-commit hooks passing
EOF
)"
cape br validate <task-id>
```

**Why only one task?** Subsequent tasks should be created iteratively during execution. Each task
reflects learnings from the previous one. Upfront task trees become brittle when assumptions change.

**Why vertical slices?** Horizontal tasks ("write all models", "write all tests") hide integration
risk. Vertical slices prove the system works end-to-end sooner and are independently demoable.

**Present completion summary and stop:**

```
Epic [id] created with immutable requirements and success criteria.
First task [id] is ready to execute.

The epic has [N] requirements, [N] anti-patterns, and [N] success criteria.

Optionally stress-test the first task with `cape:task-refinement` before executing.
Continue with `cape:execute-plan` to start building.
```

</the_process>

<examples>

<example>
<scenario>Skipping validation, copying design summary verbatim into epic</scenario>

User ran brainstorm, design summary says "tokens stored securely" as a requirement.

**Wrong:** Copy "tokens stored securely" directly into the epic. During implementation, this vague
requirement allows localStorage, sessionStorage, or cookies — no clear standard to hold against.

**Right:** During validation, tighten to "Tokens stored in httpOnly cookies (NOT localStorage)." Add
anti-pattern: "NO localStorage tokens (reason: httpOnly prevents XSS token theft)." The epic is more
precise than the design summary. </example>

<example>
<scenario>No design summary exists in conversation</scenario>

User runs `/cape:write-plan` in a fresh conversation without brainstorming first.

**Wrong:** Start asking the user about requirements and architecture from scratch. This duplicates
brainstorm and produces a weaker design without the research and assumption-challenge phases.

**Right:** Tell the user: "No design summary found in conversation. Load `cape:brainstorm` first to
explore the idea, then come back to formalize it." Stop. </example>

</examples>

<key_principles>

- **Formalize, don't explore** -- brainstorm explores, write-plan formalizes
- **Epic is contract** -- requirements immutable, tasks adapt
- **Anti-patterns prevent shortcuts** -- every entry uses "NO X (reason: Y)" format
- **One task only** -- subsequent tasks created iteratively as you learn
- **Tighten, don't loosen** -- validation makes requirements more specific, not less

</key_principles>

<critical_rules>

1. **Require design context** -- do not create an epic without a brainstorm design summary
2. **Use epic template** -- every section from the injected template above is required
3. **Create ONLY first task** -- subsequent tasks created iteratively
4. **Stop after creation** -- present summary and wait for user to run execute-plan
5. **Anti-patterns MUST include reasoning** -- "NO X (reason: Y)", not just "NO X"

</critical_rules>
