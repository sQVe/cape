---
name: review
description: >
  Review code changes for bugs, logic errors, security issues, and design problems using structural
  analysis from the code-review-graph. Use whenever the user wants a code review — explicit requests
  ("review my changes", "review this", "check my code", "/cape:review") and implicit ones ("anything
  wrong here?", "is this ready?", "look this over"). Also use when reviewing someone else's PR or
  branch. Covers self-review before committing, pre-PR review, and reviewing others' work. Do NOT
  use for writing review (prose, docs) or for committing (use cape:commit).
---

<skill_overview> Review code changes using code-review-graph for structural intelligence — blast
radius, dependency chains, test coverage gaps. Produces a verdict-first report grouped by file.
Optionally tracks critical findings as br bugs for later resolution.

The graph gives this skill something raw diffs can't: who calls what you changed, what breaks if
this behaves differently, and which functions have no tests. One structurally-aware reviewer finds
more than three blind ones. </skill_overview>

<rigidity_level> HIGH RIGIDITY — The process order (scope → graph → review → report → follow-up) is
fixed. The report format (verdict first, grouped by file, severity-tagged findings) is
non-negotiable. Depth adapts to change size. </rigidity_level>

<when_to_use>

- User says "review", "check my code", "look this over", "anything wrong?"
- Before committing or creating a PR — self-review
- Reviewing someone else's PR, branch, or specific files
- After finishing implementation, as a quality gate

**Don't use for:**

- Writing or prose review (docs, markdown, READMEs)
- Committing changes (use cape:commit)
- Creating PRs (use cape:pr)
- Investigating a specific bug (use cape:debug-issue)

</when_to_use>

<critical_rules>

1. **Always update the graph first** — stale graph = stale review. Run `build_or_update_graph_tool`
   before `get_review_context_tool`.
2. **Lead with the verdict** — never bury the conclusion in a wall of findings
3. **NEVER invent report sections** — use the exact report format from step 4 (verdict, risk, scope,
   findings grouped by file, test coverage gaps, summary)
4. **Never offer to fix** — review and fix are separate concerns. Present findings, stop.
5. **Check test coverage selectively** — use review context guidance for coverage gaps, query
   `tests_for` only on high-impact changed functions. Untested + callers = highest risk.
6. **Offer br tracking only for own code** — when reviewing others' PRs, just deliver the report
7. **Always attempt the graph** — even for small changes, blast radius is cheap. Fall back to
   diff-only when the graph returns 0 nodes (non-code repo) or is genuinely unavailable.
8. **Check dependents of deleted files** — a deletion that breaks importers is a critical finding

</critical_rules>

<the_process>

## Step 1: Determine scope

Parse the argument to determine what to review:

| Argument          | Scope                                     |
| ----------------- | ----------------------------------------- |
| (none)            | Branch diff from merge-base + uncommitted |
| `unstaged`        | `git diff` + untracked files              |
| `staged`          | `git diff --staged`                       |
| file path or glob | Specific files                            |
| branch name       | Diff of that branch vs main               |
| PR number         | Diff of PR branch vs its base             |

Run `cape check` as a pre-review gate. If it fails, report failures and stop — fix build/test errors
before reviewing code.

**Detect main branch and changed files:**

```bash
cape git context
git diff --name-only [scope-flags]
```

Use `mainBranch` from context output. Use `status` for untracked file detection.

If no changed files found: "No changes found for scope: {scope}." Stop.

Report: "Reviewing N files..."

---

## Step 2: Build structural context

Update the graph and gather structural intelligence. Run sequentially:

1. `build_or_update_graph_tool()` — incremental update to reflect current state
2. `get_review_context_tool()` — returns changed files, impacted nodes, source snippets, and review
   guidance. For branch/PR scope, pass `base="main"` (or detected main branch).
3. `get_impact_radius_tool()` — returns blast radius: files and functions that depend on what
   changed, with dependency counts.

If the graph has 0 nodes (non-code repo or unsupported languages), fall back to reading full file
content + diff hunks directly. Note the absence of structural context in the report header:

```
**Graph:** No parseable code — structural analysis unavailable
```

If only some changed files are code (mixed content), use the graph for code files and diff-based
review for the rest. Don't refuse to review config or markup files — just acknowledge the structural
context doesn't apply to them.

---

## Step 3: Review

Work through each changed file using the graph context. For each file:

**Deleted files:** Check `impacted_nodes` for anything that depended on deleted code. Use
`query_graph_tool(pattern="importers_of", target=<deleted_file>)` to find broken imports. Deleted
functions with callers are critical findings.

**New files:** Review the full content for correctness, security, and design. No blast radius exists
yet — focus on whether the new code follows existing patterns.

**Changed files:**

**Correctness:** Read the source snippet and diff. Look for bugs, logic errors, off-by-one,
null/undefined hazards, race conditions, resource leaks.

**Impact awareness:** Check `impacted_nodes` from the review context. If a changed function has
callers, verify the change is compatible. If it has dependents in other files, check for breaking
changes. Use `query_graph_tool(pattern="callers_of", target=<function>)` only for high-risk
functions flagged by the review context (many dependents). Don't query per-function — the review
context already surfaces the important relationships.

**Test coverage:** Check the review context's guidance for coverage gaps. Use
`query_graph_tool(pattern="tests_for", target=<function>)` selectively — only for changed functions
the review context flagged as high-impact or untested. Flag untested functions with callers as the
highest-risk combination.

**Security:** SQL injection, XSS, command injection, hardcoded secrets, insecure deserialization,
path traversal. Weight these as critical.

**Design:** Pattern violations, unnecessary complexity, naming, separation of concerns. Weight these
as suggestions unless they create maintenance risk.

**Calibrate depth to scope:**

| Scope      | Depth                                                        |
| ---------- | ------------------------------------------------------------ |
| 1-3 files  | Deep: every line, all callers, all tests                     |
| 4-10 files | Focused: entry points, public API, key paths                 |
| 10+ files  | Surgical: impact radius, representative samples, regressions |

---

## STOP — Step 4: Present the report (OUTPUT GATE)

Structure the report as follows. Lead with the verdict — the reader should know the outcome before
reading details.

```
## Review: {scope_description}

**Verdict:** Passes review | Needs changes
**Risk:** Low | Medium | High
**Scope:** {N} files changed, {M} files in blast radius

### Findings

#### {file_path}

**[Critical]** L{line}: {description}
Suggestion: {how to fix}
Impact: {N callers, M dependents | isolated}

**[Important]** L{line}: {description}
Suggestion: {how to fix}

**[Suggestion]** L{line}: {description}

#### {next_file_path}
...

### Test coverage gaps

- {function_name} in {file} — no tests, {N} callers
- {function_name} in {file} — no tests, isolated

### Summary

{critical_count} critical, {important_count} important, {suggestion_count} suggestions
```

**Verdict criteria:**

- **Passes review** — no critical findings, no important findings, or only suggestions
- **Needs changes** — any critical or important finding

**Risk assessment:**

- **High** — changes to functions with 5+ callers, or public API surface, or security findings
- **Medium** — changes with 2-4 callers, or untested functions with dependents
- **Low** — isolated changes with test coverage

If no issues found:

```
## Review: {scope_description}

Passes review. No issues found.

{N} files reviewed, {M} in blast radius. All changed functions have test coverage.
```

End output with `---` separator. After the separator, immediately proceed to step 5. Do not announce
intent or say "Let me..." after the separator.

---

## Step 5: Follow-up actions

Use `AskUserQuestion` with context-appropriate options:

**When reviewing own code (branch diff, unstaged, staged):**

- **Track as bugs** — create br bugs for critical and important findings
- **Refactor** — if the review flagged structural issues (duplication, tangled responsibilities,
  coupling), offer to load `cape:refactor` to address them
- **Done** — report delivered, no further action

**When reviewing others' code (PR number, explicit branch):**

- **Done** — report delivered

When "Track as bugs" is selected, create a br bug for each critical and important finding:

```bash
br create --type bug --priority {severity} --title "{file}: {short_description}"
cape br validate <bug-id>
```

Map severity: critical → 1, important → 2. Include the file path, line numbers, and suggestion in
the bug description. Skip suggestions — they don't warrant tracking.

</the_process>

<examples>

<example>
<scenario>Self-review before committing, graph finds blast radius</scenario>

User: "review my changes"

1. Scope: branch diff — 3 files changed
2. Graph update, review context shows `parseConfig()` in `config.ts` has 8 callers
3. Diff shows `parseConfig()` now throws on invalid input (previously returned null)
4. Review flags: callers expect null return, not exceptions → critical

```
## Review: branch diff (3 files, 12 in blast radius)

**Verdict:** Needs changes
**Risk:** High

### Findings

#### src/config.ts

**[Critical]** L42-48: parseConfig() now throws on invalid input
Suggestion: Return a Result type or keep null return — 8 callers expect null
Impact: 8 callers across 5 files, 2 tests

### Test coverage gaps

- validateSchema in src/config.ts — no tests, 3 callers

### Summary

1 critical, 0 important, 0 suggestions
```

User chooses "Track as bugs" → br bug created for the breaking change. </example>

<example>
<scenario>Reviewing someone's PR with clean code</scenario>

User: "review PR #47"

1. Scope: PR diff — 2 files, adding a utility function and its test
2. Graph shows new function, no callers yet (new code), test exists
3. No issues found

```
## Review: PR #47 (2 files, 0 in blast radius)

Passes review. No issues found.

2 files reviewed, 0 in blast radius. All changed functions have test coverage.
```

User gets "Done" as the only follow-up option. </example>

<example>
<scenario>Non-code repo, graceful degradation</scenario>

User: "review my changes" in a markdown/config-only repo

1. Scope: branch diff — 5 files (3 markdown, 2 JSON)
2. Graph update returns 0 nodes — no parseable code
3. Fall back to diff-based review without structural context

```
## Review: branch diff (5 files)

**Verdict:** Passes review
**Risk:** Low
**Graph:** No parseable code — structural analysis unavailable

### Findings

#### config/settings.json

**[Suggestion]** L12: `timeout` set to 0 — effectively disables timeouts
```

Graph absence doesn't block the review — it just limits the analysis to what's visible in the diff.
</example>

<example>
<scenario>Large change set, surgical review depth</scenario>

User: "review staged" — 14 files across a refactor.

Graph shows 3 high-impact files (many dependents), rest are leaf changes. Deep review on high-impact
files, spot checks on the rest. Output uses multiple `#### file_path` sections under Findings, each
with its own severity-tagged items. Same format as example 1, repeated per file. </example>

</examples>

<key_principles>

- **Graph first** — structural context (blast radius, callers, test coverage) before line-by-line
  reading. One informed reviewer beats three blind ones.
- **Verdict first** — the reader should know the outcome before reading details
- **Impact-weighted severity** — a bug in an isolated helper is less critical than the same bug in a
  function with 10 callers
- **Review informs, doesn't fix** — present findings clearly, let the user decide the next step
- **Graceful degradation** — if the graph is unavailable, fall back to diff-based review. The skill
  still works, it just loses structural context.

</key_principles>
