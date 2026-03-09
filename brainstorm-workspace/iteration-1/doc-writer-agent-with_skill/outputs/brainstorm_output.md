# Brainstorm: doc-writer agent

I'm using the brainstorming skill to refine your idea into a design.

## Step 1: Understand the idea

### Research findings

**Codebase investigation (manual, agents not available):**

Explored the `agents/` directory. Two existing agents provide the pattern:

- `/home/sqve/code/personal/cape/agents/codebase-investigator.md` — Frontmatter with `name`, `description`, `model`. Body defines role, approach sections, structured tables for scaling behavior. Uses Glob/Grep/Read tools.
- `/home/sqve/code/personal/cape/agents/internet-researcher.md` — Same frontmatter pattern. Body defines role, approach sections, source tier table. Uses WebSearch/WebFetch/Context7 tools.

**Key patterns discovered:**

| Pattern | Detail |
|---------|--------|
| Frontmatter fields | `name`, `description`, `model` (both use `haiku`) |
| File naming | Kebab-case `.md` in `agents/` |
| Structure | Role statement, numbered approach sections, structured tables, concise reporting directive |
| Tool usage | Each agent uses specific tools relevant to its domain |
| Closing line | "Lead with the direct answer. [specifics]. Be [quality] in [activity], concise in reporting." |

**Plugin registration:** `settings.json` is empty `{}` and `.claude-plugin/plugin.json` has no agent references. Agents are discovered by file convention in `agents/`.

### Clarifying questions

Since no human is present, I list the questions I would ask and provide reasonable defaults.

**Critical questions:**

1. **What source languages should the agent handle?**
   - (a) Language-agnostic (reads any source file) **(recommended)**
   - (b) Specific languages only (TypeScript, Go, Lua, etc.)
   - (c) User specifies per invocation

   **Default answer:** (a) Language-agnostic. The agent reads source files and infers structure regardless of language.

2. **What kind of documentation should it produce?**
   - (a) API reference docs (function signatures, params, return types)
   - (b) Narrative/conceptual docs (how things work, architecture)
   - (c) Both, determined by context **(recommended)**

   **Default answer:** (c) Both. The agent determines the appropriate style based on what it reads.

3. **Where should generated docs be written?**
   - (a) Alongside source files (co-located)
   - (b) Dedicated `docs/` directory **(recommended)**
   - (c) User specifies output path

   **Default answer:** (b) Dedicated `docs/` directory, but the agent should respect existing project conventions if a docs directory already exists.

4. **Should the agent update existing docs or only create new ones?**
   - (a) Create only (never overwrite)
   - (b) Update existing docs to match current source **(recommended)**
   - (c) Ask before overwriting

   **Default answer:** (b) Update existing docs. The agent should detect existing documentation and update it to reflect current source state.

**Nice-to-have questions:**

5. **Should the agent follow a specific doc standard (JSDoc, Godoc, etc.)?**

   **Default answer:** No specific standard enforced. The agent should match the target language's conventional documentation style and any existing project conventions.

### Key decisions table

| Question | Answer | Implication |
|----------|--------|-------------|
| Language support? | Language-agnostic | Agent must infer structure from any source, no hardcoded parsers |
| Doc type? | Both API reference and narrative | Agent needs to determine appropriate style per context |
| Output location? | Dedicated docs/ directory, respecting project conventions | Agent checks for existing docs dir before creating one |
| Update existing? | Yes, update to match current source | Agent must read existing docs, diff against source, update |
| Doc standard? | Match language conventions and project patterns | Agent checks existing docs for style before generating |

---

## Step 2: Research and propose approaches

### Approach 1: Mirror existing agent pattern with doc-specific tools (recommended)

Create `agents/doc-writer.md` following the exact frontmatter and structural pattern of `codebase-investigator.md` and `internet-researcher.md`. The agent uses Read/Glob/Grep to analyze source files, then Write to produce markdown documentation. It follows a systematic approach: read source, identify public API surface, check for existing docs, generate or update markdown.

**Pros:**
- Matches existing codebase pattern exactly (frontmatter, structure, tools)
- Simple single-file addition, no new infrastructure
- Uses tools already available in Claude Code (Read, Glob, Grep, Write)
- Consistent with how other agents in cape work

**Cons:**
- Agent quality depends entirely on prompt engineering in the markdown file
- No programmatic parsing of source code (relies on LLM comprehension)

### Approach 2: Agent with companion skill

Create the agent file plus a `skills/doc-writer/SKILL.md` that defines a structured documentation workflow (analyze, outline, draft, review). The agent would reference the skill for complex documentation tasks.

**Pros:**
- More structured process for large documentation tasks
- Skill can define templates and quality criteria

**Cons:**
- Overengineered for the request ("add a new agent")
- No existing need demonstrated; YAGNI
- Can always add a skill later if the agent proves insufficient

### Approach 3: Agent with external tool integration

