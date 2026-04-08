---
name: conform
description: >
  Check code changes against documented conventions in CLAUDE.md and rules files. Use whenever the
  user asks to check convention adherence — "check my code against rules", "does this conform",
  "lint conventions", "check rules", "/cape:conform", or any request to verify code follows
  documented standards. Covers project and global CLAUDE.md rules plus per-language rule files in
  ~/.claude/rules/. Do NOT use for bug-finding or code quality review (use cape:review), running
  external linters (use cape check), or investigating bugs (use cape:debug-issue).
---

<skill_overview> Check whether changed code conforms to the user's documented conventions — the
rules in CLAUDE.md files and `~/.claude/rules/*.md` files. Produces a binary report: each rule is
either followed or violated.

Unlike review (which checks correctness, security, and design using structural analysis), conform is
mechanical and rule-driven. It checks what the user has explicitly documented, not what a reviewer
would infer. No blast radius, no severity levels, no code-review-graph. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — The process order (scope → gather → match → check → report) is
fixed. The report format (result first, violations grouped by file) is non-negotiable. Checking
granularity adapts to scope size. </rigidity_level>

<when_to_use>

- "Check my code against rules"
- "Does this conform to our conventions?"
- "Run conform" / "lint conventions"
- Before committing, as a convention gate
- After implementation, to verify style adherence

**Don't use for:**

- Bug-finding or code quality review (use cape:review)
- Running external linters/formatters (use `cape check`)
- Investigating bugs (use cape:debug-issue)
- Writing or prose review

</when_to_use>

<critical_rules>

1. **Always use the CLI** — run `cape conform [scope]` to discover rules and changed files. Do not
   manually read CLAUDE.md or rule files.
2. **Rule files are the atomic unit** — check all rules in a file together, not one bullet at a time
3. **Skip uncheckable rules** — design principles ("boring code wins"), Claude behavior instructions
   ("research before I don't know"), and meta-rules about workflow are not code-checkable. Skip them
   silently.
4. **Violations are binary** — rule followed or not. No severity, no "minor/major" classification.
5. **Never offer to fix** — conform reports, it doesn't fix. Present violations and stop.
6. **Glob matching determines applicability** — rules with globs only apply to files matching those
   globs. Rules without globs (CLAUDE.md) apply to all files.

</critical_rules>

<the_process>

## Step 1: Determine scope

Parse the argument to determine what to check:

| Argument          | Scope                            |
| ----------------- | -------------------------------- |
| (none)            | `branch` (branch changes)        |
| `unstaged`        | `unstaged` (uncommitted changes) |
| `staged`          | `staged` (staged changes)        |
| file path or glob | Specific files                   |

---

## Step 2: Gather data

Run the CLI command to discover rules and changed files:

```bash
cape conform [scope]
```

This outputs JSON:

```json
{
  "rules": [
    { "source": "~/.claude/rules/typescript.md", "globs": ["**/*.ts"], "content": "..." },
    { "source": "~/.claude/CLAUDE.md", "globs": [], "content": "..." }
  ],
  "changedFiles": [{ "path": "src/index.ts", "content": "..." }],
  "scope": "branch"
}
```

If no changed files: "No changes found for scope: {scope}." Stop.

If no rules discovered: "No convention rules found. Expected CLAUDE.md or ~/.claude/rules/\*.md
files." Stop.

---

## Step 3: Match rules to files

For each rule entry, determine which changed files it applies to:

- **Rules with empty globs** (CLAUDE.md files) — apply to all changed files
- **Rules with globs** — apply only to changed files whose paths match at least one glob pattern

Filter out rule entries with no matching changed files — there is nothing to check.

If no rules match any changed files: "No applicable rules for the changed files." Stop.

Report: "Checking N files against M rule sets..."

---

## Step 4: Check conformance

For each applicable rule entry, check all matching changed files for violations.

**Small scope (<10 changed files, <5 applicable rule entries):**

Check directly. For each rule entry:

1. Read the rule content
2. Read each matching changed file
3. Identify concrete, line-level violations
4. Record: file path, line number, violation description, rule source

**Large scope (10+ files or 5+ rule entries):**

Dispatch one subagent per rule entry, in parallel. Each agent receives:

- The full rule file content
- The content of all matching changed files
- Instruction: identify concrete violations with file:line references, or report "clean"

**Checking guidelines:**

- Focus on violations that are concrete and actionable — "line 42 uses `any` instead of `unknown`"
- Require a specific line reference for every violation
- Skip rules that cannot be mechanically verified from the code alone (design philosophy, workflow
  instructions, behavior guidelines)
- When a rule includes examples (good/bad patterns), use those to calibrate what counts as a
  violation

---

## STOP — Step 5: Report (OUTPUT GATE)

Structure the report. Lead with the result.

**When violations are found:**

```
## Conform: {scope_description}

**Result:** Violations found
**Scope:** {N} files checked against {M} rule sets

### Violations

#### {file_path}

- **L{line}:** {violation description} — *{rule_source_basename}*

#### {next_file_path}
...

### Summary

{violation_count} violations across {file_count} files
```

**When no violations are found:**

```
## Conform: {scope_description}

**Result:** Conforms
**Scope:** {N} files checked against {M} rule sets

No violations found.
```

Use the rule file basename (e.g., `typescript.md`, `CLAUDE.md`) for attribution, not the full path.

</the_process>

<examples>

<example>
<scenario>TypeScript changes checked against rules</scenario>

User: "conform"

1. Scope: branch (default)
2. Run `cape conform branch` — returns 3 changed `.ts` files, 4 rule entries (CLAUDE.md, project
   CLAUDE.md, typescript.md, testing-typescript.md)
3. Match: typescript.md matches all 3 files, testing-typescript.md matches 1 test file, both
   CLAUDE.md files match all 3
4. Check each rule entry against its matching files
5. Report:

```
## Conform: branch diff

**Result:** Violations found
**Scope:** 3 files checked against 4 rule sets

### Violations

#### src/services/auth.ts

- **L12:** Uses `any` type — should be `unknown` — *typescript.md*
- **L28:** Missing braces on single-line if statement — *typescript.md*

#### src/services/auth.test.ts

- **L5:** Test description doesn't start with "should" or verb phrase — *testing-typescript.md*

### Summary

3 violations across 2 files
```

</example>

<example>
<scenario>No violations found</scenario>

User: "conform unstaged"

1. Scope: unstaged
2. Run `cape conform unstaged` — returns 1 changed file, 2 applicable rule entries
3. Check: all rules satisfied
4. Report:

```
## Conform: unstaged changes

**Result:** Conforms
**Scope:** 1 file checked against 2 rule sets

No violations found.
```

</example>

<example>
<scenario>No matching rules for file type</scenario>

User: "conform" — only changed a Dockerfile and a Makefile

1. Run `cape conform branch` — returns 2 changed files, rules have globs for .ts, .go, .lua, etc.
2. CLAUDE.md files (no globs) apply, but contain only design principles ("boring code wins") that
   are not mechanically checkable
3. Report: "No applicable rules for the changed files."

</example>

</examples>

<key_principles>

- **Mechanical, not judgmental** — check documented rules, not aesthetic preferences
- **Binary verdicts** — violated or not, no gray area
- **Rule files are cohesive** — check all rules in a file together for context
- **Concrete violations only** — every finding has a file:line reference
- **Separate from review** — conform checks conventions, review checks correctness

</key_principles>
