# Brainstorm: `doc-writer` agent

## Clarifying questions

Before building this agent, I would ask the following:

| # | Question | Default answer | Reasoning |
|---|----------|----------------|-----------|
| 1 | What kind of documentation? API reference docs, architectural overviews, usage guides, or all three? | API reference docs (function signatures, params, return values) | Narrowest useful scope; other types can be added later. |
| 2 | Should the agent write docs to files directly, or present them for the user to review first? | Present for review first | Matches the advisory role of existing agents (codebase-investigator, internet-researcher). Agents in this project inform and produce output; they don't autonomously write files unless dispatched to do so. |
| 3 | Which languages/file types should it prioritize? | Language-agnostic, but aware of common doc conventions (JSDoc, Godoc, LuaCATS, Python docstrings) | The cape plugin is used across projects in different languages. |
| 4 | Should it generate one doc per file, one doc per module/package, or a single consolidated doc? | One doc per module/package | Mirrors how most documentation tools work; per-file is too granular, consolidated is too unwieldy. |
| 5 | What model should it use? Existing agents use `haiku` for cost efficiency. | `haiku` | Consistent with codebase-investigator and internet-researcher. Documentation generation is largely synthesis, well-suited for a smaller model. |

Proceeding with the default answers above.

## Research findings

### Codebase patterns

**Agent file structure** (from `agents/codebase-investigator.md` and `agents/internet-researcher.md`):
- Markdown file in `agents/` directory
- YAML frontmatter with `name`, `description`, and `model` fields
- Role declaration as opening sentence
- Numbered approach section with clear behavioral guidelines
- A table providing scaled/tiered guidance
- Closing principle: "Lead with the direct answer... concise in reporting."

**Naming convention**: kebab-case filenames matching the `name` frontmatter field.

**Description convention**: Starts with "Use this agent when..." and describes the dispatch trigger.

**Tone**: Directive, second-person. Tells the agent what it is and how to behave.

### Existing agent responsibilities

| Agent | Role | Dispatched for |
|-------|------|----------------|
| `codebase-investigator` | Explore code to find patterns, structure, answers | Planning/design needing codebase understanding |
| `internet-researcher` | Find and synthesize web information | Planning/design needing external knowledge |
| `doc-writer` (proposed) | Read source files and produce markdown documentation | Generating API/module docs from code |

The doc-writer fills a distinct niche: it produces documentation artifacts rather than informing decisions.

## Proposed approach

### What the agent does

The `doc-writer` agent reads source files (via Read, Glob, Grep) and produces structured markdown documentation. It extracts:
- Module/package purpose
- Public API (exported functions, classes, types)
- Parameters, return values, and types
- Usage examples derived from existing tests or call sites
- Dependencies and relationships to other modules

### What the agent does NOT do

- Write files autonomously (presents docs for user review)
- Generate tutorials or guides (focused on API reference)
- Document private/internal implementation details unless asked
- Invent behavior not evident in the code

### Agent file structure

The file would be placed at `/home/sqve/code/personal/cape/agents/doc-writer.md` and follow the established pattern:

1. **Frontmatter**: `name: doc-writer`, description starting with "Use this agent when...", `model: haiku`
2. **Role declaration**: "You are a Doc Writer."
3. **Documentation approach**: Numbered steps covering how to read code, extract structure, and produce output
4. **Output format**: Standardized markdown template for generated docs
5. **Scale table**: Guidance for single-file vs module vs package-level documentation

### Key behaviors to encode

1. **Read before writing** -- Always read the actual source. Never guess at APIs or behavior.
2. **Follow existing doc conventions** -- If the project has JSDoc, Godoc, or other doc comments, extract and expand them rather than inventing from scratch.
3. **Structure consistently** -- Every doc output follows the same heading structure: Overview, API, Parameters, Returns, Examples, Related modules.
4. **Derive examples from tests** -- Look for test files and call sites to produce realistic usage examples.
5. **Flag gaps** -- If a public function lacks type info or has unclear behavior, flag it explicitly rather than guessing.

### Output format the agent would use

```markdown
# {Module name}

{One-sentence purpose.}

## API

### `functionName(param1, param2)`

{Brief description.}

**Parameters:**
- `param1` (`type`) -- {description}
- `param2` (`type`) -- {description}

**Returns:** `type` -- {description}

**Example:**
```{lang}
{usage example}
```

## Related modules

- `{related-module}` -- {relationship}
```

### Scale guidance

| Scope | Target | Strategy |
|-------|--------|----------|
| FILE | Single source file | Document every exported symbol, read tests for examples |
| MODULE | Directory or package | Document public API, summarize internal structure, show module-level usage |
| PACKAGE | Multi-module system | One overview doc linking to module docs, document cross-module interactions |

## Proposed plan

**Single deliverable**: Create `/home/sqve/code/personal/cape/agents/doc-writer.md`

The file contains the full agent definition following the established frontmatter + markdown body pattern. No other files need to change -- agents are auto-discovered from the `agents/` directory by the Claude Code plugin system.

### Anti-patterns to encode in the agent

- NO invented APIs (reason: documentation must reflect actual code, not assumptions)
- NO documenting private internals by default (reason: internal details change frequently and create maintenance burden)
- NO writing files without user review (reason: consistent with agent role as advisor, not autonomous actor)
- NO ignoring existing doc comments (reason: existing JSDoc/Godoc/LuaCATS annotations are authoritative; expand them, don't replace them)

### Success criteria

- [ ] Agent file exists at `agents/doc-writer.md`
- [ ] Frontmatter matches convention (`name`, `description`, `model`)
- [ ] Approach section covers: reading code, extracting structure, producing output, handling gaps
- [ ] Output format template included
- [ ] Scale table included
- [ ] Consistent tone and structure with existing agents
