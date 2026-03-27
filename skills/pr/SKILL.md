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
test plan. Detects repo PR templates, validates the branch, runs automatable test plan items, then
creates the PR via `gh`. The test plan acts as a gate — all checkboxes must pass before the PR is
created. </skill_overview>

<rigidity_level> HIGH RIGIDITY — Follow the process exactly as written. Every step must execute in
order. Gates are non-negotiable. The description format comes from the detected template or the
bundled template — never invent sections. </rigidity_level>

<when_to_use>

- User says "create a PR", "open a pull request", "let's PR this", "ship it", "ready for review"
- After finishing an epic and wanting to publish the work
- After committing changes and wanting to open a PR

**Don't use for:**

- Reviewing someone else's PR
- Committing changes (use cape:commit)
- Branch operations (use cape:branch)

</when_to_use>

<critical_rules>

1. **NEVER call `gh pr create` without user confirmation** — present the full description to the
   user first, then use `AskUserQuestion` to get explicit approval. This is the most important rule.
2. **NEVER skip the test plan gate** — all checkboxes must be `[x]` before `gh pr create` runs
3. **NEVER invent description sections** — use the repo template (step 1) or the bundled template
   (step 5) exactly. Do not create ad-hoc sections like "Summary", "Root cause", etc.
4. **Use `gh pr create`** — not the GitHub API directly
5. **Stop on failure** — report what failed, don't push through

</critical_rules>

<the_process>

## Step 1: Detect PR template

Check for a repo-specific template in order:

1. `.github/pull_request_template.md`
2. `.github/PULL_REQUEST_TEMPLATE.md`
3. `docs/pull_request_template.md`

If found: read it and use its section structure for the description. If not found: use the bundled
template in step 5.

---

## Step 2: Validate prerequisites

Run in parallel:

Detect the default branch:

```bash
git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@'
```

Fall back to `main` if the command returns empty. Use this as `<default-branch>` throughout.

```bash
git rev-parse --abbrev-ref HEAD
git status --short
git log --oneline -10
git diff <default-branch>...HEAD --stat
```

**Gate checks:**

- Current branch is not the default branch
- All changes are committed

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

Look for contribution artifacts that need updating:

- **CONTRIBUTING.md** — note any PR requirements
- **CHANGELOG.md** — if it has an "Unreleased" section, add an entry for this change
- **.changeset/** — if present, run `npx changeset` interactively

If none exist, skip.

---

## Step 5: Create PR description

Read the full diff against the target branch:

```bash
git diff <default-branch>...HEAD
git log <default-branch>..HEAD --oneline
```

Write the description following the detected template structure (step 1). If no repo template was
found, use this bundled template — match the sections and heading levels exactly:

!`cat "${CLAUDE_SKILL_DIR}/resources/pr-template.md"`

Use the `elements-of-style:writing-clearly-and-concisely` skill for prose.

**Title:** conventional commit format — `type(scope): subject`

**Section guidelines:**

- Write as if explaining to a colleague who knows the domain but not this code
- **Motivation:** why this change, why now (1-3 sentences)
- **Changes:** what was implemented with technical details
- **Test plan (checkboxes):** commands to run NOW, before PR creation (e.g., `npm test`,
  `curl localhost:3000/api`) — these are the gate
- **Verification performed:** tests already run during development — evidence, not promises
- **Deployment notes:** post-merge operational steps (migrations, cache flushes) — optional, omit if
  none
- **Manual verification:** subjective judgment only (visual design, UX feel) — optional, omit for
  backend changes
- **Issues:** link related issues with "Fixes #" or "Related to #"

If no subjective items exist, omit manual verification entirely. If no deployment steps, omit
deployment notes. Check coverage: happy path, edge cases, integration points, regression risks. If
gaps found, add missing test plan items.

---

## STOP — Step 6: Present and confirm (OUTPUT GATE)

**You MUST stop here and get user approval before proceeding.**

Output the full PR:

1. Title
2. Full description with test plan
3. Which test plan items are automatable (backticked commands, URLs, assertions)

End output with `---` separator. After the separator, immediately use `AskUserQuestion` with
options:

- **Create PR** — run tests and publish
- **Create draft** — run tests and publish as draft
- **Edit** — revise title or description
- **Cancel** — abort

Do not announce next steps or say "Let me..." after the separator. Present the plan, then ask. Do
not call any tools between outputting the description and calling `AskUserQuestion`.

---

## Step 7: Execute test plan

Run each test plan checkbox item sequentially:

1. Execute the command or verification
2. Mark result immediately: `[x]` passed, `[ ]` failed
3. On first failure:
   - Stop execution, report failure details
   - Ask user: **Fix and retry** or **Cancel**
   - Do NOT proceed to next item until current passes
4. Continue until all items pass

All checkboxes must be `[x]` to proceed. Manual verification section is informational only.

---

## Step 8: Create PR (fix loop, max 3 attempts)

```bash
gh pr create --title "the title" --body "$(cat <<'EOF'
<description>
EOF
)"
```

Add `--draft` flag if user chose "Create draft" in step 6.

If creation fails (push rejected, conflicts):

1. Analyze failure output
2. Auto-fix if possible (push, rebase)
3. Re-attempt
4. After 3 failures: report issues, ask user to fix manually

---

## Step 9: Finalize

After successful creation:

1. Add labels: `gh pr edit <number> --add-label <label>` (if project uses label conventions)
2. Add reviewers if the user mentioned any or the project has conventions
3. Report:

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

1. Detect template — none found, use bundled template
2. Validate — on `feat/add-cache`, all committed, pushed
3. Write description using bundled template sections (Motivation, Changes, Test plan, Verification)
4. **STOP** — present full PR to user, `AskUserQuestion` → user picks "Create PR"
5. Run test plan: `[x] npm test`, `[x] verify cache hit returns 200`, `[x] verify TTL expiry`
6. `gh pr create` — success
7. Report URL and summary </example>

<example>
<scenario>Repo has its own PR template</scenario>

`.github/pull_request_template.md` exists with sections: Summary, Testing, Screenshots.

1. Read repo template — write description matching its section structure exactly
2. Fill in Summary, Testing, Screenshots (include if visual, omit if backend)
3. **STOP** — present to user, get confirmation
4. Test plan items still execute as a gate regardless of template structure </example>

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
