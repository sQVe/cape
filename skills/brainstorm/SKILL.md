---
name: brainstorm
description:
  Use BEFORE writing any code for new features, integrations, or system changes. Triggers when the
  user describes something to build, asks "how should I approach X", is unsure between approaches,
  or mentions adding/creating/building functionality. Also use when requirements are vague,
  architecture is unclear, or the task involves design decisions (e.g., choosing libraries, data
  models, API patterns). Do NOT use for bug fixes, refactoring, executing existing plans, or tasks
  where the implementation path is already clear. This skill researches the codebase, asks Socratic
  questions, proposes 2-3 approaches, and produces a br epic with immutable requirements,
  anti-patterns, and a first task.
---

<skill_overview> Turn rough ideas into validated designs stored as `br` epics with immutable
requirements. Tasks are created iteratively as you learn, not upfront.

Core contract: no code gets written until an epic exists with immutable requirements, anti-patterns
with reasoning, and exactly one first task. </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt questioning style and research depth to context, but always:
research before proposing, create immutable epic before code, create only the first task.
</rigidity_level>

<when_to_use>

- User describes a new feature to implement
- User has a rough idea that needs refinement
- About to write code without clear requirements
- Need to explore approaches before committing
- Requirements exist but architecture is unclear

**Don't use for:**

- Executing existing plans with an epic already created
- Fixing bugs
- Refactoring existing code
- Requirements already crystal clear and epic exists </when_to_use>

<the_process>

## Step 1: Understand the idea

**Announce:** "I'm using the brainstorming skill to refine your idea into a design."

**Gather context:**

- Check recent commits, existing docs, codebase structure
- Dispatch `cape:codebase-investigator` to find existing patterns relevant to the idea
- Dispatch `cape:internet-researcher` if the idea involves external APIs, libraries, or unfamiliar
  tech
- If agents aren't available, investigate manually with Glob/Grep/Read and WebSearch/WebFetch

**Ask clarifying questions:**

Use AskUserQuestion for structured choices (token storage, auth strategy, data model decisions). Use
conversational follow-ups for open exploration (what problem are you solving, who are the users,
what does success look like).

Guidelines:

- 1-5 questions per round, don't overwhelm
- Multiple choice with a recommended default when possible
- Separate critical questions (must answer) from nice-to-have (has good default)
- Offer "Reply 'defaults' to accept all recommended options" for batches with clear defaults

**Record decisions as you go:**

Maintain a running "Key Decisions" table throughout the conversation:

| Question         | Answer           | Implication                                |
| ---------------- | ---------------- | ------------------------------------------ |
| [What you asked] | [What user said] | [How it shapes requirements/anti-patterns] |

This table feeds directly into the epic's Design Discovery section.

---

## Step 2: Research and propose approaches

**Research order:**

1. Codebase patterns first — if a pattern exists, use it unless clearly unwise
2. External docs second — APIs, libraries, community practices
3. Ask user if research yields nothing useful

**Capture findings as you go:**

- Codebase: file paths, patterns, relevant code snippets
- External: API capabilities, library constraints, doc URLs
- Dead ends: what you explored, what you found, why you abandoned it

Dead-end documentation prevents wasted re-investigation when obstacles arise later.

**Propose 2-3 approaches:**

```
Based on [research findings], I recommend:

1. **[Approach A]** (recommended)
   - Pros: [benefits, especially "matches existing pattern"]
   - Cons: [drawbacks]

2. **[Approach B]**
   - Pros: [benefits]
   - Cons: [drawbacks]

I recommend option 1 because [specific reason, especially codebase consistency].
```

Lead with recommended option. Explain why.

---

## Step 3: Validate design and create epic

**Present design in sections:**

- Break into 200-300 word chunks
- Confirm each chunk: "Does this look right so far?"
- Cover: architecture, components, data flow, error handling
- Record user concerns or hesitations as Open Concerns

**Challenge assumptions:**

Before locking in the design, run a lightweight assumption challenge on the proposed design. Focus
on scope creep in requirements, ambiguous terms, and over-engineering in the approach. Present
findings to the user -- confirmed assumptions become epic requirements or anti-patterns, rejected
ones trigger scope reductions or requirement changes. Keep this focused (high and medium risk only).

**Create the epic:**

