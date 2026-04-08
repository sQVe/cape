---
name: explain
description: >
  Guided codebase walkthrough that builds understanding progressively. Use whenever the user asks to
  understand code — "explain", "how does X work", "walk me through", "what does this module do",
  "give me an overview", "I'm new to this part of the codebase", "teach me", or any question about
  how code flows, connects, or is structured. Covers everything from single functions to full system
  architecture. Do NOT use for investigating bugs (use debug-issue) or for internal agent queries
  about codebase state (that's codebase-investigator).
---

<skill_overview> Explain code by building understanding progressively — from entry points through
data flow to key decisions. Produces a narrative walkthrough with ASCII flow diagrams, not just a
file listing. Adapts depth to scope: a function gets a focused explanation, a system gets a layered
overview.

Core contract: every explanation traces real code paths. No hand-waving, no "it probably does X."
Read the code, then explain what it actually does. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — Adapt structure, depth, and diagram use to what the user asked.
Rigid rules: always read code before explaining it, always anchor claims to file:line references,
always match depth to scope. </rigidity_level>

<when_to_use>

- "How does X work?"
- "Explain the auth flow / payment module / build pipeline"
- "Walk me through this code"
- "What does this function / file / module do?"
- "I'm new to this part — give me an overview"
- "How are X and Y connected?"
- "What's the architecture of this system?"

**Don't use for:**

- Bug investigation (use debug-issue)
- Internal codebase queries from other skills (that's codebase-investigator agent)
- Design or planning questions (use brainstorm)
- Code review (use review)

</when_to_use>

<critical_rules>

1. **Read before explaining** — never describe code you haven't read in this session
2. **Anchor to source** — every claim references file:line
3. **Match depth to scope** — don't produce a 500-line walkthrough for a single function
4. **ASCII diagrams for flows** — when explaining how components connect or data moves, draw it
5. **Progressive disclosure** — start with the big picture, then zoom in where the user needs detail

</critical_rules>

<the_process>

## Step 1: Detect scope

Determine what the user is asking about and how deep they need to go.

| Scope  | Signal                                         | Depth                                         |
| ------ | ---------------------------------------------- | --------------------------------------------- |
| NARROW | Specific function, file, or code block         | Read it, explain inline, trace one level out  |
| MEDIUM | Module, feature, or component                  | Entry points, key files, internal flow        |
| BROAD  | System, architecture, or cross-cutting concern | Layered overview, major boundaries, key paths |

**Scope detection cues:**

- User points to a file or function → NARROW
- User names a feature ("the auth system", "how caching works") → MEDIUM
- User asks about architecture, system design, or how everything fits together → BROAD

If scope is ambiguous, start MEDIUM and offer to zoom in or out.

## Step 2: Research

Use code-review-graph when available to map relationships before reading files — see
`resources/graph-tools-instructions.md` for the tool catalog and fallback behavior. For NARROW
scope, `query_graph_tool` with `callers_of`/`callees_of` maps the immediate context. For
MEDIUM/BROAD, `get_impact_radius_tool` and `query_graph_tool` with `file_summary` reveal structure
faster than reading every file.

Dispatch `cape:codebase-investigator` to gather the raw material. Tailor the investigation prompt to
the detected scope:

**NARROW** — Read the target code. Identify callers, callees, and the data types flowing through.

**MEDIUM** — Find entry points, map the module's file structure, identify the key abstractions and
their relationships, trace the primary happy path.

**BROAD** — Map top-level directory structure, identify system boundaries (API layers, data stores,
external integrations), find the main entry points, trace one representative end-to-end flow.

If the investigator's findings leave gaps (unclear connections, missing context), dispatch a second
focused query or read the files directly. Don't explain what you haven't verified.

## Step 3: Build the walkthrough

Structure the explanation to build understanding progressively. The exact structure adapts to scope,
but the pattern is always: orient → trace → illuminate.

### NARROW structure

For a function or small code block:

1. **What it does** — one sentence, plain language
2. **Signature and types** — inputs, outputs, side effects
3. **Step-by-step logic** — walk through the implementation, referencing lines
4. **Context** — who calls this, when, why it exists
5. **Edge cases** — error paths, boundary conditions worth noting

### MEDIUM structure

For a module or feature:

1. **Purpose** — what problem this solves, in one paragraph
2. **Entry points** — where control enters this module (API routes, exported functions, event
   handlers)
3. **Key abstractions** — the main types, interfaces, or classes and what they represent
4. **Flow** — trace the primary path from entry to result, with an ASCII diagram
5. **Key decisions** — non-obvious design choices and why they were made (check git blame/comments
   if the reason isn't self-evident)
6. **Boundaries** — what this module depends on and what depends on it

### BROAD structure

For system or architecture:

1. **System purpose** — what the system does, who uses it
2. **High-level map** — ASCII diagram of major components and their boundaries
3. **Component inventory** — what each major component does (one sentence each)
4. **Representative flow** — trace one end-to-end request/operation through the system
5. **Cross-cutting concerns** — auth, logging, error handling, configuration
6. **Extension points** — where new functionality typically gets added

## Step 4: Draw ASCII diagrams

Use ASCII diagrams when explaining how components connect or data flows. Prefer simple box-and-arrow
diagrams. Always place the diagram near the explanation it supports, not at the end.

Flow diagram for a request path:

```
  Request
    │
    ▼
┌─────────┐    ┌──────────┐    ┌────────┐
│  Router  │───▶│ Handler  │───▶│  Store │
└─────────┘    └──────────┘    └────────┘
                    │
                    ▼
               ┌─────────┐
               │ Response │
               └─────────┘
```

Component boundary diagram:

```
┌─── api ──────────────────┐
│  routes/  →  handlers/   │
│       ↓                  │
│  middleware/              │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  services/               │
│  (business logic)        │
└──────────┬───────────────┘
           │
┌──────────▼───────────────┐
│  store/                  │
│  (data access)           │
└──────────────────────────┘
```

Keep diagrams compact. If a system has 15 components, show the 4-5 that matter for the explanation
and note what's omitted.

## Step 5: Deliver and offer depth

Present the walkthrough. End by offering to go deeper on specific parts:

- For NARROW: "Want me to trace into [callee] or show how [caller] uses this?"
- For MEDIUM: "I can go deeper on [specific component] or zoom out to show how this fits the broader
  system."
- For BROAD: "Pick any component and I'll walk through its internals."

This turns a single explanation into a conversation that follows the user's curiosity.

</the_process>

<agent_references>

## Research protocol:

1. Always dispatch `cape:codebase-investigator` for MEDIUM and BROAD scope
2. For NARROW scope, read the code directly — investigator adds overhead for a single function
3. If investigator results have gaps, follow up with targeted reads rather than a second dispatch
4. Never explain code you haven't read or had investigated in this session

</agent_references>

<examples>

<example>
<scenario>User asks about a specific function</scenario>

User: "What does the `resolveConfig` function in src/config.ts do?"

**Wrong:** Dispatch a full codebase investigation, produce a 200-line architectural overview. The
user asked about one function.

**Right:**

1. Scope: NARROW — specific function
2. Read src/config.ts, find resolveConfig
3. Explain: what it does, step through the logic with line references, note who calls it
4. Show the merge precedence as a simple flow:
   ```
   defaults → file config → env vars → CLI flags
       ↓          ↓           ↓          ↓
       └──────────┴───────────┴──────────┘
                      │
                 Final config
   ```
5. Offer: "Want me to trace into how the CLI flags are parsed, or show where this config gets
   consumed?"

</example>

<example>
<scenario>User wants to understand a module</scenario>

User: "Walk me through how the auth system works"

**Wrong:** Read one file, explain just the login handler, miss the token refresh flow and middleware
chain.

**Right:**

1. Scope: MEDIUM — feature/module
2. Dispatch codebase-investigator: find auth entry points, middleware, token handling, session
   storage
3. Structure the walkthrough:
   - Purpose: handles user authentication and session management
   - Entry points: POST /login, POST /refresh, auth middleware on protected routes
   - Key abstractions: Session, Token, AuthProvider interface
   - Flow: trace a login request from route through validation to token issuance, with ASCII diagram
   - Key decisions: why JWTs over sessions (check comments/commits), why the provider interface
     exists
   - Boundaries: depends on user store, consumed by every protected route
4. Offer to zoom into token refresh flow or the middleware chain

</example>

<example>
<scenario>User is new and wants an overview</scenario>

User: "I'm new to this repo, give me an overview of the architecture"

**Wrong:** List every file in the repo. Or give a surface-level "it's a web app with a frontend and
backend" without tracing actual code paths.

**Right:**

1. Scope: BROAD — full system
2. Dispatch codebase-investigator: map top-level structure, identify major boundaries, find main
   entry points
3. Structure the walkthrough:
   - System purpose: what it does and who uses it
   - ASCII diagram of major components and boundaries
   - Component inventory: one sentence per major piece
   - Trace one representative end-to-end flow (e.g., "what happens when a user creates an order")
   - Note cross-cutting patterns: how errors are handled, how config works, where tests live
4. Offer: "Pick any component and I'll walk through its internals"

</example>

</examples>

<key_principles>

- **Code-grounded** — every explanation traces real code paths with file:line references
- **Progressive** — orient first, then build complexity; never dump everything at once
- **Adaptive** — match depth and structure to what the user actually asked
- **Visual** — ASCII diagrams make flows and boundaries concrete
- **Conversational** — end with an offer to go deeper, letting the user steer

</key_principles>
