---
name: review
description: >
  Review code changes for bugs, logic errors, security issues, design problems, and documented
  convention violations using structural analysis from the committed graphify graph plus cape
  conform. Use whenever the user wants a code review: "review my changes", "review this", "check my
  code", "/cape:review", "anything wrong here?", "is this ready?", or reviewing another PR or
  branch. Do NOT use for writing prose or committing.
---

<skill_overview> Review code changes using structural graph context, documented conventions, and
diff evidence. Produces a verdict-first report, then stamps hook state so `cape:pr` can pass the
review-before-pr gate. Optionally tracks critical and important findings as Linear issues through
`cape:tracker`.

Core contract: review is read-only for source changes unless the user explicitly opts into tracking
findings. The `reviewedAt` stamp is hook bookkeeping, not a source edit. </skill_overview>

<reviewer_contract>

- **Read-only:** cite findings and stop. Do not apply fixes during review.
- **Stamp on completion:** after the report is delivered, write the `reviewedAt` hook state key.
- **File-line evidence:** every finding cites `file:line`.
- **Claims are unverified:** implementer rationales and comments are hypotheses.
- **Impact-derived severity:** severity comes from observed behavior, reach, and risk.

</reviewer_contract>

<rigidity_level> LOW FREEDOM -- Scope, graph, conventions, review, report, and optional follow-up
order is fixed. Depth adapts to change size. </rigidity_level>

<when_to_use>

- User says "review", "check my code", "look this over", "anything wrong?"
- Before committing or creating a PR
- Reviewing someone else's PR, branch, or specific files
- After finishing implementation as a quality gate

**Don't use for:**

- Writing or prose review
- Committing changes (use `cape:commit`)
- Creating PRs (use `cape:pr`)
- Diagnosing or fixing a specific bug (use `cape:fix-bug`)

</when_to_use>

<critical_rules>

1. **Read the current graph report first** -- the graph is committed and refreshed out-of-band,
   never rebuilt per review
2. **Lead with the verdict** -- never bury the conclusion
3. **Use the report format** -- verdict, risk, scope, findings, coverage gaps, summary
4. **Never offer to fix** -- review and fix are separate concerns
5. **Run conventions through cape conform** -- documented rules are the source of truth
6. **Offer Linear tracking only for own code** -- for others' PRs, deliver the report only
7. **Track findings through tracker** -- user-approved findings become Linear issues and cache
   refreshes, not local issue CLI calls
8. **Stamp completed reviews** -- after the report, run
   `cape state set reviewedAt '{"scope":"<scope>"}'` so `cape:pr` has a fresh review-before-pr
   signal
9. **Hunk annotations are additive** -- post findings to a live hunk session when one exists, but
   never replace the text report and never hard-depend on hunk; no session means text-only

</critical_rules>

<the_process>

## Step 1: Determine scope

Parse the argument:

| Argument          | Scope                              |
| ----------------- | ---------------------------------- |
| none              | branch diff plus untracked files   |
| `unstaged`        | unstaged diff plus untracked files |
| `staged`          | staged diff                        |
| file path or glob | specific files                     |
| branch name       | branch diff vs main                |
| PR number         | PR diff vs base                    |

Run:

```bash
cape workspace phase review
cape check
cape git context
cape git diff <scope>
```

If no changed files are found, report that and stop.

---

## Step 2: Build structural context

Read the committed graph report at `graphify-out/GRAPH_REPORT.md` for blast radius — hub nodes,
communities, and the most-connected code the diff touches. The graph is committed and refreshed
out-of-band; do not rebuild it during review.

When the graphify MCP server is present, refine the report with an optional query:

- `query_graph` to traverse from a changed symbol or question
- `get_neighbors` for callers, dependents, and affected tests
- `shortest_path` to connect a change to the code it reaches

If the report is missing or the graph has no parseable nodes, fall back to diff and file reads and
say structural analysis is unavailable. A missing report or server never blocks review.

---

## Step 3: Check documented conventions

Run `cape conform <scope>` for the same review scope. Use its JSON output as the source of truth for
applicable rules and rule sources. Report convention violations separately from correctness findings
unless the same observation also creates a correctness bug.

This step is enforced: `cape conform` stamps a `conformedAt` marker, and the Step 5 `reviewedAt`
stamp is hard-gated on it. Skipping conform blocks review completion.

---

## Step 4: Review the changes

Review each changed file using graph context and diff evidence:

- Deleted files: check importers and dependents
- New files: review full content for correctness, security, and local patterns
- Changed files: inspect behavior changes, callers, blast radius, nullability, race conditions,
  resource handling, and security risks
- Tests: flag high-impact changed functions without tests

Calibrate depth:

