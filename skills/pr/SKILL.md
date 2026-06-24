---
name: pr
description: >
  Create a pull request with clear description and actionable test plan. Use whenever the user wants
  to open a PR — explicit requests ("create a PR", "open a pull request", "let's PR this",
  "/cape:pr") and implicit ones ("ship it", "ready for review", "push this up"). Also use when
  finish-epic completes and the user wants to publish their work. Runs automatable test plan items
  before creating the PR. Do NOT use for reviewing someone else's PR (use cape:review) or committing
  (use cape:commit).
---

<skill_overview> Create a pull request with conventional title, structured description, and verified
test plan. Detects repo PR templates, validates the branch, confirms a fresh `cape:review` stamp,
runs automatable test plan items, then creates the PR via `gh`. The review-before-pr hook and test
plan act as gates before the PR is created. </skill_overview>

<rigidity_level> MEDIUM FREEDOM — Follow the process exactly as written. Every step must execute in
order. Gates are non-negotiable. The description format comes from the detected template or the
bundled template — never invent sections. </rigidity_level>

<when_to_use>

- User says "create a PR", "open a pull request", "let's PR this", "ship it", "ready for review"
- After finishing an epic and wanting to publish the work
- After committing changes and wanting to open a PR

**Don't use for:**

- Reviewing someone else's PR
- Committing changes (use cape:commit)
- Worktree setup or epic context stamping (use cape:worktree)

</when_to_use>

<critical_rules>

1. **NEVER call `cape pr create` without user confirmation** — present the full description to the
   user first, then use `AskUserQuestion` to get explicit approval. This is the most important rule.
   The one exception is the AFK branch (step 6): when invoked with the `CAPE_ORCHESTRATE` marker,
   print the full description to the transcript and create the PR without `AskUserQuestion`.
2. **NEVER skip the test plan gate** — all checkboxes must be `[x]` before `cape pr create` runs
3. **NEVER skip review-before-pr** — a fresh `reviewedAt` stamp from `cape:review` is required. The
   hard-gate escape is explicit only: invoke `cape:pr` with `CAPE_HARD_GATE_OVERRIDE` to downgrade
   the hook deny to a warning. An orchestrator run uses the distinct `CAPE_ORCHESTRATE` marker for
   the same downgrade, keeping robot runs attributable.
4. **NEVER invent description sections** — use the repo template (step 1) or the bundled template
   (step 5) exactly. Do not create ad-hoc sections like "Summary", "Root cause", etc.
5. **Use `cape pr create`** — not the GitHub API directly
6. **Stop on failure** — report what failed, don't push through

</critical_rules>

<the_process>

## Step 1: Detect PR template

```bash
cape pr template
```

This returns JSON with `source` ("repo" or "default"), `content` (raw template text), and `sections`
(heading names). If `source` is "repo", use that template's section structure and heading levels for
the description. If "default", use the bundled template in step 5.

---

## Step 2: Validate prerequisites

```bash
cape git context
git diff <default-branch>...HEAD --stat
cape state list
```

Use `mainBranch` from the context output as `<default-branch>` throughout.

**Gate checks:**

- Current branch is not the default branch
- All changes are committed
- `reviewedAt` is fresh; if absent or stale, stop and run `cape:review` before continuing. Proceed
  without review only when `cape:pr` is invoked with an explicit override: `CAPE_HARD_GATE_OVERRIDE`
  (human escape) or `CAPE_ORCHESTRATE` (orchestrator AFK run, step 6).

---

## Step 3: Prepare branch

1. Check if branch tracks a remote: `git rev-parse --abbrev-ref @{upstream} 2>/dev/null`
2. If no upstream, push with tracking: `git push -u origin HEAD`
3. If upstream exists, check if local is ahead: `git log @{upstream}..HEAD --oneline`
4. If ahead, push: `git push`
5. Check if branch is up-to-date with target: `git log HEAD..<default-branch> --oneline`
6. If behind, warn the user — don't rebase automatically

---

## Step 4: Check contribution requirements

Auto-detect contribution artifacts by checking for these files. Act only on what exists:

