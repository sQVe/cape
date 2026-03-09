# Brainstorm: Changelog CLI command

I'm using the brainstorming skill to refine your idea into a design.

## Step 1: Understand the idea

### Codebase investigation

**Findings:**

- **Cape is a Claude Code plugin** (`.claude-plugin/plugin.json`), not a standalone CLI. It exposes slash commands via `commands/`, skills via `skills/`, agents via `agents/`, and hooks via `hooks/`.
- **Existing command pattern:** `commands/brainstorm.md` is a markdown file with YAML frontmatter (`description`) that delegates to a skill. Commands are invoked as `/cape:name`.
- **No shell scripts or executables exist** besides `hooks/session-start.sh`. Cape has no binary CLI entry point.
- **CHANGELOG.md already exists** at repo root, following Keep a Changelog format with semantic versioning.
- **Commit convention:** `type: description` (e.g., `chore: scaffold cape as a Claude Code plugin`). Conventional Commits style.
- **Plugin structure:** All functionality is declarative markdown consumed by Claude Code runtime. There is no `package.json`, `go.mod`, or build system.

**Implication:** "CLI command" in this context means a Claude Code slash command (`/cape:changelog`), not a shell binary. The command would be a markdown file instructing Claude to read git history and generate changelog content.

### Clarifying questions

Since no human is present, I list the questions I would ask, provide reasonable defaults, and continue with those defaults.

**Q1 (Critical): Should this be a Claude Code slash command (`/cape:changelog`) or a standalone shell script?**

- A) Claude Code slash command (recommended -- matches existing pattern)
- B) Standalone shell script
- C) Both

**Default answer:** A -- Claude Code slash command. Cape has no shell CLI infrastructure. All existing functionality is slash commands.

**Q2 (Critical): What commit range should it cover?**

- A) Since last tag/release (recommended)
- B) Since a user-specified commit/date
- C) All commits
- D) User chooses at invocation time

**Default answer:** D -- Let the user specify, but default to "since last tag." Flexible and covers the common case.

**Q3: What changelog format?**

- A) Keep a Changelog (recommended -- matches existing CHANGELOG.md)
- B) Conventional Changelog
- C) Custom format

**Default answer:** A -- Keep a Changelog. The repo already uses this format.

**Q4: Should it auto-write to CHANGELOG.md or output for review?**

- A) Output for review, user decides to apply (recommended)
- B) Auto-prepend to CHANGELOG.md
- C) User chooses

**Default answer:** A -- Output for review. Safer; avoids unintended file modifications.

**Q5 (Nice-to-have): Should it group commits by type (feat, fix, chore, etc.)?**

- A) Yes, using Conventional Commits prefixes (recommended)
- B) No, flat list
- C) Smart grouping by Claude's judgment

**Default answer:** A -- Group by Conventional Commits type. The repo already uses this convention.

### Key decisions table

| Question | Answer | Implication |
|----------|--------|-------------|
| Command type? | Claude Code slash command | New file at `commands/changelog.md`, no shell binary |
| Commit range? | User-specified, default since last tag | Command instructions must explain range options |
| Changelog format? | Keep a Changelog | Must match existing CHANGELOG.md structure |
| Auto-write? | Output for review | Command produces text, user applies manually |
| Grouping? | By Conventional Commits type | Maps commit prefixes to Added/Changed/Fixed/Removed |

---

## Step 2: Research and propose approaches

### Research findings

**Codebase:**
- `commands/brainstorm.md` -- Pattern: YAML frontmatter with `description`, body delegates to a skill or contains direct instructions.
- `CHANGELOG.md` -- Uses Keep a Changelog with `## [version] - date` sections containing `### Added`, `### Changed`, etc.
- Commit history uses `type: description` format (Conventional Commits).
- `hooks/session-start.sh` -- Only shell script; uses `set -euo pipefail`.

**External:**
- Keep a Changelog spec: sections are Added, Changed, Deprecated, Removed, Fixed, Security.
- Conventional Commits mapping: `feat:` -> Added, `fix:` -> Fixed, `refactor:`/`perf:` -> Changed, `chore:` -> excluded or Changed, `docs:` -> Changed, `BREAKING CHANGE` -> special callout.