After design is validated and assumptions are resolved, create the `br` epic using the template from
`resources/epic-template.md`. Every section is required:

```bash
br create "Epic: [Feature Name]" \
  --type epic \
  --priority [0-4] \
  --description "[full epic content from template]"
```

**Anti-patterns MUST include reasoning:**

```
- NO localStorage tokens (reason: httpOnly prevents XSS token theft)
- NO mocking OAuth in integration tests (reason: defeats purpose of testing real flow)
```

Not just "NO X" — always "NO X (reason: Y)".

---

## Step 4: Create first task

Create exactly one task as a child of the epic:

```bash
br create "Task 1: [Specific deliverable]" \
  --type feature \
  --priority [match epic] \
  --parent [epic-id] \
  --description "## Goal
[What this task delivers — one clear outcome]

## Implementation
1. Study existing code
   [Point to 2-3 similar implementations: file:line]

2. Write tests first (TDD)
   [Specific test cases for this task]

3. Implementation checklist
   - [ ] file:line - function_name() - [what it does]
   - [ ] test:line - test_name() - [what it tests]

## Success criteria
- [ ] [Specific, measurable outcome]
- [ ] Tests passing
- [ ] Pre-commit hooks passing"
```

**Why only one task?** Subsequent tasks should be created iteratively during execution. Each task
reflects learnings from the previous one. Upfront task trees become brittle when assumptions change.

**Present completion summary:**

```
Epic [id] created with immutable requirements and success criteria.
First task [id] is ready to execute.

The epic has [N] requirements, [N] anti-patterns, and [N] success criteria.
```

</the_process>

<agent_references>

## Dispatch `cape:codebase-investigator` when:

- Understanding how existing features work
- Finding where specific functionality lives
- Identifying patterns to follow
- Verifying assumptions about structure

## Dispatch `cape:internet-researcher` when:

- Finding current API documentation
- Researching library capabilities
- Comparing technology options
- Finding official code examples

## Research protocol:

1. Codebase pattern exists → use it (unless clearly unwise)
2. No codebase pattern → research external patterns
3. Research yields nothing → ask user for direction

</agent_references>

<examples>

<example>
<scenario>Developer skips research, proposes approach without checking codebase</scenario>

User: "Add OAuth authentication"

**Wrong:** "I'll implement OAuth with Auth0..." — proposes approach without checking that
passport.js already exists in the codebase. Creates inconsistent architecture.

**Right:**

1. Dispatch codebase-investigator: finds passport.js at auth/passport-config.ts
2. Dispatch internet-researcher: finds passport-google-oauth20 strategy
3. Propose extending existing passport setup (matches codebase) vs Auth0 (vendor dependency) vs
   custom JWT (scope creep)
4. Research informs design, design builds on existing code </example>

<example>
<scenario>Epic created without anti-patterns — requirements get watered down during implementation</scenario>

**Wrong:** Epic says "Tokens stored securely" with no anti-patterns. During implementation, hits
complexity → stores tokens in localStorage. No guardrail prevented it.

**Right:** Epic says "Tokens stored in httpOnly cookies" with anti-pattern "NO localStorage tokens
(reason: httpOnly prevents XSS token theft)". When implementation gets hard, the anti-pattern blocks
the shortcut and forces the correct solution. </example>

</examples>

<key_principles>

- **Research before proposing** — use agents to understand codebase and external context
- **Multiple choice preferred** — easier for user to answer than open-ended questions
- **Epic is contract** — requirements immutable, tasks adapt
- **Anti-patterns prevent shortcuts** — every entry uses "NO X (reason: Y)" format
- **One task only** — subsequent tasks created iteratively as you learn
- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **Capture decisions** — Key Decisions table feeds Design Discovery section
- **Document dead ends** — prevents wasted re-investigation during implementation </key_principles>

<critical_rules>

1. **Research BEFORE proposing** — use agents to understand context
2. **Propose 2-3 approaches** — don't jump to a single solution
3. **Epic requirements IMMUTABLE** — tasks adapt, requirements don't
4. **Include anti-patterns with reasoning** — "NO X (reason: Y)", not just "NO X"
5. **Create ONLY first task** — subsequent tasks created iteratively
6. **Use epic template** — every section from `resources/epic-template.md` is required
7. **Use `--description` flag** — not `--design` (that flag doesn't exist)

</critical_rules>
