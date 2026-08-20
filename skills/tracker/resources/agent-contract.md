# Agent contract for Linear writes

Apply before every issue create or update.

- **Team.** Route by audience. Agent-facing issues (plans, contracts, task sub-issues) go to the
  workspace's agent team, named `AI`; human-facing issues go to the repo's home team — the team
  where that repo's tracked work already lives. The `AI` team is never a home team. Resolve the home
  team in order: the team of the active pair's human ticket (the cached epic entry's `humanTicketId`
  prefix — the cached epic itself is the AI plan issue, so never its own team), the team of the
  repo's human-facing issues in the tracker cache, the team named in the repo's CLAUDE.md, then ask
  the user. Never guess, and never route across workspaces. Pass the team as a `save_issue`
  parameter — no config layer.
- **Dedupe first.** Search open issues in the target project by title keywords. On a match, comment
  instead of creating a duplicate; the comment states what cape would have created and links the
  match.
- **Project.** Route work to a matching named project. Use `Inbox` when no project matches. Never
  create project-less issues. Confirm a new project with the user before creating it.
- **Labels.** Apply `src:cape` to everything cape creates, plus exactly one `type:*` label
  (`type:bug`, `type:feature`, `type:chore`) on the AI-side work issue: tasks and AI bug issues.
  Human tickets — including the human half of a bug pair — and plan issues stay untyped parents. The
  team boundary marks agent work — the retired `agent-ticket` label is never applied. The workspace
  bootstrap creates these labels; until a given label exists, apply it best-effort and skip what is
  missing. See [workspace-setup.md](workspace-setup.md).
- **Priority.** Create issues at `Medium`; use `Urgent` only for detected production breakage. Never
  use `High`. It is reserved for the human-curated `Next` view, and cape-created `High` issues
  inflate it.
- **Titles.** Use an imperative verb-object title in sentence case with no prefix, about 70
  characters or less. Bug titles start with `Fix <symptom>`.
- **Bodies.** Include a load-bearing `Done when:` line. Use a Mermaid block instead of prose for any
  flow, state, or architecture description longer than about three steps.