**Dead ends:**
- Considered a shell script approach using `git log --format` piped through `awk`/`sed`. Abandoned because Cape has no shell CLI infrastructure and a Claude Code command can do smarter semantic grouping than regex parsing.

### Proposed approaches

Based on research findings, I recommend:

**1. Claude Code slash command with inline instructions (recommended)**

- **What:** A `commands/changelog.md` file containing instructions for Claude to run `git log` and `git tag`, parse commits, and format output as a Keep a Changelog section.
- **Pros:** Matches existing command pattern exactly. No new infrastructure. Claude can apply judgment to group ambiguous commits. Zero dependencies.
- **Cons:** Output quality depends on Claude's interpretation. No deterministic guarantee of identical output across runs.
- **Why recommended:** Consistent with `commands/brainstorm.md` pattern. YAGNI -- no build system, no dependencies, just a markdown file.

**2. Shell script invoked by a command**

- **What:** A `commands/changelog.md` that delegates to a shell script at `scripts/changelog.sh` which uses `git log` and text processing to generate output.
- **Pros:** Deterministic output. Could be used outside Claude Code.
- **Cons:** Introduces new `scripts/` directory. Shell text processing is brittle for semantic grouping. Doesn't match any existing Cape pattern.
- **Why not:** Over-engineered for a plugin that has no shell infrastructure.

**3. Skill-based approach with a command + skill**

- **What:** `commands/changelog.md` delegates to `skills/changelog/SKILL.md` which defines a multi-step process.
- **Pros:** Extensible. Could add interactive refinement.
- **Cons:** Over-engineered for a straightforward generation task. Skills are for iterative Socratic processes (like brainstorm), not one-shot generation.
- **Why not:** YAGNI. A changelog command is a single-pass operation, not an interactive workflow.

I recommend option 1 because it matches the existing command pattern, requires zero new infrastructure, and leverages Claude's ability to semantically parse and group commits.

---

## Step 3: Design validation

### Architecture

Single new file: `commands/changelog.md`

**Data flow:**
1. User invokes `/cape:changelog` with optional arguments (version, range).
2. Claude reads the command instructions.
3. Claude runs `git tag --sort=-v:refname` to find the last release tag.
4. Claude runs `git log <range> --format="%H %s"` to get commits.
5. Claude parses commit messages, groups by Conventional Commits type, maps to Keep a Changelog sections.
6. Claude reads existing `CHANGELOG.md` (if present) to match style.
7. Claude outputs the formatted section for user review.

**Components:**
- `commands/changelog.md` -- Single command file with all instructions.

**Mapping from Conventional Commits to Keep a Changelog:**
- `feat:` -> Added
- `fix:` -> Fixed
- `refactor:`, `perf:` -> Changed
- `docs:` -> Changed
- `deprecate:` or commit body mentions deprecation -> Deprecated
- `revert:` -> Removed
- `BREAKING CHANGE` -> Highlighted in relevant section
- `chore:`, `ci:`, `build:`, `test:`, `style:` -> Excluded by default

### Error handling

- No tags found: fall back to full history with a warning.
- No commits in range: report "No changes found."
- Non-conventional commit messages: group under "Changed" with the full message.

---

## Step 4: Epic and first task

### Epic

