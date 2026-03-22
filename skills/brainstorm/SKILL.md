---
name: brainstorm
description:
  Use BEFORE writing any code for new features, integrations, or system changes. Triggers when the
  user describes something to build, asks "how should I approach X", is unsure between approaches,
  or mentions adding/creating/building functionality. Also use when requirements are vague,
  architecture is unclear, or the task involves design decisions (e.g., choosing libraries, data
  models, API patterns). Do NOT use for bug fixes, refactoring, executing existing plans, or tasks
  where the implementation path is already clear. This skill researches the codebase, asks Socratic
  questions, generates competing designs under different constraints, challenges every assumption
  interactively, and produces a design summary for `cape:write-plan` to formalize into a br epic.
---

<skill_overview> Turn rough ideas into validated designs ready for `cape:write-plan` to formalize
into a `br` epic. Research the codebase, ask Socratic questions, generate competing designs under
different constraints, walk every branch of the decision tree, and produce a self-contained design
summary.

Core contract: no design gets locked without research, constraint-driven design exploration, and
interactive assumption challenge where every decision branch is resolved. </skill_overview>

<rigidity_level> HIGH FREEDOM — Adapt questioning style and research depth to context, but always:
research before proposing, validate design before stopping. </rigidity_level>

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

**Generate competing designs:**

Assess whether the idea warrants divergent exploration or has an obvious path:

- **Divergent mode** — the idea touches multiple components, has competing viable approaches, or
  involves architectural decisions. Dispatch 3 parallel design agents.
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

**Compare and recommend:**

After all three designs return, compare side by side:

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

Lead with recommended option. Explain why. Note useful ideas from rejected designs worth absorbing.

**Inline mode — propose directly:**

For simple ideas with an obvious path, skip agents and propose 1-2 approaches inline with pros/cons.

---

## Step 3: Lock design and stop

**Challenge assumptions — grill-me cadence:**

Before locking the design, walk every branch of the decision tree interactively. This builds shared
understanding through turn-by-turn interrogation rather than a one-shot assumption dump.

**Scale depth to complexity:** A boolean flag needs 1-2 branches. A notification system needs 4-5.
If Step 2 used inline mode (trivial task), keep the challenge to 1-2 branches covering only
non-obvious interactions (e.g., flag conflicts). If Step 2 used divergent mode (complex task), walk
up to 5 branches.

Protocol:

1. Identify all decision branches in the proposed design — architectural choices, scope boundaries,
   implicit constraints, technology bets, integration assumptions.
2. Present one question per turn. Include your recommended answer based on codebase research and the
   conversation so far.
3. Explore the codebase to answer your own questions when possible — only ask the user questions
   that require human judgment (priorities, preferences, business constraints).
4. Walk each branch: what happens if this assumption is wrong? What's the fallback? Is it
   reversible?
5. Continue until all branches are resolved or the cap is reached (whichever comes first).

Question format:

```
**Branch [N/total]: [Topic]**

[Context — why this matters for the design]

Recommended: [Your recommendation with reasoning]

a) [Recommendation] — [trade-off]
b) [Alternative] — [trade-off]
c) [Different direction] — [trade-off]
```

Termination:

- **Natural end:** all decision branches resolved — confirmed assumptions become requirements or
  anti-patterns, rejected ones trigger scope reductions or requirement changes
- **User escape:** reply "lock it" to end the challenge and proceed to design summary
- **Hard cap:** after reaching the depth limit (1-2 for inline mode, 5 for divergent mode),
  summarize remaining unresolved branches as open questions in the design summary

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

## Dispatch `cape:notebox-researcher` when:

- User mentions checking their notes or past research
- User references a topic they may have explored before
- You want to find past decisions relevant to the design

## Dispatch 3 parallel design sub-agents when (divergent mode):

- The idea touches multiple components or layers
- Multiple viable approaches exist with real trade-offs
- Architectural decisions need deliberate constraint exploration

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
<scenario>Complex design dispatches divergent agents, simple one skips them</scenario>

User: "Build a plugin system for our CLI tool"

**Wrong:** Propose a single approach without exploring constraints. Misses that a minimal plugin
interface would suffice for the three known plugins, while a flexible approach adds unnecessary
complexity.

**Right:**

1. Research reveals 3 existing plugins hardcoded in `src/plugins/`
2. Divergent mode — dispatch 3 design agents:
   - Agent 1 (minimal): expose a single `run(args)` function contract
   - Agent 2 (flexible): plugin registry with lifecycle hooks and dependency injection
   - Agent 3 (pragmatic): simple interface with optional hooks for two known extension points
3. Compare: Agent 3 covers real use cases without Agent 2's over-engineering
4. Grill-me: walk through plugin discovery, error handling, versioning — 3 rounds resolve all
5. Design summary locks pragmatic approach with anti-pattern "NO dependency injection framework
   (reason: 3 plugins don't justify a DI container)" </example>

<example>
<scenario>Epic created without anti-patterns — requirements get watered down during implementation</scenario>

**Wrong:** Epic says "Tokens stored securely" with no anti-patterns. During implementation, hits
complexity → stores tokens in localStorage. No guardrail prevented it.

**Right:** Design summary says "Tokens stored in httpOnly cookies" with anti-pattern "NO
localStorage tokens (reason: httpOnly prevents XSS token theft)". When `write-plan` formalizes this
into an epic, the anti-pattern is preserved and blocks shortcuts during implementation. </example>

</examples>

<key_principles>

- **Research before proposing** — use agents to understand codebase and external context
- **Constraint-driven design** — competing constraints reveal trade-offs a single perspective misses
- **Scale effort to complexity** — divergent agents for complex ideas, inline for simple ones
- **Challenge interactively** — one branch per turn, not a dump of all assumptions at once
- **Design summary is the handoff** — contains everything write-plan needs to create the epic
- **Anti-patterns prevent shortcuts** — every entry uses "NO X (reason: Y)" format
- **YAGNI ruthlessly** — remove unnecessary features from all designs
- **Capture decisions** — Key Decisions table feeds the design summary
- **Document dead ends** — prevents wasted re-investigation during implementation </key_principles>

<critical_rules>

1. **Research BEFORE proposing** — use agents to understand context
2. **Divergent mode for complex ideas** — dispatch 3 constraint-driven design agents; inline for
   simple ideas with obvious paths
3. **Grill-me before locking** — walk every decision branch interactively; do not skip to design
   summary
4. **Include anti-patterns with reasoning** — "NO X (reason: Y)", not just "NO X"
5. **Stop after design summary** — present summary and wait for user to run write-plan
6. **Design summary must be self-contained** — write-plan should not need to re-ask questions

</critical_rules>