- **CONTRIBUTING.md** — if present, note any PR requirements relevant to the change
- **CHANGELOG.md** — if present with an "Unreleased" section, add an entry for this change
- **.changeset/** — if present, run `npx changeset` interactively

If none exist, skip.

---

## Step 5: Create PR description

Read the full diff against the target branch:

```bash
cape git diff branch
git log <default-branch>..HEAD --oneline
```

Write the description following the detected template structure (step 1). If no repo template was
found, use this bundled template — match the sections and heading levels exactly:

!`cat "${CLAUDE_SKILL_DIR}/resources/pr-template.md"`

**Title:** conventional commit format — `type(scope): subject`

**Quality bar (every PR, not just AFK):** the body is for a reviewer who knows the domain but not
this branch. Write to that reader:

- **Organize by what changed** — group by area / module / feature, in plain language. NEVER by how
  the work was sharded: no `T0 (XYZ-1)` per-task or per-issue-id bullet structure, no per-task test
  counts. The reviewer does not care how the work was split.
- **Name behavior, not the diff** — say what the code now does, not which symbols moved. No dumps of
  type signatures or function names (`FieldDescriptor<E,V,C>`, `compareByField`); those live in the
  diff. Mention an identifier only when the reviewer needs that exact name to find something.
- **Hyperlink tracker ids in prose** (`[ABU-12](https://linear.app/...)`), matching repo PR style.
  Leave the closing `Fixes ABU-XX` / `Related to ABU-XX` line plain — the integration parses the
  bare id, and a link there can break the close.
- **Be short.** A reviewer skims this before reading code. Cut exhaustive enumerations.

**Section guidelines:**

- **Motivation:** why this change, why now (1-3 sentences)
- **Changes:** what the change does, in reviewer terms — behavior and scope, not an identifier list
- **Test plan (checkboxes):** commands to run NOW, before PR creation (e.g., `npm test`,
  `curl localhost:3000/api`) — these are the gate
- **Verification performed:** tests already run during development — evidence, not promises
- **Deployment notes:** post-merge operational steps (migrations, cache flushes) — optional, omit if
  none
- **Manual verification:** subjective judgment only (visual design, UX feel) — optional, omit for
  backend changes
- **Deferred verification:** acceptance checks that need a deployed env and could not run pre-merge
  (see `cape:finish-epic` `[~]`) — list explicitly as not-yet-done, verify post-merge. Distinct from
  Manual verification; never mark these done.
- **Issues:** default to a closing keyword + Linear identifier (`Fixes ABU-XX`) so Linear's GitHub
  integration links AND closes the epic on merge. Use `Related to ABU-XX` (non-closing) ONLY when
  this PR does not complete the epic — more PRs or a live cutover still pending. A non-closing link
  moves the issue through pre-merge statuses but never closes it; that is the usual reason an epic
  stays open after its PR merges. Closing keywords: `close`, `fix`, `resolve`, `complete`,
  `implement` (and their tenses). Never put both keywords on the same id.

If no subjective items exist, omit manual verification entirely. If no deployment steps, omit
deployment notes. Check coverage: happy path, edge cases, integration points, regression risks. If
gaps found, add missing test plan items.

Before presenting or creating the PR, load the global `stop-slop` skill and run the description
prose through it; skip this for pure code or mechanical output.

---

## STOP — Step 6: Present, approve, execute, create (OUTPUT GATE)

**You MUST stop here and get user approval before running tests or creating the PR.**

**AFK branch:** when `cape:pr` is invoked with the `CAPE_ORCHESTRATE` marker, there is no human to
approve. Print the full PR (title, description, automatable items) to the transcript so the opened
PR is on record, skip `AskUserQuestion`, then run the test-plan gate and `cape pr create` as on
approval below. The interactive path below is unchanged when the marker is absent.

No human edits the body before it ships, so the step 5 quality bar applies in full and stop-slop
runs on the body — the "mechanical output" skip never applies, since an AFK PR description is always
prose. Nothing downstream catches a slop description. Two AFK-only rules on top of that bar:

- **Never write the `CAPE_ORCHESTRATE` marker, or any robot signature/emoji, into the PR title or
  body.** It is an input/hook signal only — it must not leak into what reviewers read.
- **Do not narrate the run.** The body describes the change, not the orchestration that produced it
  (no task graph, no agent/review-pass mentions).

Output the full PR:

1. Title
2. Full description with test plan (render `- [ ]` checkboxes verbatim, not as bullet points)
3. Which test plan items are automatable (backticked commands, URLs, assertions)

End output with `---` separator. After the separator, immediately use `AskUserQuestion` with
options:

- **Create PR** — run tests and publish
- **Create draft** — run tests and publish as draft
- **Edit** — revise title or description
- **Cancel** — abort

Do not announce next steps or say "Let me..." after the separator. Present the plan, then ask. Do
not call any tools between outputting the description and calling `AskUserQuestion`.

**On approval (Create PR or Create draft):** run every test-plan checkbox in order, mark each
`- [x]` on pass, keep `- [ ]` on fail. On any failure, stop, report details, ask **Fix and retry**
or **Cancel**. After all pass, validate the rewritten description with `cape pr validate --stdin`
(rejects missing sections AND unchecked boxes — loop back if any `- [ ]` remains), then call
`cape pr create` with the rewritten body. Add `--draft` for the draft option. On creation failure
(push rejected, conflicts): auto-fix if trivial, re-attempt up to 3 times, then ask the user.

```bash
cape pr create --title "the title" --body "$(cat <<'EOF'
<rewritten-description>
EOF
)"
```

---

## Step 7: Finalize

After successful creation, label the herdr workspace, then finalize:

```bash
cape workspace phase pr
```

1. Identify the active epic from tracker cache or flow context.
2. Ensure the PR description references the epic with a closing keyword (`Fixes ABU-XX`). Linear's
   GitHub integration then moves the epic to `In Review` on open and `Done` on merge — cape does not
   set status manually. This requires the GitHub↔Linear integration to be configured (see tracker
   workspace-setup).
3. Add labels: `gh pr edit <number> --add-label <label>` (if project uses label conventions)
4. Add reviewers if the user mentioned any or the project has conventions
5. Report:

```
PR created: <url>

<title>

Test plan: <passed>/<total> checks passed
```

</the_process>

<examples>

<example>
<scenario>Standard feature PR</scenario>

Branch has 3 commits adding a caching layer. No repo PR template found.

1. `cape pr template` → `source: "default"`, sections: Motivation, Changes, Test plan
2. Validate — on `feat/add-cache`, all committed, pushed
3. Write description using bundled template sections (Motivation, Changes, Test plan, Verification)
4. **STOP** — present full PR to user, `AskUserQuestion` → user picks "Create PR"
5. Run test plan: `[x] npm test`, `[x] verify cache hit returns 200`, `[x] verify TTL expiry`
6. `cape pr validate --stdin` passes → `cape pr create` — success
7. Report URL and summary </example>

<example>
<scenario>Repo has its own PR template</scenario>

`cape pr template` → `source: "repo"`, sections: Summary, Testing, Screenshots.

1. Write description matching the repo template's section structure and heading levels exactly
2. Fill in Summary, Testing, Screenshots (include if visual, omit if backend)
3. **STOP** — present to user, get confirmation
4. `cape pr validate --stdin` before `cape pr create`
5. Test plan items still execute as a gate regardless of template structure </example>

<example>
<scenario>Uncommitted changes</scenario>

User says "create a PR" but `git status` shows modified files.

**Right:** "Uncommitted changes detected. Load `cape:commit` first." **Wrong:** Silently commit and
proceed. </example>

</examples>

<key_principles>

- **Present before acting** — show the full PR and get approval before running tests or creating
- **Test plan is the gate** — all checkboxes pass before the PR exists
- **Detect, don't assume** — check for repo templates before falling back
- **Follow the template** — use detected or bundled template sections, never invent your own
- **Evidence over promises** — verification performed records what happened, not what should happen
- **Conventional titles** — `type(scope): subject` matching project conventions

</key_principles>