```
br create "Epic: Changelog generation command" \
  --type epic \
  --priority 2 \
  --description "## Requirements (IMMUTABLE)
- Command invoked as /cape:changelog generates a Keep a Changelog formatted section from git history
- Default range is from the last semver git tag to HEAD
- User can specify a custom range or version number
- Commits grouped by Conventional Commits type mapped to Keep a Changelog sections (Added, Changed, Fixed, Removed, Deprecated, Security)
- Output is presented for review, not auto-written to CHANGELOG.md
- Non-conventional commit messages placed under Changed section
- Commits with types chore, ci, build, test, style excluded by default

## Success criteria
- [ ] /cape:changelog produces a correctly formatted Keep a Changelog section
- [ ] Commits are grouped under correct sections (feat->Added, fix->Fixed, etc.)
- [ ] Default range uses last semver tag to HEAD
- [ ] Non-conventional commits handled gracefully under Changed
- [ ] Excluded types (chore, ci, build, test, style) omitted from output
- [ ] Output matches existing CHANGELOG.md style when one exists
- [ ] Command works when no tags exist (falls back to full history with warning)

## Anti-patterns (FORBIDDEN)
- NO auto-writing to CHANGELOG.md (reason: user must review and approve before any file modification)
- NO shell script dependencies (reason: Cape is a pure markdown plugin with no shell CLI infrastructure)
- NO new directory structure like scripts/ (reason: commands/ is the established pattern for slash commands)
- NO skill-based approach (reason: changelog generation is single-pass, not an iterative Socratic workflow)
- NO external tool dependencies like conventional-changelog-cli (reason: Claude can parse commits directly, zero-dependency approach)
- NO including chore/ci/build/test/style commits by default (reason: noise in changelogs, these are internal maintenance)

## Approach
Create a single commands/changelog.md file that instructs Claude to read git tags and log, parse Conventional Commits prefixes, map them to Keep a Changelog sections, and output a formatted changelog section for user review. This matches the existing command pattern established by commands/brainstorm.md: a markdown file with YAML frontmatter and body instructions.

The command leverages Claude's ability to run git commands via Bash, parse commit messages semantically, and format output. No shell scripts, no external tools, no new directories.

## Architecture
- commands/changelog.md -- Slash command definition with YAML frontmatter and generation instructions
- Data flow: /cape:changelog -> read git tags -> read git log -> parse commits -> group by type -> format as Keep a Changelog -> output for review

## Design rationale

### Problem
Generating changelogs from git history is tedious and error-prone when done manually. The cape plugin has no way to automate this. Users must manually read commits and write CHANGELOG.md entries.

### Research findings

**Codebase:**
- commands/brainstorm.md -- Establishes command pattern: YAML frontmatter with description, body contains instructions
- CHANGELOG.md -- Already uses Keep a Changelog format with semver
- Git history uses Conventional Commits (type: description)
- No shell CLI infrastructure exists; Cape is pure markdown

**External:**
- Keep a Changelog spec defines sections: Added, Changed, Deprecated, Removed, Fixed, Security
- Conventional Commits maps cleanly: feat->Added, fix->Fixed, refactor/perf->Changed

### Approaches considered

#### 1. Claude Code slash command with inline instructions (selected)

**What:** Single commands/changelog.md with instructions for Claude to run git commands, parse commits, and format output.
**Pros:** Matches existing pattern. Zero dependencies. Smart semantic grouping. Single file change.
**Cons:** Non-deterministic output across runs.
**Chosen because:** Consistent with commands/brainstorm.md, minimal footprint, YAGNI.

#### 2. Shell script invoked by command (rejected)

**What:** Command delegates to a scripts/changelog.sh shell script for deterministic text processing.
**Why explored:** Deterministic output and reusability outside Claude Code.
**Why rejected:** Introduces new scripts/ directory. Shell text processing is brittle for semantic grouping. No existing shell CLI pattern in Cape.
**DO NOT REVISIT UNLESS:** Cape adds a shell CLI entry point or needs deterministic changelog output for CI.

#### 3. Skill-based interactive approach (rejected)

**What:** Full skill workflow with commands/changelog.md delegating to skills/changelog/SKILL.md.
**Why explored:** Could enable interactive refinement of changelog entries.
**Why rejected:** Over-engineered. Changelog generation is single-pass, not iterative Socratic. Skills pattern is for design refinement, not generation.
**DO NOT REVISIT UNLESS:** Users need multi-round interactive changelog editing with clarifying questions.

### Scope boundaries

**In scope:** Command file, commit parsing, Keep a Changelog formatting, range selection, type mapping.
**Out of scope:** Auto-writing to CHANGELOG.md (explicit anti-pattern). Version bumping logic. GitHub release creation. Breaking change detection from commit bodies (future enhancement). Interactive editing of generated output.

### Open questions
- Should BREAKING CHANGE footers be detected and highlighted? (Defer to implementation -- start without, add if needed)
- Should the user be able to include normally-excluded types? (Defer -- start with fixed exclusions)

## Design discovery

### Key decisions made

| Question | Answer | Implication |
|----------|--------|-------------|
| Command type? | Claude Code slash command | New file at commands/changelog.md, no shell binary |
| Commit range? | User-specified, default since last tag | Command instructions must explain range options |
| Changelog format? | Keep a Changelog | Must match existing CHANGELOG.md structure |
| Auto-write? | Output for review | Command produces text, user applies manually |
| Grouping? | By Conventional Commits type | Maps commit prefixes to Added/Changed/Fixed/Removed |

### Research deep-dives

#### Keep a Changelog + Conventional Commits mapping
**Question:** How do Conventional Commits types map to Keep a Changelog sections?
**Sources:** Keep a Changelog spec, Conventional Commits spec
**Conclusion:** Clean 1:1 mapping. feat->Added, fix->Fixed, refactor/perf/docs->Changed, deprecate->Deprecated, revert->Removed. Internal types (chore, ci, build, test, style) excluded.

#### Cape command pattern
**Question:** How are commands structured in Cape?
**Sources:** commands/brainstorm.md, .claude-plugin/plugin.json
**Conclusion:** YAML frontmatter with description field, body contains instructions. Commands invoked as /cape:name. Single markdown file per command.

### Dead-end paths

#### Shell script approach
**Why explored:** Deterministic output, reusable outside Claude Code.
**What found:** Cape has zero shell infrastructure beyond a session-start hook. No scripts/ directory. No build system. Adding shell scripts would be inconsistent with the plugin's pure-markdown architecture.
**Why abandoned:** Pattern mismatch. Over-engineered for a markdown plugin.

### Open concerns raised
- Non-deterministic output across runs -> Acceptable for a review-first workflow; user verifies before applying.
- What if repo doesn't use Conventional Commits? -> Fall back to listing all commits under Changed. Command instructions should handle this gracefully."
```

