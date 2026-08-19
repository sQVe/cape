# Agent contract for Linear writes

Apply this contract before every issue create or update:

- Dedupe first: search open issues in the target project by title keywords. On a match, comment
  instead of creating a duplicate; the comment states what cape would have created and links the
  match.
- Project: route work to a matching named project. Use `Inbox` when no project matches. Never create
  project-less issues. Confirm a new project with the user before creating it.
- Labels: apply `src:cape` to everything cape creates, plus exactly one `type:*` label on tasks and
  bugs (`type:bug`, `type:feature`, `type:chore`); epics stay untyped parents. Also apply
  `agent-ticket` to every task and bug sub-issue cape creates, never to epics or to human-created
  issues cape only updates: it marks the issue as an agent work ticket whose review surface is the
  PR, not the issue, so humans can filter these out (`-label:agent-ticket`) and review only epics
  and human-created work. These labels are created by the workspace bootstrap — until a given label
  exists, apply it best-effort and skip what is missing. See
  [workspace-setup.md](workspace-setup.md).
- Priority: create issues at `Medium`; use `Urgent` only for detected production breakage. Never use
  `High` — it is reserved for the human-curated `Next` view, and cape-created `High` issues inflate
  it.
- Titles: use an imperative verb-object title in sentence case with no prefix, about 70 characters
  or less. Bug titles start with `Fix <symptom>`.
- Bodies: include a load-bearing `Done when:` line. Use a Mermaid block instead of prose for any
  flow, state, or architecture description longer than about three steps.
