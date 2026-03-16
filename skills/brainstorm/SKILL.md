---
name: brainstorm
description:
  Use BEFORE writing any code for new features, integrations, or system changes. Triggers when the
  user describes something to build, asks "how should I approach X", is unsure between approaches,
  or mentions adding/creating/building functionality. Also use when requirements are vague,
  architecture is unclear, or the task involves design decisions (e.g., choosing libraries, data
  models, API patterns). Do NOT use for bug fixes, refactoring, executing existing plans, or tasks
  where the implementation path is already clear. This skill researches the codebase, asks Socratic
  questions, proposes 2-3 approaches, and produces a design summary for `cape:write-plan` to
  formalize into a br epic.
---

<skill_overview> Turn rough ideas into validated designs ready for `cape:write-plan` to formalize
into a `br` epic. Research the codebase, ask Socratic questions, propose approaches, challenge
assumptions, and produce a self-contained design summary.

Core contract: no design gets locked without research, user-confirmed approach selection, and
assumption challenge. </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt questioning style and research depth to context, but always:
research before proposing, validate design before stopping.
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

This table feeds directly into the design summary.

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

## Step 3: Lock design and stop

**Challenge assumptions:**

Before locking the design, run a lightweight assumption challenge on the proposed design. Focus on
scope creep in requirements, ambiguous terms, and over-engineering in the approach. Present findings
to the user -- confirmed assumptions become requirements or anti-patterns in the design summary,
rejected ones trigger scope reductions or requirement changes. Keep this focused (high and medium
risk only).

**Present design summary:**

After the approach is selected and assumptions are resolved, present a structured design summary.
This summary must be self-contained -- `cape:write-plan` should be able to create the epic without
re-asking brainstorm's questions.

```
## Design summary

**Problem:** [1-2 sentences]
**Chosen approach:** [Name + rationale]
**Requirements:** [Bullet list derived from decisions]
**Anti-patterns:** [Bullet list with "NO X (reason: Y)" format]
**Architecture:** [Components, data flow, integration points]
**Scope:** In: [inclusions] / Out: [exclusions]
**Open questions:** [Uncertainties for implementation]

### Key decisions

| Question | Answer | Implication |
|----------|--------|-------------|

### Research findings

**Codebase:** [file paths, patterns]
**External:** [APIs, libraries, docs]

### Approaches considered

1. **[Chosen]** (selected) — [why]
2. **[Rejected]** — [why rejected, DO NOT REVISIT UNLESS]

### Dead ends

[What explored, what found, why abandoned]
```

**Stop and hand off:**

```
Design summary complete. Run `/cape:write-plan` to formalize this into a br epic.
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
4. Challenge assumptions, present design summary
5. Stop: "Run `/cape:write-plan` to formalize this into a br epic." </example>

<example>
<scenario>Epic created without anti-patterns — requirements get watered down during implementation</scenario>

**Wrong:** Epic says "Tokens stored securely" with no anti-patterns. During implementation, hits
complexity → stores tokens in localStorage. No guardrail prevented it.

**Right:** Design summary says "Tokens stored in httpOnly cookies" with anti-pattern "NO localStorage
tokens (reason: httpOnly prevents XSS token theft)". When `write-plan` formalizes this into an epic,
the anti-pattern is preserved and blocks shortcuts during implementation. </example>

</examples>

<key_principles>

- **Research before proposing** — use agents to understand codebase and external context
- **Multiple choice preferred** — easier for user to answer than open-ended questions
- **Design summary is the handoff** — contains everything write-plan needs to create the epic
- **Anti-patterns prevent shortcuts** — every entry uses "NO X (reason: Y)" format
- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **Capture decisions** — Key Decisions table feeds the design summary
- **Document dead ends** — prevents wasted re-investigation during implementation </key_principles>

<critical_rules>

1. **Research BEFORE proposing** — use agents to understand context
2. **Propose 2-3 approaches** — don't jump to a single solution
3. **Include anti-patterns with reasoning** — "NO X (reason: Y)", not just "NO X"
4. **Stop after design summary** — present summary and wait for user to run write-plan
5. **Design summary must be self-contained** — write-plan should not need to re-ask questions

</critical_rules>