### First task

```
br create "Task 1: Create commands/changelog.md slash command" \
  --type feature \
  --priority 2 \
  --parent [epic-id] \
  --description "## Goal
Create the /cape:changelog slash command that generates a Keep a Changelog section from git history.

## Implementation
1. Study existing code
   - commands/brainstorm.md:1-5 - Command file pattern (YAML frontmatter + body)
   - CHANGELOG.md:1-15 - Target output format
   - Git log output for commit message structure

2. Write the command file
   commands/changelog.md with:
   - YAML frontmatter: description field
   - Body: detailed instructions for Claude covering:
     a. Read git tags to find last release
     b. Read git log for the range
     c. Parse Conventional Commits prefixes
     d. Map to Keep a Changelog sections
     e. Exclude chore/ci/build/test/style
     f. Handle non-conventional messages
     g. Format and output for review

3. Implementation checklist
   - [ ] commands/changelog.md - YAML frontmatter with description
   - [ ] commands/changelog.md - Instructions for git tag reading
   - [ ] commands/changelog.md - Instructions for git log parsing
   - [ ] commands/changelog.md - Conventional Commits to Keep a Changelog mapping table
   - [ ] commands/changelog.md - Exclusion rules for internal types
   - [ ] commands/changelog.md - Fallback handling for no tags / non-conventional commits
   - [ ] commands/changelog.md - Output format specification

## Success criteria
- [ ] /cape:changelog is recognized as a valid slash command
- [ ] Command instructions are clear enough for Claude to produce correct output
- [ ] Generated output matches Keep a Changelog format
- [ ] Commit type mapping is documented in the command
- [ ] Pre-commit hooks passing"
```

### Completion summary

```
Epic [id] created with immutable requirements and success criteria.
First task [id] is ready to execute.

The epic has 7 requirements, 6 anti-patterns, and 7 success criteria.
```
