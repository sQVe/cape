---
name: design-an-interface
description: >
  Generate competing code interface designs (API surfaces, module boundaries, function signatures,
  type contracts) using parallel sub-agents with conflicting constraints. Use whenever the user asks
  to design an interface, API surface, module boundary, or type contract. Triggers on: "design an
  interface", "what should the API look like", "module boundary", "function signature", "type
  contract", "API surface", "how should callers interact with this", "what should this expose". Also
  triggers when brainstorm identifies the core design question as an interface shape question. Do
  NOT use for UI/UX design, full feature brainstorming where requirements are unclear (use
  cape:brainstorm), or implementing an already-designed interface (use cape:execute-plan).
---

<skill_overview> Generate competing interface designs under conflicting constraints, compare them
across depth, simplicity, flexibility, and implementation efficiency, then recommend the strongest.
Inspired by Ousterhout's "Design It Twice" and the deep modules concept: a small interface hiding
large implementation complexity is the goal; a large interface with thin implementation is the
anti-pattern.

Core contract: no interface recommendation without at least 3 competing designs explored under
different constraints, each with concrete code signatures, usage examples, and trade-off analysis.
</skill_overview>

<rigidity_level> MEDIUM FREEDOM — The research phase, parallel constraint agents, comparison
framework, and recommendation are non-negotiable. Research depth and number of agents (3 or 4) adapt
to complexity. </rigidity_level>

<when_to_use>

- User asks to design an interface, API surface, or module boundary
- User asks "what should callers see" or "how should X interact with Y"
- Brainstorm identifies the design question as fundamentally about interface shape
- Before implementation when the right abstraction boundary is unclear
- Choosing between competing API designs for a library or module

**Don't use for:**

- UI/UX design — visual interfaces, layout, components
- Full feature brainstorming with unclear requirements (use `cape:brainstorm`)
- Implementing an already-designed interface (use `cape:execute-plan`)

</when_to_use>

<the_process>

## Step 1: Gather requirements

**Research the codebase:**

Dispatch `cape:codebase-investigator` to understand:

- Existing interfaces and patterns the new interface must coexist with
- Callers — who will use this interface, how many call sites exist
- Adjacent modules — what related code exposes, naming conventions, error patterns
- Language idioms and framework conventions

Dispatch `cape:internet-researcher` if the interface involves well-known external patterns
(Repository, Builder, Strategy, etc.) or external API conventions.

If agents aren't available, investigate manually with Glob/Grep/Read and WebSearch/WebFetch.

**Collect requirements from the user:**

Ask only what the codebase and research can't answer. Confirm:

- **Problem solved** — what does this interface enable?
- **Intended callers** — who uses it, how many call sites?
- **Key operations** — what must callers be able to do?
- **What to hide vs expose** — implementation details that should stay internal
- **Hard constraints** — language, framework, backward compatibility, performance

Build a **requirements brief** from research findings and user answers. This brief is the shared
context all design agents receive.

---

## Step 2: Spawn parallel design agents

Dispatch 3-4 parallel sub-agents via the Agent tool. Each receives:

1. The requirements brief from Step 1
2. Research findings (codebase patterns, existing interfaces, caller analysis)
3. Its assigned constraint

| Agent | Constraint                                | Tendency                                                     |
| ----- | ----------------------------------------- | ------------------------------------------------------------ |
| 1     | Minimize method count — 1-3 methods max   | Deep module: small surface hiding large implementation       |
| 2     | Maximize flexibility — support many cases | Extension points, generics, configuration, loose coupling    |
| 3     | Optimize for the most common case         | Fast path for the 80% case, convenience over generality      |
| 4     | Ports & adapters (conditional)            | Dependency inversion, testability, swappable implementations |

**Agent 4 is conditional.** Dispatch only when the interface mediates between domain logic and an
external dependency (database, HTTP, filesystem, message queue, third-party API). Skip for pure
domain interfaces.

**Each agent must return:**

1. **Interface signature** — concrete code in the target language: types, function signatures,
   method sets
2. **Usage examples** — 2-3 code snippets showing callers using the interface for the common case
3. **Hidden complexity** — what the implementation handles that callers never see
4. **Trade-offs** — what this design sacrifices and what it optimizes for
5. **Depth assessment** — ratio of interface surface area to implementation complexity (deep = good)