Create the agent and have it shell out to external doc generators (typedoc, godoc, etc.) then post-process the output.

**Pros:**
- Leverages existing doc tooling for accuracy

**Cons:**
- Requires external tools to be installed
- Breaks the pattern of other cape agents (none require external deps)
- Tightly couples to specific languages, contradicts language-agnostic decision

**Recommendation:** Approach 1. It follows the established pattern, solves the stated need, and avoids premature complexity. A skill can be added later if needed.

### Dead-end paths

#### External doc generators
**Why explored:** Tools like typedoc/godoc produce accurate output.
**What found:** Would require external dependencies and language-specific configuration. Other cape agents have zero external deps.
**Why abandoned:** Breaks the zero-dependency convention of existing agents. The LLM can read source directly.

---

## Step 3: Design validation

### Architecture

Single file: `agents/doc-writer.md`

**Components:**
- Frontmatter: `name: doc-writer`, `description`, `model: haiku`
- Role statement defining the agent as a documentation generator
- Documentation approach (numbered steps): scan source, identify API surface, check existing docs, generate/update markdown
- Output format guidelines (headings, code blocks, examples)
- Scale table (single file vs module vs full project)
- Closing directive matching existing pattern

**Data flow:**
1. Caller dispatches `cape:doc-writer` with target files/directories
2. Agent uses Glob to find source files
3. Agent uses Read to analyze source code
4. Agent uses Grep to find existing documentation
5. Agent uses Read to check existing doc style/conventions
6. Agent uses Write to create/update markdown documentation

**Integration points:**
- Can be dispatched by the brainstorm skill or any other workflow
- Follows same dispatch pattern as `cape:codebase-investigator` and `cape:internet-researcher`

---

## Step 4: Epic and first task

### Epic

```
br create "Epic: doc-writer agent" \
  --type epic \
  --priority 2 \
  --description "## Requirements (IMMUTABLE)
- Agent file at agents/doc-writer.md follows existing agent frontmatter pattern (name, description, model fields)
- Agent reads source files using Read/Glob/Grep and produces markdown documentation using Write
- Agent is language-agnostic: works with any source language without hardcoded parsers
- Agent produces both API reference and narrative documentation based on context
- Agent checks for and respects existing documentation conventions in the target project
- Agent updates existing docs rather than only creating new ones
- Output defaults to a docs/ directory, respecting existing project structure

## Success criteria
- [ ] agents/doc-writer.md exists and follows the frontmatter pattern of codebase-investigator.md and internet-researcher.md
- [ ] Agent defines a clear multi-step documentation approach (scan, analyze, check existing, generate/update)
- [ ] Agent includes output format guidelines (markdown structure, code blocks, examples)
- [ ] Agent includes a scale table for single-file vs module vs project scope
- [ ] Agent file has no external dependencies
- [ ] Agent can be dispatched as cape:doc-writer

## Anti-patterns (FORBIDDEN)
- NO hardcoded language parsers (reason: agent must be language-agnostic, LLM reads source directly)
- NO external tool dependencies (reason: existing agents have zero deps, agent uses only Read/Glob/Grep/Write)
- NO generating docs without checking existing docs first (reason: must respect project conventions and avoid style inconsistency)
- NO creating files outside the target project's doc location (reason: must respect project structure, check for existing docs/ or similar)
- NO inventing API details not present in source (reason: documentation must be grounded in actual code, not hallucinated)
- NO deviating from existing agent frontmatter pattern (reason: consistency with codebase-investigator.md and internet-researcher.md)

## Approach
Create a single agents/doc-writer.md file following the exact structural pattern of the two existing agents. The file uses frontmatter with name, description, and model fields. The body defines the agent's role as a documentation generator, provides a numbered approach for systematic doc generation (scan source, identify API surface, check existing docs, generate/update markdown), includes output format guidelines, and scales by scope using a table. The agent relies exclusively on Read/Glob/Grep for analysis and Write for output.

## Architecture
- agents/doc-writer.md - Single agent definition file
- Tools used: Read (source analysis), Glob (file discovery), Grep (pattern/doc search), Write (doc output)
- Dispatch: cape:doc-writer (follows existing convention)

## Design rationale

### Problem
Cape has agents for investigating codebases and researching external information, but no agent for generating documentation from source code. Users who want markdown docs from their code must manually write them or prompt Claude without a structured approach.

### Research findings

**Codebase:**
- agents/codebase-investigator.md:1-41 - Agent pattern: frontmatter (name, description, model: haiku), role statement, numbered approach, scale table, closing directive
- agents/internet-researcher.md:1-43 - Same pattern, different domain. Confirms the convention.
- .claude-plugin/plugin.json - No agent registration needed; discovery is by file convention
- settings.json - Empty, no configuration needed for agents

**External:**
- No external research needed; this is a pattern replication task within the existing codebase

### Approaches considered

#### 1. Mirror existing agent pattern (selected)

**What:** Single agents/doc-writer.md following the exact structure of existing agents. Uses Read/Glob/Grep/Write. No external deps.
**Pros:** Matches codebase pattern exactly, single-file change, zero dependencies, consistent with cape conventions.
**Cons:** Quality depends on prompt engineering.
**Chosen because:** Directly follows established pattern in agents/, minimal change, solves the stated need.

#### 2. Agent with companion skill (rejected)

**What:** Agent file plus skills/doc-writer/SKILL.md defining a structured documentation workflow.
**Why explored:** Could provide more structured process for large documentation tasks.
**Why rejected:** YAGNI. The request is to add an agent. A skill can be added later if the agent proves insufficient.
**DO NOT REVISIT UNLESS:** Users report the agent alone is insufficient for complex documentation tasks.

#### 3. Agent with external tool integration (rejected)

**What:** Agent that shells out to typedoc, godoc, etc.
**Why explored:** External tools produce accurate, complete output.
**Why rejected:** Breaks zero-dependency convention, couples to specific languages, contradicts language-agnostic requirement.
**DO NOT REVISIT UNLESS:** Language-agnostic requirement is dropped AND external tools are acceptable as cape dependencies.

### Scope boundaries

**In scope:** Agent definition file, documentation generation approach, output format guidelines, scale handling.
**Out of scope:** Companion skill (deferred, YAGNI), external tool integration (rejected), doc hosting/serving, CI integration.

### Open questions
- Should the agent suggest a table of contents for multi-file documentation?
- How should the agent handle undocumented private/internal functions?

## Design discovery

### Key decisions made

| Question | Answer | Implication |
|----------|--------|-------------|
| Language support? | Language-agnostic | No hardcoded parsers, anti-pattern enforced |
| Doc type? | Both API reference and narrative | Agent determines style per context |
| Output location? | docs/ directory, respecting conventions | Agent checks existing structure first |
| Update existing? | Yes | Agent reads existing docs before writing |
| Doc standard? | Match project conventions | Agent checks existing docs for style |
| Model? | haiku (matches existing agents) | Consistent with codebase-investigator and internet-researcher |

### Research deep-dives

#### Existing agent pattern
**Question:** What is the exact structure and convention for cape agents?
**Sources:** agents/codebase-investigator.md, agents/internet-researcher.md (Tier 0 - source code)
**Conclusion:** Agents use YAML frontmatter (name, description, model: haiku), define a role, use numbered approach sections, include a structured table, and end with a concise reporting directive. The doc-writer agent must follow this pattern exactly.

### Dead-end paths

#### External doc generators
**Why explored:** Tools like typedoc produce complete, accurate documentation.
**What found:** Would require external dependencies installed on user machines. No existing cape agent requires external tools.
**Why abandoned:** Violates zero-dependency convention and language-agnostic requirement.

### Open concerns raised
- Multi-file table of contents? -> Defer to implementation; agent can include guidance without mandating it
- Private function handling? -> Default to documenting public API only, mention privates only when they clarify public behavior"
```

