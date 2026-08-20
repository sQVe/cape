---
name: pr
description: >
  Create a pull request with a clear description and a verified test plan. Use whenever the user
  wants to open a PR or ship the work. Not for reviewing PRs or committing (cape:commit).
---

# PR

Create a pull request with a conventional title, a template-driven description, and a test plan that
gates creation. Nothing ships until every test plan checkbox passes, including the `/code-review`
box the human runs.

Every step runs in order and the gates are non-negotiable; only the description content adapts to
the change.

## Rules

1. **Never call `cape pr create` without approval.** Present the full description, then use
   `AskUserQuestion` for explicit confirmation. The only exception is the AFK branch in step 4.
2. **Never skip the test plan gate.** Every checkbox must be `[x]` before `cape pr create` runs.
3. **Never tick the `/code-review` box yourself.** The human runs the builtin `/code-review` and
   reports back. Never invoke it or replicate a review in its place; if the box is unticked, stop
   and ask the user to run it. On the AFK branch a `cape:code-reviewer` pass stands in for it.
4. **Never invent description sections.** Use the repo template or the bundled template exactly. No
   ad-hoc "Summary" or "Root cause" sections. The one allowed addition is the Deferred verification
   section from step 3.
5. **Use `cape pr create`**, not the GitHub API directly.
6. **Stop on failure.** Report what failed instead of pushing through.

## Process

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

Whatever the template source, the test plan section must contain a checkbox whose text includes
`/code-review` (the bundled template's "- [ ] /code-review run on this branch..." item). Repo
templates rarely carry it; add it. `cape pr create` refuses a body without that box.

Write the body for a reviewer who knows the domain but not this branch:

- Organize by what changed (area, module, feature), never by how the work was sharded. No per-task
  or per-issue-id bullet structure, no per-task test counts.
- Name behavior, not the diff. Say what the code now does, not which symbols moved. Mention an
  identifier only when the reviewer needs that exact name to find something.
- End the description with the cache-built closing line, whatever the template source:
  `Fixes <human-id>, <plan-id>, <completed task ids>` from `hooks/context/tracker.json`, meaning the
  epic entry's `humanTicketId`, the AI plan issue, and every completed child task plus any completed
  task's own `humanTicketId`; incomplete and canceled children excluded. List only ids that exist:
  AI-only work has no `humanTicketId`, so its line starts at the plan issue. Never invent a
  placeholder. Use `Related to` with the same set ONLY when this PR does not complete the epic.
  Build it now, before approval. It is what catches Linear up on the cache-only build statuses; step
  6 only confirms it.
- Hyperlink tracker ids in prose (`[ABU-12](https://linear.app/...)`). Leave the closing `Fixes` /
  `Related to` line plain; the integration parses the bare ids, and a link there can break the
  close.
- Be short. A reviewer skims this before reading code, so cut exhaustive enumerations.

When acceptance checks need a deployed environment and could not run pre-merge (see
`cape:finish-epic` `[~]`), list them under Deferred verification as plain bullets, never as
checkboxes and never marked done.

Check coverage: happy path, edge cases, integration points, regression risks. Add missing test plan
items for any gaps. Run the title and description through the `cape:unslop` skill before presenting.

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
`AskUserQuestion`, and continue to step 5 as if approved. The builtin `/code-review` is not
model-invocable, so satisfy the review item with a `cape:code-reviewer` pass over the branch diff
instead: tick the box only on a pass. On a fail, fix the findings and re-review, or stop with the
box unticked; `cape pr create` refuses the body either way. Never tick it because no human was
available. No human edits an AFK body before it ships, so the step 3 quality bar and unslop apply in
full, plus two AFK-only rules: never write a robot signature or emoji into the title or body, and
describe the change, not the orchestration that produced it.

### 5. Run the gate and create

On Create PR or Create draft: run every test plan checkbox you can run, in order. Mark each `[x]` on
pass, keep `[ ]` on fail. Tick the `/code-review` box only when the user confirms they ran it and
handled the findings (on the AFK branch, on a `cape:code-reviewer` pass instead). On any failure,
stop, report details, and ask **Fix and retry** or **Cancel**.

After all pass, validate the rewritten description with `cape pr validate --stdin`. It rejects
missing sections and unchecked boxes; loop back if any `- [ ]` remains. Then create:

```bash
cape pr create --title "the title" --body "$(cat <<'EOF'
<rewritten-description>
EOF
)"
```

Add `--draft` for the draft option. On creation failure (push rejected, conflicts): auto-fix if
trivial, re-attempt up to 3 times, then ask the user.

### 6. Finalize

Label the herdr workspace:

```bash
cape workspace phase pr
```

1. Identify the active epic from the tracker cache or flow context and confirm the description
   carries the cache-built closing line: `Fixes <human-id>, <plan-id>, <completed task ids>`, built
   from the epic entry's `humanTicketId` (the human ticket), the AI plan issue, and every task the
   cache marks completed, plus any completed task's own `humanTicketId`; incomplete and canceled
   children excluded, and ids that do not exist omitted (AI-only work has no human ticket). This is
   what catches Linear up on the cache-only build statuses. Use the non-closing `Related to` with
   the same set ONLY when this PR does not complete the epic (more PRs or a live cutover still
   pending). Linear's GitHub integration moves the listed issues to In Review on open and Done when
   a `Fixes` PR merges; cape never sets status manually. This requires the GitHub-Linear integration
   (see tracker workspace-setup).
2. Add labels (`gh pr edit <number> --add-label <label>`) and reviewers when the project has
   conventions or the user named any.
3. Report:

```
PR created: <url>

<title>

Test plan: <passed>/<total> checks passed
```
