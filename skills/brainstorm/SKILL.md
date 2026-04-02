---
name: brainstorm
description:
  Use BEFORE writing any code for new features, integrations, or system changes. Triggers when the
  user describes something to build, asks "how should I approach X", is unsure between approaches,
  or mentions adding/creating/building functionality. Also use when requirements are vague,
  architecture is unclear, or the task involves design decisions (e.g., choosing libraries, data
  models, API patterns). Do NOT use for bug fixes, refactoring where the target structure is clear
  (use cape:refactor), executing existing plans, or tasks where the implementation path is already
  clear. This skill researches the codebase, asks Socratic questions, generates competing designs
  under different constraints, and produces a design summary for `cape:write-plan` to formalize into
  a br epic.
---

<skill_overview> Turn rough ideas into validated designs ready for `cape:write-plan` to formalize
into a `br` epic. Research the codebase, ask Socratic questions, generate competing designs under
different constraints, and produce a self-contained design summary.

Core contract: no design gets locked without research, constraint-driven design exploration, and
iterative user discussion at every stage. </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt questioning style and research depth to context, but always:
research before proposing, checkpoint after each step, never advance without user input.
</rigidity_level>

<mode> CONVERSATIONAL — Brainstorm is a discussion, not a plan artifact. Never enter plan mode. If
plan mode is active when brainstorm is invoked, exit it immediately and proceed conversationally.
The design summary lives in conversation context; `write-plan` formalizes it into a br epic later.
</mode>

<when_to_use>

- User describes a new feature to implement
- User has a rough idea that needs refinement
- About to write code without clear requirements
- Need to explore approaches before committing
- Requirements exist but architecture is unclear

**Don't use for:**

- Executing existing plans with an epic already created
- Fixing bugs
- Refactoring with a clear target structure (use `cape:refactor`)
- Requirements already crystal clear and epic exists </when_to_use>

<the_process>

Every step ends with a **CHECKPOINT** — present findings and wait for user input. Never advance to
the next step until the user responds. The user may discuss, redirect, ask follow-ups, or say
"continue" to proceed. This is a conversation, not a pipeline.

---

## Step 1: Research and understand

**Check for ready work first:**

Run `br ready` before doing anything else. If it returns tasks:

1. Present the list: "You have N ready task(s): [list]. Did you mean to continue with execute-plan
   instead of starting a new brainstorm?"
2. Wait for user response:
   - If they redirect to execute-plan: load `cape:execute-plan` with the Skill tool and stop
   - If they confirm brainstorm intent: proceed with research below

Skip this step only if `br ready` returns no tasks.

**Gather context:**

- Run `cape git context` for recent commits and codebase state; check existing docs and structure
- Dispatch `cape:codebase-investigator` to find existing patterns relevant to the idea
- Dispatch `cape:internet-researcher` if the idea involves external APIs, libraries, or unfamiliar
  tech
- If agents aren't available, investigate manually with Glob/Grep/Read and WebSearch/WebFetch

**Answer your own questions first:**

Before asking the user anything, check if the codebase or research can answer the question. Explore
code, read docs, check patterns. Only ask the user questions that require human judgment
(priorities, preferences, business constraints). If you can answer it by reading code, read code.

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

### CHECKPOINT: Present research summary

Present what you found — do not propose solutions yet:

```
## Research summary

**Codebase:** [existing patterns, relevant files, constraints discovered]
**External:** [API docs, library capabilities — if researched]
**Dead ends:** [what you explored, what you found, why it's not relevant]
**Key decisions so far:** [table of user answers from clarifying questions]
```

**STOP here.** Ask: "Anything to discuss or redirect before I propose approaches?"

The user may:

- Discuss findings, ask follow-ups, correct misunderstandings
- Point out missed context or redirect research
- Say "continue" to proceed to Step 2

Do NOT proceed to Step 2 until the user responds.

---

## Step 2: Propose approaches

**Generate competing designs:**

Assess whether the idea warrants divergent exploration or has an obvious path:

- **Interface mode** — the core design question is about an interface, API surface, module boundary,
  or type contract. Load `cape:design-an-interface` with the Skill tool instead of running divergent
  mode inline. Its comparison and recommendation feed back as the chosen approach and approaches
  considered.
