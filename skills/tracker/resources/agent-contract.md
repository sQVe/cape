# Agent contract for Linear writes

Apply before every issue create or update.

- **Team.** Route by audience. Agent-facing issues (plans, contracts, task sub-issues) go to the
  workspace's agent team, named `AI`; human-facing issues go to the repo's home team — the team
  where that repo's tracked work already lives. The `AI` team is never a home team. Resolve the home
  team in order: the team of the active pair's human ticket (the cached epic entry's `humanTicketId`
  prefix — the cached epic itself is the AI plan issue, so never its own team), the team of the
  repo's human-facing issues in the tracker cache, the team named in the repo's CLAUDE.md, then ask
  the user. Never guess, and never route across workspaces. Pass the team as a `save_issue`
  parameter with no config layer.
- **Dedupe first.** Search open issues in the target project by title keywords. On a match, comment
  instead of creating a duplicate; the comment states what cape would have created and links the
  match.
- **Project.** Route work to a matching named project. Use `Inbox` when no project matches. Never
  create project-less issues in a home team. Confirm a new project with the user before creating it.
  Projects belong to teams, so a project the `AI` team does not share is rejected on save; leave
  those agent-side issues project-less rather than inventing a project for them.
- **Labels.** Discover them, never assume them. Run
  `list_issue_labels(team: <target team>, limit: 250)` once per team per session before the first
  labeled write, and send the returned name verbatim, its own casing included. Match
  case-insensitively to find the label, then send it spelled as the listing spelled it, so `Bug`
  goes out as `Bug`. The `limit` matters: the default page is 50 ordered by recency, and a label
  past that page reads as absent.

  Two slots, at most one label each, filled only when the listing offers a match: a source marker
  (`cape`) on everything cape creates, and one work-type label (`bug`, `feature`, `chore`) on the
  AI-side work issue — tasks and AI bug issues. Leave an unmatched slot empty, and never create a
  label or invent a near-miss; an unmatched slot is a workspace-setup gap, not something to fix
  mid-write. Plan issues and human tickets stay untyped parents, the human half of a bug pair
  included. The team boundary is what marks agent work, so the retired `agent-ticket` label is never
  applied even where it still exists.

  Two API details decide whether the call succeeds. Pass names, never the `group:child` form
  Linear's UI shows: groups are display grouping, `save_issue` resolves the child name alone, so
  `cape` works and `src:cape` is rejected with "Could not find or access label(s)". And `labels`
  replaces the whole set rather than adding to it, so one unresolved name rejects the entire call,
  and an update that touches labels must resend the ones the issue already carries. See
  [workspace-setup.md](workspace-setup.md).

- **Priority.** Create issues at `Medium`; use `Urgent` only for detected production breakage. Never
  use `High`. It is reserved for the human-curated `Next` view, and cape-created `High` issues
  inflate it.
- **Titles.** Use an imperative verb-object title in sentence case with no prefix, about 70
  characters or less. Bug titles start with `Fix <symptom>`.
- **Bodies.** Include a `Done when:` line the work hangs on. Use a Mermaid block only for branching
  flow, state, or architecture descriptions; a straight-line pipeline stays prose.