- 1-3 files: deep review
- 4-10 files: focused review
- 10+ files: surgical review around impact radius and risky paths

---

## Step 5: Present report

Before presenting the review write-up, load the global `stop-slop` skill and run the prose through
it; skip this for pure code or mechanical output.

Use this format:

```text
Review: <scope>

Verdict: Passes review | Needs changes
Risk: Low | Medium | High
Scope: <N> files changed, <M> files in blast radius

Findings

<file>

[Critical] L<line>: <description>
Suggestion: <how to fix>
Impact: <callers/dependents>

[Important] L<line>: <description>
Suggestion: <how to fix>

[Suggestion] L<line>: <description>

[Convention: <rule_source>] L<line>: <description>
Rule: <short rule>

Test coverage gaps

- <function> in <file> - no tests, <N> callers

Summary

<counts>
```

If no issues are found:

```text
Review: <scope>

Passes review. No issues found.

<N> files reviewed, <M> in blast radius. All changed functions have test coverage. No documented
convention violations found.
```

End with `---`, then stamp the completed review:

```bash
cape state set reviewedAt '{"scope":"<scope>"}'
```

Use the same scope label from Step 1, such as `branch`, `staged`, `unstaged`, a file path, branch
name, or PR number. Then proceed to follow-up actions without announcing another review phase.

---

## Step 6: Annotate a live hunk session

If a hunk diff session is open for this repo, post the findings there as inline comments so the
human sees them in the diff they are already scrolling. This augments the text report; it never
replaces it.

Detect a session for the current repo:

```bash
hunk session get --repo . --json
```

If that errors (no session, or `hunk` not installed), the review is text-only -- append one line and
stop:

> Run `hunk diff --watch` for inline annotations next time.

If `--repo` is unsupported on the installed hunk, fall back to `hunk session list --json` matched
against `git rev-parse --show-toplevel`.

With a live session:

1. Load hunk's own skill for the exact command surface, then follow it:

   ```bash
   hunk skill path
   ```

   Do not launch the TUI (`hunk diff`, `hunk show`) yourself -- that surface belongs to the human.

2. Read the diff structure to resolve anchors:

   ```bash
   hunk session review --repo . --json
   ```

3. Clear prior `cape:review` comments first so re-reviews replace rather than stack, then batch-post
   the fresh set in one call:

   ```bash
   hunk session comment list --repo . --type agent
   hunk session comment rm --repo . <comment-id>   # each prior cape:review comment
   hunk session comment apply --repo . --stdin     # all findings at once
   ```

Map each finding to a comment:

- `summary`: `[Severity] <one-line description>`
- `rationale`: the full finding body (suggestion, impact)
- `author`: `cape:review`
- `--focus`: only on `[Critical]` findings
- anchor: `newLine` from the finding's line; `oldLine` for findings on deleted lines

A finding becomes a comment only when its `file:line` maps to a diff-line anchor (`newLine` or
`oldLine`) inside the changed hunks. Findings that cite a line outside the diff -- coverage gaps,
whole-file notes, summary counts, conventions on unchanged lines -- have no anchor and stay in the
text report only. The text report is always complete.

---

## Step 7: Optional tracking

For own-code reviews, ask whether to track critical and important findings. If the user opts in,
create one Linear issue per finding through MCP Linear `save_issue`.

Issue description should include:

- Finding severity
- File and line
- Impact
- Suggested fix
- Review scope

After each Linear issue creation, refresh the local cache through `cape tracker`. If the finding is
under an existing epic, create it as a sub-issue and refresh the parent epic:

```bash
cape tracker cache-epic '<linear-epic-json-with-children>'
```

If the finding is standalone, create or identify the appropriate parent issue first so cache reads
can list it. Skip suggestions unless the user explicitly asks to track cleanup.

For others' PRs, do not track findings; deliver the report and stop.

</the_process>

<skill_references>

## Load `cape:tracker` with the Skill tool when:

- The user opts into tracking review findings as Linear issues

</skill_references>

<examples>

<example>
<scenario>Self-review finds a breaking behavior change</scenario>

**Wrong:** Fix the bug during review and blur review with implementation.

**Right:** Report the critical finding with file-line evidence. If the user chooses tracking, create
a Linear issue for that finding and refresh the tracker cache. </example>

<example>
<scenario>Reviewing someone else's PR</scenario>

**Wrong:** Create local follow-up issues without owning that workflow.

**Right:** Deliver the verdict-first report and stop. </example>

</examples>

<key_principles>

- **Review is evidence, not edits** -- findings need file-line proof
- **Severity follows impact** -- callers, public APIs, and security determine urgency
- **Tracking is opt-in** -- only user-approved findings become Linear issues

</key_principles>