- **Divergent mode** — the idea touches multiple components, has competing viable approaches, or
  involves architectural decisions beyond interface shape. Dispatch 3 parallel design agents.
- **Inline mode** — single-file change, one obvious pattern to follow, trivial scope. Propose 1-2
  approaches directly without agents.

**Divergent mode — dispatch 3 parallel sub-agents:**

Each agent receives the same research context (codebase findings, external docs, Key Decisions so
far) and designs under a different constraint:

| Agent | Constraint                                    | Tendency                                         |
| ----- | --------------------------------------------- | ------------------------------------------------ |
| 1     | Minimize the interface — simplest possible    | Fewest moving parts, smallest API surface        |
| 2     | Maximize flexibility — support many use cases | Extension points, configuration, loose coupling  |
| 3     | Optimize for the most common case             | Fast path for the 80% case, pragmatic trade-offs |

If agents aren't available, simulate the constraints yourself: design each approach sequentially
under the stated constraint.

**Inline mode — propose directly:**

For simple ideas with an obvious path, skip agents and propose 1-2 approaches inline with pros/cons.

### CHECKPOINT: Present approaches for discussion

Present approaches side by side — do not pick one yet:

```
Three designs explored under different constraints:

1. **[Minimal]** (simplest interface)
   - Approach: [description]
   - Pros / Cons / Trade-off

2. **[Flexible]** (maximum flexibility)
   - Approach: [description]
   - Pros / Cons / Trade-off

3. **[Pragmatic]** (common case optimized)
   - Approach: [description]
   - Pros / Cons / Trade-off

I recommend option [N] because [specific reason, especially codebase consistency].
The other designs revealed [insight the recommended approach should absorb].
```

**STOP here.** The comparison is the discussion artifact. Let the user react.

The user may:

- Pick an approach
- Ask to combine elements from multiple approaches
- Want to explore a direction not covered
- Raise concerns or trade-offs
- Ask for more detail on a specific approach

Iterate until the user signals satisfaction with a direction. Only then proceed to Step 3.

---

## Step 3: Challenge assumptions (opt-in)

After the approach is selected, offer challenge:

"Want me to load `cape:challenge` to stress-test this design for hidden assumptions, or skip
straight to the design summary?"

If the user wants challenge:

- Load `cape:challenge` with the Skill tool to surface hidden assumptions
- Challenge walks each assumption interactively — one per turn — with researched recommendations
- Confirmed assumptions become requirements or anti-patterns in the design summary
- Rejected ones trigger scope reductions or requirement changes

If the user skips, proceed directly to Step 4.

---

## Step 4: Lock design