**Instruct agents to be concise.** Signatures and examples only. No prose padding. Use
`model: sonnet` for design agents — constrained design exploration doesn't need the parent model.

**When designs converge:** If two or more agents produce essentially the same interface shape,
that's confirmation the shape is right. Note the convergence in the comparison rather than
manufacturing artificial differences. Convergence under conflicting constraints is a strong signal.

If agents aren't available, simulate the constraints yourself: design each approach sequentially
under the stated constraint.

---

## Step 3: Compare and recommend

After all designs return, compare side by side across these dimensions:

| Dimension              | What it measures                                       |
| ---------------------- | ------------------------------------------------------ |
| Simplicity             | Method count, parameter count, concept count           |
| Depth                  | Small interface hiding large complexity = good         |
| Common-case ergonomics | Lines of code for the 80% use case                     |
| Flexibility            | How many use cases supported without modification      |
| Implementation cost    | How complex the implementation behind the interface is |
| Codebase consistency   | How well it fits existing patterns and conventions     |

**Start with a comparison table**, then expand each design:

```
## Interface comparison

| Dimension              | 1. Minimal       | 2. Flexible         | 3. Pragmatic        | 4. P&A (if any)     |
| ---------------------- | ---------------- | ------------------- | ------------------- | ------------------- |
| Simplicity             | [methods, types] | [methods, types]    | [methods, types]    | [methods, types]    |
| Depth                  | [rating]         | [rating]            | [rating]            | [rating]            |
| Common-case ergonomics | [N lines]        | [N lines]           | [N lines]           | [N lines]           |
| Flexibility            | [assessment]     | [assessment]        | [assessment]        | [assessment]        |
| Implementation cost    | [assessment]     | [assessment]        | [assessment]        | [assessment]        |
| Codebase consistency   | [assessment]     | [assessment]        | [assessment]        | [assessment]        |

### 1. [Minimal] (1-3 methods)
[code block — interface signature in target language]
Trade-off: [one sentence]

### 2. [Flexible] (extension points)
[code block]
Trade-off: [one sentence]

### 3. [Pragmatic] (common case optimized)
[code block]
Trade-off: [one sentence]

### 4. [Ports & adapters] (if dispatched)
[code block]
Trade-off: [one sentence]

## Recommendation

I recommend design [N] because [rationale — especially codebase consistency and depth].

**Absorbed from other designs:**
- [Specific idea from a rejected design worth incorporating]

**Anti-patterns from this analysis:**
- NO [pattern] (reason: [insight from comparison])
```

Lead with the recommendation. Explain why. Note useful ideas from rejected designs worth absorbing
into the recommended interface. Call out anti-patterns revealed by the exploration.

---

## Step 4: Hand off

**Standalone mode:**

Present the recommended interface with its signature, usage examples, and anti-patterns.

```
Interface design complete.

To build this, run `/cape:brainstorm` to create a full design
(the interface recommendation carries forward), or `/cape:write-plan`
if a design summary already exists.
```

**Called by brainstorm:**

Return the comparison and recommendation to brainstorm's Step 2. The recommended interface becomes
the "Chosen approach" in the design summary. Rejected designs become "Approaches considered."

</the_process>

<agent_references>

## Dispatch `cape:codebase-investigator` when:

- Understanding existing interfaces the new one must coexist with
- Finding callers, adjacent modules, naming conventions
- Verifying that proposed signatures match language and framework idioms

## Dispatch `cape:internet-researcher` when:

- The interface involves well-known patterns (Repository, Builder, Strategy)
- External API patterns or library conventions are relevant
- Community best practices for the interface type exist

## Dispatch 3-4 parallel design sub-agents:

- Always — this is the core of the skill
- Each receives requirements brief + research context + its constraint
- Agent 4 (Ports & adapters) only when the interface mediates an external dependency

If agents aren't available, simulate constraints sequentially.

</agent_references>

<examples>

<example>
<scenario>Database access scattered across service files</scenario>

User: "Design the interface for our database access layer. We have PostgreSQL and raw SQL scattered
across service files."

**Wrong:** Propose a Repository pattern with one method per entity. Skips constraint exploration.
Produces a shallow interface (12 methods mirroring SQL queries) that hides nothing.

