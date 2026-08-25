---
name: brainstorm
description: >
  Explore a design before any code is written. Use when the user describes something to build and
  the approach or requirements are unclear. Not for bug fixes or tasks with an obvious
  implementation path.
---

# Brainstorm

Turn a rough idea into a validated design that `cape:write-plan` can formalize into a Linear tracker
epic. The output is a self-contained design summary built from codebase research, Socratic
questioning, and competing constraint-driven designs.

Questioning style and research depth adapt to the idea. What never changes: research comes before
proposals, every step ends at a checkpoint, and the user decides when to advance.

## Rules

1. **Stop at every checkpoint.** Present findings and wait. The user may discuss, redirect, iterate,
   or say "continue". Never advance on your own.
2. **Never enter plan mode.** Brainstorm is a conversation, not a plan artifact. If plan mode is
   active, exit it first. The design summary lives in conversation context; `cape:write-plan`
   formalizes it later.
3. **Answer your own questions first.** If code or research can answer a question, read the code. If
   the answer is observable, probe for it: run the command, read the output, check the actual data.
   Ask the user only what requires human judgment: priorities, preferences, business constraints.
4. **Anti-patterns carry reasons.** Write "NO X (reason: Y)", never a bare "NO X".
5. **The design summary is self-contained.** `cape:write-plan` must be able to create the epic
   without re-asking brainstorm's questions.
6. **Stop after the summary.** The user runs write-plan; you do not.

## Process

### 1. Check for ready work

Run `cape tracker show` before anything else. If it lists ready tasks, ask: "You have N ready
task(s): [list]. Did you mean to continue with execute-plan instead of starting a new brainstorm?"
If the user redirects, load `cape:execute-plan` with the Skill tool and stop. If they confirm
brainstorm, continue. A missing or stale cache follows the `cape:tracker` cache rule: treat it as
empty.

Once brainstorming is confirmed, signal the phase for the herdr rail: `cape workspace phase plan`
(safe no-op outside herdr).

### 2. Research and clarify

Run `cape git context` for recent commits and codebase state, and check existing docs and structure.
Dispatch `cape:codebase-investigator` in default mode (model: haiku) to find existing patterns
relevant to the idea. Dispatch `cape:internet-researcher` (model: sonnet) if the idea involves
external APIs, libraries, or unfamiliar tech. Without agents, investigate manually with Glob, Grep,
Read, WebSearch, and WebFetch.

Then ask what research could not answer. Use AskUserQuestion for structured choices (token storage,
auth strategy, data model decisions) and conversational follow-ups for open exploration (what
problem, who are the users, what does success look like). Ask 1-5 questions per round, and only
frontier questions: ones whose prerequisites are settled. A question that depends on an open one
waits for a later round. Research still in flight holds only the questions that depend on it;
questions it cannot answer still go out this round, and its results fold in next round. Prefer
multiple choice with a recommended default, separate must-answer questions from ones with good
defaults, and offer "Reply 'defaults' to accept all recommended options" when a batch has clear
defaults.

Record every answer in a running key decisions table. It feeds the design summary:

| Question         | Answer           | Implication                                |
| ---------------- | ---------------- | ------------------------------------------ |
| [What you asked] | [What user said] | [How it shapes requirements/anti-patterns] |

### 3. STOP: present research

Present findings without proposing solutions:

```
## Research summary

**Codebase:** [existing patterns, relevant files, constraints discovered]
**External:** [API docs, library capabilities, if researched]
**Dead ends:** [what you explored, what you found, why it's not relevant]
**Key decisions so far:** [table of user answers]
```

Ask "Anything to discuss or redirect before I propose approaches?" and wait.

### 4. Propose approaches

First derive three to six criteria a design can be graded on, each traced to a research finding or a
key decision. Name the thing this idea actually turns on: "survives an offline client", "migrates
the 40k existing rows without a backfill window", "one place to change when the vendor renames a
field". Criteria that would fit any project, like blast radius or maintainability, mean you skipped
the step. Every approach gets scored against them in step 5.

Then pick a mode. Divergent: the idea touches multiple components, has competing viable approaches,
or involves architectural decisions beyond interface shape. Inline: single-file change, one obvious
pattern to follow, trivial scope. In inline mode, propose 1-2 approaches directly.

In divergent mode, dispatch 3 parallel design agents. Each gets the same research context (codebase
findings, external docs, key decisions), the criteria, and one constraint:

| Agent | Constraint               | Tendency                                         |
| ----- | ------------------------ | ------------------------------------------------ |
| 1     | Minimize the interface   | Fewest moving parts, smallest public API         |
| 2     | Maximize flexibility     | Extension points, configuration, loose coupling  |
| 3     | Optimize the common case | Fast path for the 80% case, pragmatic trade-offs |