Present the design summary. This summary must be self-contained — `cape:write-plan` should be able
to create the epic without re-asking brainstorm's questions.

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
Design summary complete. Next step: formalize into a br epic with `cape:write-plan`.
```

</the_process>

<agent_references>

## Divergent mode — 3 parallel design sub-agents:

Each sub-agent receives the same research context and designs under its assigned constraint:

- Agent 1: "Minimize the interface — simplest possible approach"
- Agent 2: "Maximize flexibility — support many use cases"
- Agent 3: "Optimize for the most common case"

If sub-agents aren't available, simulate constraints sequentially.

## Research protocol:

1. Codebase pattern exists → use it (unless clearly unwise)
2. No codebase pattern → research external patterns
3. Research yields nothing → ask user for direction

</agent_references>

<skill_references>

## Load `cape:design-an-interface` with the Skill tool when (interface mode):

- The core design question is about an interface, API surface, or module boundary
- Multiple viable interface shapes exist and the choice drives the architecture
- The user's idea is fundamentally about what callers should see

Its recommendation feeds into the design summary as the chosen approach.

## Load `cape:challenge` with the Skill tool when (opt-in):

- User accepts the challenge offer from Step 3
- The selected approach has assumptions worth stress-testing

Challenge walks each assumption interactively — confirmed assumptions become requirements or
anti-patterns in the design summary. Rejected ones trigger scope reductions.

</skill_references>

<examples>

<example>
<scenario>Brainstorm rushes through without stopping for discussion</scenario>

User: "Add template support to our Tiptap editor. We have a POC."

**Wrong:** Research POC + editor → ask intake questions → propose full implementation plan → present
design summary. The user never gets to discuss research findings or debate approaches — only answer
data-gathering questions. By the time they see the design, all decisions are made.

**Right:**

1. Research POC and current editor
2. CHECKPOINT: "Here's what I found — the POC has X, the editor currently does Y, existing patterns
   suggest Z. Anything to discuss before I propose approaches?"
3. User: "The POC also has feature W you missed" — adjusts understanding
4. Propose 3 approaches
5. CHECKPOINT: "I recommend option 2. What do you think?"
6. User: "Option 2 but let's drop the validation for now" — narrows scope
7. Offer challenge — user skips
8. Design summary with reduced scope
9. Stop: suggest `cape:write-plan` as next step </example>

<example>
<scenario>Developer skips research, proposes approach without checking codebase</scenario>

User: "Add OAuth authentication"

**Wrong:** "I'll implement OAuth with Auth0..." — proposes approach without checking that
passport.js already exists in the codebase. Creates inconsistent architecture.

**Right:**

1. Dispatch codebase-investigator: finds passport.js at auth/passport-config.ts
2. Dispatch internet-researcher: finds passport-google-oauth20 strategy
3. CHECKPOINT: present research summary — existing passport setup, available strategies
4. User discusses, confirms OAuth provider choice
5. Propose extending existing passport setup vs Auth0 vs custom JWT
6. CHECKPOINT: present comparison, recommend extending passport
7. User picks passport extension, asks about refresh tokens
8. Iterate on refresh token handling
9. Offer challenge — user accepts, 2 assumptions resolved
10. Design summary → stop </example>

<example>
<scenario>Complex design dispatches divergent agents</scenario>

User: "Build a plugin system for our CLI tool"

**Wrong:** Propose a single approach without exploring constraints.

**Right:** Research → CHECKPOINT (3 existing plugins found) → user confirms scope → divergent mode
(3 agents) → CHECKPOINT (compare, recommend pragmatic) → user picks hybrid → challenge surfaces
plugin discovery assumption → design summary with anti-pattern "NO DI framework (reason: 3 plugins
don't justify it)". </example>

<example>
<scenario>Anti-patterns prevent implementation shortcuts</scenario>

**Wrong:** Epic says "Tokens stored securely" with no anti-patterns. During implementation, hits
complexity → stores tokens in localStorage. No guardrail prevented it.

**Right:** Design summary says "Tokens stored in httpOnly cookies" with anti-pattern "NO
localStorage tokens (reason: httpOnly prevents XSS token theft)". When `write-plan` formalizes this
into an epic, the anti-pattern is preserved and blocks shortcuts during implementation. </example>

</examples>

<key_principles>

- **Research before proposing** — use agents to understand codebase and external context
- **Checkpoint after every step** — present findings, wait for user input, never auto-advance
- **Constraint-driven design** — competing constraints reveal trade-offs a single perspective misses
- **Scale effort to complexity** — divergent agents for complex ideas, inline for simple ones
- **Challenge is opt-in** — offer it, don't force it
- **Design summary is the handoff** — contains everything write-plan needs to create the epic
- **Anti-patterns prevent shortcuts** — every entry uses "NO X (reason: Y)" format
- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **Capture decisions** — Key Decisions table feeds the design summary
- **Document dead ends** — prevents wasted re-investigation during implementation </key_principles>

<critical_rules>

1. **Checkpoint after each step** — present findings/proposals and STOP. Never advance to the next
   step without user input. The user may discuss, redirect, iterate, or say "continue".
2. **Research BEFORE proposing** — use agents to understand context
3. **Never enter plan mode** — brainstorm is a conversation. If plan mode is active, exit it first.
4. **Divergent mode for complex ideas** — dispatch 3 constraint-driven design agents; inline for
   simple ideas with obvious paths
5. **Challenge is opt-in** — offer `cape:challenge` after approach selection, don't load
   automatically
6. **Include anti-patterns with reasoning** — "NO X (reason: Y)", not just "NO X"
7. **Stop after design summary** — present summary and wait for user to run write-plan
8. **Design summary must be self-contained** — write-plan should not need to re-ask questions

</critical_rules>
