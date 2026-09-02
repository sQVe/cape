---
name: pr
description: >
  Create a pull request with a clear description and a verified test plan. Use whenever the user
  wants to open a PR or ship the work. Not for reviewing PRs or committing (cape:commit).
---

# PR

Create a pull request with a conventional title, a template-driven description, and a test plan that
gates creation. Nothing ships until every test plan checkbox passes, including the review box, and
the skill runs the review itself when no review covers the branch.

## Rules

1. **Never call `cape pr create` without approval.** Present the full description, then use
   `AskUserQuestion` for explicit confirmation. The only exception is the AFK branch in step 4.
2. **Never tick the review box without a review that covers the branch.** A review covers the branch
   when it read the current HEAD, or when every commit after the sha it read only fixes what its
   findings named, through wording or mechanical edits. Addressing findings is how a review round
   ends, not a reason to start another. A fix that goes beyond the finding (new behavior, a new code
   path, a new guard) is unreviewed work; review that delta before ticking. Reuse a covering review
   from this session. Otherwise run one: dispatch `cape:code-reviewer` over the branch diff. The
   user running the builtin `/code-review` satisfies it too. Tick only once the findings are
   addressed or dismissed, and never stop to ask for a review you can run yourself.
3. **Never invent description sections.** Use the repo template or the bundled template exactly. No
   ad-hoc "Summary" or "Root cause" sections. The one allowed addition is the template's Deferred
   verification section.
4. **Stop on failure.** Report what failed instead of pushing through.

## Process

Re-invocation short-circuit, checked before step 1: when the user approved a title and description
earlier this session, the branch HEAD is unchanged since that approval, and neither text has
changed, skip straight to step 5 with the option the user chose (PR or draft); approval does not
expire with re-invocation. A new commit or an edited text means the full process runs again.
Checkbox ticks and review attribution written by step 5 are gate bookkeeping, not edits; they never
void the approval.

### 1. Detect the PR template

```bash
cape pr template
```

Returns JSON with `source` ("repo" or "default"), `content`, and `sections`. When `source` is
"repo", follow that template's section structure and heading levels. Otherwise use the bundled
template in step 3.

### 2. Validate and prepare the branch

```bash
cape git context
git diff <default-branch>...HEAD --stat
```

Use `mainBranch` from the context output as `<default-branch>` throughout. Two gate checks: the
current branch is not the default branch, and all changes are committed. On uncommitted changes,
stop and point the user to `cape:commit`.

Then sync the remote:

1. `git rev-parse --abbrev-ref @{upstream} 2>/dev/null`. No upstream: `git push -u origin HEAD`.
2. `git log @{upstream}..HEAD --oneline`. Ahead: `git push`.
3. `git log HEAD..<default-branch> --oneline`. Behind: warn the user, never rebase automatically.

Check contribution artifacts and act only on what exists: CONTRIBUTING.md (note any PR requirements
relevant to the change), CHANGELOG.md with an "Unreleased" section (add an entry), `.changeset/`
(run `npx changeset` interactively).

### 3. Write the description

Read the full diff and commit list:

```bash
cape git diff branch
git log <default-branch>..HEAD --oneline
```

Write the description following the detected template. If no repo template exists, match this
bundled template's sections and heading levels exactly:

!`cat "${CLAUDE_SKILL_DIR}/resources/pr-template.md"`

The title uses conventional commit format: `type(scope): subject`.

Whatever the template source, the test plan section must contain a review checkbox that opens with
the review token and attributes the review. The shape is
`Code review by <model> (<reviewer>) on <sha>`: the model first, since that is the part a reader
outside this repo can weigh, then the reviewer that ran it, then the commit reviewed. A human
reviewer is their own name, with no parenthetical.

```text
- [x] Code review by Claude Opus 5 (cape:code-reviewer) on 59a9a3a, findings addressed or dismissed
```

Write the model you actually ran, never a version you are guessing at. Repo templates rarely carry
the box; add it.

Write the body for a reviewer who knows the domain but not this branch:

- Organize by what changed (area, module, feature), never by how the work was sharded. No per-task
  or per-issue-id bullet structure, no per-task test counts. Cut anything narrating how you got
  here: the body describes the change, not the investigation.
- Name behavior, not the diff. Say what the code now does, not which symbols moved. Mention an
  identifier only when the reviewer needs that exact name to find something.
- End with the closing line, built from `cape tracker show` as the comment above the template's
  `Fixes` line says, whatever the template source. Build it now, before approval; never invent a
  placeholder.
- Hyperlink tracker ids in prose (`[ABU-12](https://linear.app/...)`). Leave the closing `Fixes` /
  `Related to` line plain; the integration parses the bare ids, and a link there can break the
  close.

Check coverage: happy path, edge cases, integration points, regression risks. Add missing test plan
items for any gaps.

### 4. STOP: present and get approval (output gate)

**Stop here. Get user approval before running tests or creating the PR.**

Output the full PR:

1. Title
2. Full description with test plan (render `- [ ]` checkboxes verbatim, not as bullet points)
3. Which test plan items are automatable (backticked commands, URLs, assertions)

End with a `---` separator, then immediately use `AskUserQuestion` with options:

- **Create PR.** Run tests and publish
- **Create draft.** Run tests and publish as draft
- **Edit.** Revise title or description
- **Cancel.** Abort

Do not announce next steps or say "Let me..." after the separator, and do not call any tools between
outputting the description and calling `AskUserQuestion`.

**AFK branch.** Take this branch only when the invoking run explicitly states it is unattended; when
in doubt, a human is present and the interactive path applies unchanged. Print the full PR (title,
description, automatable items) to the transcript so the opened PR is on record, skip
`AskUserQuestion`, and continue to step 5 as if approved. The review runs the same way it does with
a human present, since step 5 dispatches it. Step 5's failure path asks a question this branch has
no one to ask, so take this instead: on a review that needs changes, fix what the findings named and
run one re-review over the fix delta, since an unattended fix is never self-certified; if that
re-review still needs changes, stop with the box unticked and report why. `cape pr create` refuses
the body either way. No robot signature in the title or body.

### 5. Run the gate and create

On Create PR or Create draft: run every test plan checkbox you can run, in order. Mark each `[x]` on
pass, keep `[ ]` on fail. For the review box: when no review covers the branch (rule 2), run
`cape workspace phase review`, dispatch `cape:code-reviewer` over the branch diff now, and address
or dismiss each finding. Then rewrite the box to name the model, the reviewer, and the commit it
read, and tick it. On any failure, stop, report details, and ask **Fix and retry** or **Cancel**.

After all pass, create:

```bash
cape pr create --title "the title" --body "$(cat <<'EOF'
<rewritten-description>
EOF
)"
```

Add `--draft` for the draft option. On creation failure (push rejected, conflicts): auto-fix if
trivial, re-attempt up to 3 times, then ask the user.

### 6. Finalize

Report the phase to the herdr workspace:

```bash
cape workspace phase pr
```

1. Confirm the description carries the step 3 closing line (`Fixes <human-id>, <plan-id>`). Linear's
   GitHub integration moves the listed issues to In Review on open and Done at merge; cape never
   closes them manually.
2. Add labels (`gh pr edit <number> --add-label <label>`) and reviewers when the project has
   conventions or the user named any.
3. Report:

```
PR created: <url>

<title>

Test plan: <passed>/<total> checks passed
```