Without agents, design each approach yourself, sequentially, under the stated constraint.

Screen every candidate, dispatched or self-designed, for four module smells:

| Smell                  | Test                                                        |
| ---------------------- | ----------------------------------------------------------- |
| Shallow module         | The interface is as large as the implementation it hides    |
| Information leakage    | One decision several components must know                   |
| Temporal decomposition | Structure mirrors execution order, not knowledge boundaries |
| Pass-through method    | A layer that only forwards                                  |

A hit is a cost to weigh, not a veto. Carry it into the comparison and say what it buys.

### 5. STOP: choose a direction

Present the approaches side by side. Recommending one is fine, and saying which you would pick is
usually more useful than withholding it; the decision still belongs to the user. One column and one
line per approach step 4 produced: three in divergent mode, one or two inline.

```
[N] design(s) explored, scored against the criteria:

| Criterion   | [Design 1]    | [Design 2]    | [Design 3]    |
| ----------- | ------------- | ------------- | ------------- |
| [Criterion] | [score + why] | [score + why] | [score + why] |

One column per approach step 4 produced, so drop the unused columns in inline mode.

1. **[Name]** ([its constraint]): [approach]. Trade-off: [x]. Smells: [hits, or none]

I recommend option [N] because [specific reason, especially codebase consistency].
The other designs revealed [insight the recommended approach should absorb].
```

With a single design there is no runner-up line: say why it holds against each criterion instead.

The comparison is the discussion artifact. The user may pick one, combine several, explore a new
direction, or raise concerns. Iterate until they settle on a direction.

### 6. Audit assumptions

Offer: "Want me to stress-test this design for hidden assumptions, one at a time, or skip straight
to the design summary?" If the user skips, go to step 7.

If they accept:

1. Review the chosen approach, prior decisions, and codebase findings. Dispatch
   `cape:codebase-investigator` in default mode (model: haiku) when codebase evidence could settle a
   question. Resolve assumptions silently when evidence answers them; show only those needing human
   judgment.
2. Scan for scope creep, implicit constraints, unstated requirements, hidden dependencies,
   over-engineering, and under-specification. Rank by impact and reversibility, high first. Skip
   low-risk items when the design is simple, never high-risk ones.
3. Walk assumptions one per turn:

```
**Assumption [N/total]: [Topic]** [Risk]

[Context: why this matters and what research or codebase evidence showed]

Recommended: [Recommendation and reasoning]

a) [Recommendation] with [trade-off]
b) [Alternative] with [trade-off]
c) [Different direction] with [trade-off]
```

"Lock it" ends the audit early. Before moving on, summarize confirmed constraints, rejected
assumptions, and remaining open questions. Confirmed assumptions become requirements or
anti-patterns in the design summary; rejected ones trigger scope reductions, requirement changes, or
revised architecture first.

### 7. Lock the design

Compose the design summary internally. Do not present it yet.

```
## Design summary

**Problem:** [1-2 sentences]
**Chosen approach:** [Name + rationale]
**Requirements:** [Bullet list derived from decisions]
**Anti-patterns:** [Bullet list in "NO X (reason: Y)" format]
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

1. **[Chosen]** (selected): [why]
2. **[Rejected].** [why rejected, DO NOT REVISIT UNLESS]

### Dead ends

[What explored, what found, why abandoned]
```

Dispatch `cape:fact-checker` (model: sonnet) on the composed summary, passing the factual claims
from Requirements, Architecture, and Research findings. It verifies each claim against codebase
evidence (`file:line`) and external sources (`URL, Tier N`). Keep confirmed claims, correct or
remove refuted ones, update partially correct ones, and move unverifiable ones to open questions.

Run the summary's prose through the `cape:unslop` skill before presenting.

Present the fact-checked summary, then hand off:

```
Design summary complete (fact-checked). Next step: formalize into a Linear tracker epic with
`cape:write-plan`.
```

## Examples

**Wrong:** "Add OAuth authentication" gets an immediate "I'll implement OAuth with Auth0". Nobody
checked that passport.js already lives at auth/passport-config.ts, so the design fights the existing
architecture.

**Right:** Codebase research finds the passport setup, internet research finds the
passport-google-oauth20 strategy. The comparison pits extending passport against Auth0 and custom
JWT, recommends extending, and the user picks it after iterating on refresh token handling.

**Wrong:** Research, intake questions, then a full design summary in one turn. The user only ever
answered data-gathering questions; every design decision was made for them.

**Right:** Each step ends at a checkpoint. At the research stop the user corrects a missed POC
feature; at the comparison stop they cut validation from scope. The summary reflects both.
