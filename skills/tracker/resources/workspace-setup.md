# Workspace setup

## Automated (done)

- [x] Created the `Inbox` project in the Aburaya team.
- [x] Set the `Inbox` project description to: "Scope: anything not yet belonging to a real project;
      triage out on touch / Not: long-lived workstreams. Done when: ongoing."
- [x] Confirmed the `type` label group exists with the `bug`, `feature`, and `chore` child labels.
- [x] Confirmed the `src` label group exists with the `cape`, `human`, and `pr-watcher` child
      labels.

Groups are display-only in Linear. A child label's name is the bare word (`cape`, `bug`), and that
is what the MCP `labels` parameter resolves; `src:cape` is rejected. The agent contract states the
rule, this checklist matches the names to it.

This taxonomy is Aburaya's, not a cape requirement. Cape lists a team's labels before its first
labeled write and applies only what it finds, so a workspace with flat capitalized labels gets the
ones that match and a workspace with none gets no labels at all. Nothing breaks either way. Adding
`cape` and a `bug` / `feature` / `chore` set to a new workspace buys the source and type filters
back; skipping it costs only those filters.

## Manual steps (run in the Linear UI)

- [x] Delete stock workspace labels `Bug`, `Feature`, and `Improvement`.
- [x] Delete ad-hoc labels `dx`, `infra`, and `tooling`.
- [ ] Set the `type` and `src` label groups to single-select in the [Linear UI](https://linear.app).
- [ ] Configure the GitHub-Linear integration with PR automation for the Aburaya team (automations
      are per-team settings): PR opened sets status to In Review; PR merged to the default branch
      sets status to Done. cape relies on this to close the human ticket and plan issue.
- [x] Create epic, task, and bug team-level issue templates from
      [linear-templates.md](linear-templates.md), each defaulting to the `human` src label and
      Medium priority. The Bug template prefills the title `Fix `.
- [ ] Edit the Task and Bug templates to default to the `feature` and `bug` type labels respectively
      (the Epic template stays untyped).
- [ ] Optionally set the `Task` template as the team default issue template (Settings → team →
      Templates → Default issue template).
- [ ] Create the saved view `Orphans` with filter `project = none`; it must read 0 before normal
      tracker use.
- [ ] Create the saved view `Next` with filter `priority = Urgent or High` and status excluding
      `Done` and `Canceled`.
- [ ] Rename the team-named `Aburaya` project to a distinct product noun chosen by a human.
- [ ] Run the one-time priority reset: bulk-clear inflated `High` issues to `Medium`, then re-raise
      only the five or so issues that really are next.

## Two-tier team setup (run in the Linear UI)

Prerequisites for the two-tier contract in [SKILL.md](../SKILL.md): human tickets in the repo's home
team (`Aburaya` here), agent plan issues and tasks in the workspace's `AI` team. A human runs these
once per Linear workspace before its first paired epic — a separate workspace (for example, the work
one) needs its own `AI` team and automations.

- [x] Create the team `AI` in Linear (issue ids like `AI-12`).
- [ ] Enable the AI team's PR automations (per-team settings): PR opened sets status to In Review;
      PR merged to the default branch sets status to Done.
- [ ] Move the `src` and `type` label groups to workspace level so both teams share them.
- [ ] Retire the `agent-ticket` label; the team boundary replaces it (agent work tickets live in AI,
      so humans filter by team instead of label).

On the first paired epic, verify two things: AI PR automations fire from cape-repo PRs, and the
cross-team closing line moves both issues to Done on merge. Linear's own docs show the multi-team
form, `Fixes ABU-x, AI-y`.

Free-plan caveat: `AI` uses the second of the two free team slots, so any third team needs a plan
upgrade.

## herdr sidebar (run once, in herdr's config.toml)

`cape workspace phase` reports the workflow phase to the current herdr workspace as display-only
metadata under the source `cape`. herdr renders it only where a layout asks for it, and cape cannot
write herdr's config, so without this step the reports land and nothing shows:

```toml
[ui.sidebar.spaces]
rows = [
  ["state_icon", "workspace", { token = "$phase", dim = true }],
  [{ token = "branch", dim = true }, "git_status"],
]
```

Apply with `herdr config check` then `herdr server reload-config`. A row disappears when none of its
tokens have a value, so the layout is inert in workspaces cape never touches.

Two constraints worth knowing before editing the rows: `fg` takes a hex string only (named colors
are rejected, and hex does not follow a theme switch, so prefer `dim` for de-emphasis), and phase
sits on the first row on purpose, because a long branch name on the second row consumes the whole
sidebar width before a later token gets a column.
