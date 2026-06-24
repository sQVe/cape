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
      retag its about 19 issues.
- [ ] Set the `type` and `src` label groups to single-select in the [Linear UI](https://linear.app).
- [ ] Create the standalone `agent-ticket` label (no group): cape applies it to every task and bug
      sub-issue so humans can filter agent work tickets out with `-label:agent-ticket`.
- [ ] Configure the GitHub-Linear integration with PR automation: PR opened sets status to In
      Review; PR merged to the default branch sets status to Done. cape relies on this; it no longer
      sets status itself.
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
      only the true next about 5 issues.