**Right:**

1. Dispatch codebase-investigator: finds raw SQL in 12 files, 5 common query patterns, existing
   error type at `pkg/errors.go`
2. Dispatch 4 agents (Agent 4 fires — database is an external dependency):
   - Agent 1 (minimal): `Query(ctx, sql, args) → Rows` + `Exec(ctx, sql, args) → Result` — 2 methods
   - Agent 2 (flexible): generic `Repository[T]` with `Find`, `Save`, `Delete`, query builder
   - Agent 3 (pragmatic): typed methods for the 5 common operations, raw escape hatch
   - Agent 4 (ports & adapters): `Store` interface with `PostgresStore` adapter
3. Compare: Agent 1 is deepest (2 methods hiding all SQL complexity) but callers write raw SQL.
   Agent 4 adds testability that Agent 3 lacks. Recommend Agent 3 with Agent 4's interface boundary
   absorbed — typed methods behind an interface.
4. Anti-pattern: "NO generic Repository (reason: 5 concrete query patterns don't justify generics)"
   </example>

<example>
<scenario>Event system for a CLI tool with 3 event types</scenario>

User: "What should the event system interface look like for our CLI tool?"

**Wrong:** Design a full pub/sub system with topics, filters, and replay. The CLI has 3 event types.

**Right:**

1. Dispatch codebase-investigator: finds 3 event types, no existing event infrastructure, 4 call
   sites that would emit events
2. Dispatch 3 agents (skip Agent 4 — pure domain interface):
   - Agent 1 (minimal): `Emit(event)` + `On(type, handler)` — 2 methods
   - Agent 2 (flexible): middleware chains, wildcard matching, typed event bus with generics
   - Agent 3 (pragmatic): `Emit(event)` + per-type `OnBuild(handler)`, `OnTest(handler)` methods
3. Compare: Agent 1 is deepest — 2 methods hide all dispatch logic. Agent 3 adds type safety at the
   cost of a method per event type. Agent 2 is over-engineered for 3 events.
4. Recommend Agent 1. Anti-pattern: "NO event middleware (reason: 3 event types don't justify a
   middleware pipeline)" </example>

<example>
<scenario>Brainstorm delegates during plugin system design</scenario>

User starts with "I want to add a plugin system to our CLI tool." Brainstorm runs Step 1 (research,
questions) and identifies the core question as "what does the plugin contract look like."

**Wrong:** Brainstorm runs its generic divergent mode. Produces 3 high-level architecture sketches
without concrete plugin interface signatures.

**Right:** Brainstorm delegates to design-an-interface. Design-an-interface runs Steps 1-3 with
focused interface exploration. Returns a comparison with concrete signatures:
`Plugin { Name() string; Run(ctx) error }` recommended for depth. Brainstorm incorporates this as
the chosen approach in its design summary. </example>

</examples>

<key_principles>

- **Deep modules over shallow** — a small interface hiding large complexity is the goal; flag large
  interfaces with thin implementations as a warning sign
- **Design it twice (at least)** — competing constraints reveal trade-offs a single perspective
  misses; even when one approach seems obvious, the exploration confirms it
- **Concrete signatures, not hand-waving** — every design must include real code in the target
  language, not prose descriptions of what methods might exist
- **Usage examples reveal truth** — an interface that looks clean in isolation but requires 15 lines
  of setup for the common case is not clean
- **Codebase consistency matters** — the best interface in isolation may be wrong if it clashes with
  existing patterns and conventions
- **Anti-patterns from exploration** — rejected designs teach what NOT to do; capture these
  explicitly with "NO X (reason: Y)" format

</key_principles>

<critical_rules>

1. **Always spawn 3+ constraint agents** — never skip the divergent exploration, even if one
   approach seems obvious
2. **Every design needs concrete code** — interface signatures in the target language, not prose
3. **Include usage examples** — 2-3 caller snippets per design showing the common case
4. **Assess depth** — every design gets a depth rating comparing interface surface to hidden
   complexity
5. **Research before designing** — dispatch codebase-investigator before spawning design agents
6. **Code interfaces only** — API surfaces, module boundaries, type contracts; redirect UI design
   questions to the user

</critical_rules>
