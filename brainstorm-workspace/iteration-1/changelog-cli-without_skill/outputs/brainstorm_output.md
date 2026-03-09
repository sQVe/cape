# Brainstorm: changelog CLI command

## Clarifying questions

Before designing this, I would ask the following questions. Since no human is present, I provide default answers.

### 1. Commit convention

**Question:** Do your repositories follow Conventional Commits (`feat:`, `fix:`, `chore:`, etc.) or a different convention?

**Default answer:** Yes, Conventional Commits. The cape repo itself uses this pattern (e.g., `chore: scaffold cape as a Claude Code plugin`).

### 2. Scope: tag-to-tag or arbitrary range?

**Question:** Should the command generate a section for unreleased changes since the last tag, or support arbitrary ranges (e.g., `v1.0.0..v2.0.0`)?

**Default answer:** Primarily unreleased changes since the last tag. Optionally accept a `--from` / `--to` range.

### 3. Output destination

**Question:** Should it append directly to `CHANGELOG.md`, print to stdout, or both?

**Default answer:** Print to stdout by default. Accept a `--write` flag to prepend the new section into `CHANGELOG.md`.

### 4. Grouping

**Question:** How should entries be grouped? Keep a Changelog categories (Added, Changed, Deprecated, Removed, Fixed, Security) derived from Conventional Commit types?

**Default answer:** Yes. Map `feat:` to Added, `fix:` to Fixed, `refactor:`/`perf:` to Changed, `chore:`/`build:`/`ci:` to a Maintenance group (or omit them). Allow a `--include-all` flag to include everything.

### 5. Version header

**Question:** Should the command auto-detect the next version (via semver bump from commit types) or require the user to pass it?

**Default answer:** Require the user to pass `--version <version>`. Auto-detection is nice but adds complexity and is better deferred.

### 6. Monorepo or single-package?

**Question:** Should it support scoped filtering (e.g., only `feat(api):` commits)?

**Default answer:** Not initially. Single-package scope. Scoped filtering can be added later.

---

## Research findings

### Codebase patterns

- **Cape is a Claude Code plugin.** Commands live in `commands/` as markdown files with YAML frontmatter (`description` field). They reference skills or contain inline instructions. Invoked via `/cape:<name>`.
- **Existing command pattern** (`commands/brainstorm.md`): frontmatter with `description`, body instructs Claude to use a skill.
- **Skills** live in `skills/<name>/SKILL.md` with frontmatter (`name`, `description`) and structured sections defining a workflow.
- **Existing CHANGELOG.md** follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format with Semantic Versioning.
- **Hooks** are shell scripts referenced from `hooks/hooks.json`.
- **No existing shell scripts beyond `session-start.sh`.** The plugin is entirely markdown-driven; Claude interprets the commands and skills at runtime.

### Key insight

Cape commands are not traditional CLI executables. They are Claude Code slash commands. `cape changelog` would be `/cape:changelog` -- a markdown file instructing Claude to read git history and produce formatted output. Claude itself does the work (running `git log`, parsing, formatting). There is no separate shell script or binary.

This is important: the "CLI command" is actually a Claude Code slash command that uses git tools available to Claude.

---

## Proposed plan

### Approach A: Claude Code slash command (recommended)

Create `commands/changelog.md` that instructs Claude to:

1. Run `git tag --sort=-v:refname` to find the latest tag.
2. Run `git log <last-tag>..HEAD --pretty=format:...` to get commits since that tag.
3. Parse commit messages using Conventional Commits prefixes.
4. Group into Keep a Changelog categories (Added, Changed, Fixed, etc.).
5. Format as a markdown section with the provided version or `[Unreleased]`.
6. Either print the result or prepend it to `CHANGELOG.md`.

Optionally, create a supporting skill at `skills/changelog/SKILL.md` with detailed formatting rules, edge case handling, and the category mapping table.

**Pros:**
- Matches cape's architecture perfectly (markdown command, Claude executes).
- No external dependencies or shell scripts.
- Claude can handle messy commit messages gracefully (fuzzy matching, rewording).
- Flexible: Claude can adapt output based on user follow-up.

**Cons:**
- Output may vary slightly between runs (LLM non-determinism).
- Slower than a shell script for large histories.

### Approach B: Shell script hook

Create a shell script (`scripts/changelog.sh`) that parses `git log` output with `grep`/`sed`/`awk`, then wire it into a command.

**Pros:**
- Deterministic output.
- Fast.

**Cons:**
- Fragile parsing; Conventional Commits edge cases are hard with regex.
- Doesn't match cape's markdown-command pattern.
- Requires maintaining shell code alongside the markdown-driven plugin.

### Recommendation

Approach A. Cape is a Claude Code plugin; its commands are instructions for Claude, not standalone scripts. A slash command with a supporting skill is the idiomatic way to add this feature.

---

## Implementation outline

### Files to create

#### 1. `commands/changelog.md`

Slash command frontmatter and body. The body instructs Claude to use the changelog skill.

```
---
description: Generate a changelog section from git commit history
---

Use the cape:changelog skill exactly as written.
```

#### 2. `skills/changelog/SKILL.md`

Skill definition with:

- **Frontmatter:** `name: changelog`, `description: ...`
- **Process steps:**
  1. Detect latest git tag (or accept user-provided range).
  2. Collect commits in range via `git log`.
  3. Parse each commit: extract type, scope, breaking change marker, description.
  4. Group by Keep a Changelog category using mapping table:

     | Conventional Commits type | Changelog category |
     |---------------------------|--------------------|
     | `feat`                    | Added              |
     | `fix`                     | Fixed              |
     | `refactor`, `perf`        | Changed            |
     | `docs`                    | Documentation      |
     | `BREAKING CHANGE` / `!`   | Breaking changes   |
     | `deprecate`               | Deprecated         |
     | `revert`                  | Removed            |
     | `chore`, `build`, `ci`, `test`, `style` | Omitted by default |

  5. Format output as Keep a Changelog section with date.
  6. If user requests write mode, prepend section to `CHANGELOG.md` after the header.

- **Critical rules:**
  - Follow Keep a Changelog format exactly.
  - Use sentence case for entries.
  - Strip commit type prefixes from entry text.
  - Omit merge commits.
  - Include breaking changes prominently at the top.
  - Date format: `YYYY-MM-DD`.

- **User interaction:** Ask for version string if not provided. Confirm before writing to file.

### Files to modify

None. This is purely additive.

---

## Scope boundaries

**In scope:**
- Slash command and skill for generating changelog sections.
- Conventional Commits parsing.
- Keep a Changelog output format.
- Stdout output and optional write-to-file.
- Tag-based range detection.

**Out of scope:**
- Automatic semver bump detection.
- Monorepo / scope filtering.
- GitHub release creation.
- Non-Conventional-Commits parsing heuristics (could be added later).

---

## Open questions

- Should entries link to commits or PRs? (Requires knowing the remote URL and whether GitHub is used.) Suggest: defer, keep it simple initially.
- Should duplicate messages (e.g., merge commit + original) be deduplicated? Suggest: yes, omit merge commits by default.
- Should the skill handle repos with no tags? Suggest: yes, fall back to full history with a warning.
