# Workspace setup

## Automated (done)

- [x] Created the `Inbox` project in the Aburaya team.
- [x] Set the `Inbox` project description to: "Scope: anything not yet belonging to a real project;
      triage out on touch / Not: long-lived workstreams. Done when: ongoing."
- [x] Confirmed the `type` label group exists with the `chore` child label.
- [x] Confirmed the `src` label group exists with the `cape` and `human` child labels.

## Manual steps (run in the Linear UI)

- [ ] Delete stock workspace labels `Bug`, `Feature`, and `Improvement`.
- [ ] Delete ad-hoc labels `dx`, `infra`, and `tooling`.
- [ ] Create grouped labels `type:bug` and `type:feature` under the `type` label group.
- [ ] Migrate the existing flat `pr-watcher` label into the `src` group as `src:pr-watcher`, then
      retag the 19 or so issues carrying it.
- [ ] Set the `type` and `src` label groups to single-select in the [Linear UI](https://linear.app).
- [ ] Configure the GitHub-Linear integration with PR automation for the Aburaya team (automations
      are per-team settings): PR opened sets status to In Review; PR merged to the default branch
      sets status to Done. cape relies on this; it no longer sets status itself.
- [x] Create epic, task, and bug team-level issue templates from
      [linear-templates.md](linear-templates.md), each defaulting to `src:human` and Medium
      priority. The Bug template prefills the title `Fix `.
- [ ] Once `type:bug` and `type:feature` exist, edit the Task and Bug templates to default to
      `type:feature` and `type:bug` respectively (the Epic template stays untyped).
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