### First task

```
br create "Task 1: Create agents/doc-writer.md" \
  --type feature \
  --priority 2 \
  --parent [epic-id] \
  --description "## Goal
Create the doc-writer agent definition file following the established agent pattern.

## Implementation
1. Study existing agents
   - agents/codebase-investigator.md:1-41 - Frontmatter pattern, role statement, numbered approach, scale table, closing directive
   - agents/internet-researcher.md:1-43 - Same pattern, confirms convention

2. Create agents/doc-writer.md with:
   - Frontmatter: name (doc-writer), description, model (haiku)
   - Role statement: documentation generator that reads source and produces markdown
   - Numbered approach sections:
     1. Scan and discover: Use Glob to find source files, Read to understand structure
     2. Check existing docs: Use Grep/Glob to find existing documentation, Read to understand style
     3. Analyze source: Identify public API surface, key types, module structure
     4. Generate documentation: Write markdown with appropriate headings, code examples, parameter docs
     5. Verify completeness: Cross-reference generated docs against source to catch gaps
   - Output format guidelines (heading structure, code blocks, example inclusion)
   - Scale table (single file / module / full project)
   - Closing directive matching existing agent pattern

3. Implementation checklist
   - [ ] agents/doc-writer.md - Agent definition with correct frontmatter
   - [ ] Frontmatter matches pattern: name, description, model: haiku
   - [ ] Role statement defines documentation generation purpose
   - [ ] Numbered approach covers scan, check existing, analyze, generate, verify
   - [ ] Scale table included with three scope levels
   - [ ] Closing directive matches existing agent convention
   - [ ] No external dependencies referenced

## Success criteria
- [ ] agents/doc-writer.md exists with valid frontmatter (name, description, model)
- [ ] Structure mirrors codebase-investigator.md and internet-researcher.md
- [ ] Agent can be dispatched as cape:doc-writer
- [ ] No external tool dependencies
- [ ] Pre-commit hooks passing"
```
