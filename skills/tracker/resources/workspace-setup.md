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
- [ ] Create the saved view `Orphans` with filter `project = none`; it must read 0 before normal
      tracker use.
- [ ] Create the saved view `Next` with filter `priority = Urgent or High` and status excluding
      `Done` and `Canceled`.
- [ ] Rename the team-named `Aburaya` project to a distinct product noun chosen by a human.
- [ ] Run the one-time priority reset: bulk-clear inflated `High` issues to `Medium`, then re-raise
      only the true next about 5 issues.
