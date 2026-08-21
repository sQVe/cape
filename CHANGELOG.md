# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `cape:bro` restates the previous message in plain language: what happened, what it means, what to
  do next. It explains rather than re-running the work, and it restates a pending choice instead of
  making it. Routed from the `don-cape` table on "explain that", "what does that mean", "in plain
  english", and "eli5".

### Changed

- Skills and agents: eight files gained the disciplines they were missing. TDD names a fallback for
  a genuinely impractical failing test, defines a test not worth writing, and forbids reaching green
  by editing tests or weakening assertions. Brainstorm derives gradeable criteria before dispatching
  its design agents and screens candidates for shallow modules, information leakage, temporal
  decomposition, and pass-through layers. The code reviewer reports that a clean diff looks fine
  instead of filling the report, and flags answers that take more than three files to trace. The
  fact checker reports where it searched when a claim is unverifiable and no longer treats code as
  evidence of its own intent. Finish-epic requires the regression check to name the one fact the
  change is safe because of. Execute-plan treats threading a signal through several layers as a
  stop-and-look moment and verifies a delegate's claims against the files rather than trusting its
  summary. Write-plan settles a non-obvious data shape before the behavior and states whether
  repeated runs converge. Don-cape gained a sixth rule reserving skill prose for what no lint rule,
  hook, or `cape validate` check can enforce.

- Tracker: a plan issue is now a sub-issue of the human ticket it satisfies, and that parent is the
  pair. The `relatedTo` relation and the counterpart markdown links in both bodies are gone, and
  `cape tracker cache-epic` reads `humanTicketId` from `parentId` instead of a hand-stamped field.
  Plans attach only to a leaf ticket, never to one that already has home-team children. Task-level
  pairs still carry an explicit stamp, since a task's parent is the plan issue.

- Hooks: the SessionStart banner is now derived entirely from the current git branch and the tracker
  cache. The epic is matched from the branch against each cached epic's `gitBranchName`, and the
  phase from ready-task counts plus open-PR state (ready tasks = build; none and no PR = ship; PR
  open = pr). Done epics stay silent. `cape workspace phase` derives its epic the same way.

### Fixed

- Tracker: the refresh recipe told skills to pipe a `get_issue` result straight into
  `cape tracker cache-epic`. `get_issue` returns no children and `cache-epic` prunes unstarted tasks
  the payload omits, so following it deleted them. Children now come from `list_issues`.
- Tracker: the agent contract required a project on every issue, which the `AI` team cannot satisfy
  because projects belong to teams. Agent-side issues stay project-less.

### Removed

- CLI: removed the `cape state` and `cape worktree` commands, the per-worktree `state-*.json` files,
  and the Skill-matcher PreToolUse gates. Git and the tracker cache already carry the flow context
  the state files duplicated. The Bash deny gate stays.
- CLI: removed `cape check` and the ecosystem detect service. Every repo documents its check command
  in CLAUDE.md; skills now point there instead of guessing across six ecosystems.

- Skills: removed `cape:worktree`. Grove owns worktree creation; the relabel via
  `cape workspace phase` now lives as Step 0 in `cape:execute-plan`. The `cape worktree` CLI command
  went in this round's shave (above).
- Commands: removed `commands/tracker.md`, the last wrapper duplicating a skill. The tracker skill
  is `user-invocable: false` by design and works as model-loaded plumbing; it was almost never typed
  as a command.
- CLI: removed the event log (`eventLog.ts` and its `events.jsonl` output). It was write-only —
  nothing in the repo, any skill, or any settings file read it.
- Hooks: removed the `warn` deny tier (`git reset --hard`, `git checkout --`, `git clean -f`) and
  the force-push block from the Bash deny table. The cc-safety-net plugin owns destructive-command
  policy globally; cape keeps only its own rules (amend, `gh pr merge|close`, and the
  commit/pr/branch redirects).
- Resources: removed `resources/skill-template.md` and `resources/agent-template.md`.
  `cape validate` is the executable source of truth for definition structure; two markdown mirrors
  of the same schema drifted.
- Agents: removed the dead `notebox-researcher` mode from `codebase-investigator`. The notebox
  plugin is no longer installed, so the mode instructed searches against a tool that does not exist.

### Changed

- Commands: added `/cape:review`, which dispatches the `code-reviewer` agent over the branch diff
  and relays its findings. Code review is an agent with no skill behind it, so nothing else made it
  user-invocable; it is the one command that carries instructions rather than routing to a skill.
- Agents: `code-reviewer` runs on `opus` instead of `sonnet`. Run head to head on the same commit
  with the same prompt, Opus returned every finding Sonnet did plus five more, including a live gate
  bypass (`- [x] Code review run instructions added to CONTRIBUTING.md` satisfied the review gate)
  that two Sonnet passes and two commercial review bots had all cleared.
- Agents: `code-reviewer` reports findings in the `ReportFindings` shape (`file`, `line`, `summary`,
  `short_summary`, `failure_scenario`, `category`, `verdict`) instead of Critical/Important/
  Suggestion prose, so an agent review renders the way the builtin `/code-review` does. The agent
  returns JSON and the dispatching skill relays it; a dispatched agent has no `ReportFindings` tool
  of its own. Its finding bar now requires a concrete failure scenario per finding and refutes only
  what the code disproves.
- Skills: `cape:pr` runs the review itself when nothing has reviewed the current HEAD, instead of
  stopping to ask for one. The review checkbox names the model, the reviewer, and the commit read
  (`- [x] Code review by Claude Sonnet (cape:code-reviewer) on 59a9a3a, ...`), so a reader outside
  the repo can weigh the review and a later commit leaves a visible sha mismatch instead of hiding
  under a ticked box. `cape pr create` requires that attribution: a box that only mentions review,
  like `- [x] Code review checklist updated`, no longer satisfies the gate.
- Skills: a `cape:code-reviewer` pass satisfies the PR review checkbox on any branch, not just the
  AFK one. `cape:pr`, `cape:set-goal`, `cape:don-cape`, and the README no longer claim code review
  is human-only. Ticking the box still requires a real review with its findings addressed.
- Skills: `cape:tracker` slimmed from five steps to the cache shape plus the write-and-refresh
  protocol. Steps that restated `cape tracker --help` are gone; the Linear agent contract (dedupe,
  labels, priority, titles) moved to `skills/tracker/resources/agent-contract.md` so write-plan,
  execute-plan, and fix-bug can load it directly.
- CI: the check job now builds the CLI and runs `cape validate`, so definition lint is enforced
  instead of advisory.

### Added

- Tracker: two-tier team routing. Human-facing tickets go to the Aburaya team; agent-facing plan
  issues and task sub-issues go to the Agents team (AI), linked bidirectionally as pairs. The cache
  carries the pair (`humanTicketId` on epics and, for per-ticket pairs like nested bugs, on tasks),
  task status is cache-only during build, and `cape:pr` builds the closing line from the cache
  (`Fixes <human-id>, <plan-id>, <completed task ids>`). Write-plan and fix-bug create the pairs;
  execute-plan and the code-reviewer read the contract from the AI plan issue; a workspace-setup
  checklist covers the Agents team, its PR automations, and retiring the `agent-ticket` label.

- Skills: added `cape:unslop`, adapted from Cursor's pstack unslop skill: 31 AI-tell patterns, an
  adding-soul pass, and a self-audit for any human-facing prose. Written as plain markdown — the
  first skill under the relaxed validation — and it replaces the external `stop-slop` plugin as
  cape's prose gate.
- Skills: added `cape:pr-feedback`, which drives the inbound PR review-comment loop end to end:
  fetch every open review thread with its node ID, triage each comment as valid, invalid, or out of
  scope with `file:line` evidence, fix the accepted ones (a nit is a direct edit; behavioral changes
  go through `cape:test-driven-development` or `cape:fix-bug`), then reply, resolve the matching
  threads via GraphQL, and commit through `cape:commit`. Thread node IDs come only from the
  `reviewThreads` query and are carried per comment, so resolution never depends on hand-pasted IDs.
  The fetch also pulls top-level review summary bodies (`reviews.nodes.body`) — the main message a
  reviewer types when submitting — and triages them alongside the inline threads; a summary has no
  thread node ID, so it is replied to via a top-level PR comment and never resolved.
- CI: added `.github/workflows/ci.yml`, gating the repo on push to `main` and on pull requests
  targeting `main`. A blocking `check` job runs `format:check`, `lint`, and `typecheck`; a blocking
  `test` job runs the suite; and a non-blocking, PR-only `fallow` job reports code-health findings
  with `gate: new-only` and a comment, never blocking merge. Node 22 with a pnpm cache and
  frozen-lockfile installs; concurrency cancels superseded runs per ref; all third-party actions are
  pinned by commit SHA.
- Skills: added `cape:set-goal`, an interview-first front end that drafts an autonomous
  BUILD-and-SHIP run for an epic and stages it for review -- a `/goal` completion condition plus an
  approach prompt. A three-question interview (builder, reviewer, free-text run instructions) shapes
  the run and auto-derives task source from the cache; TDD is always on, and the reviewer is chosen
  independently of the builder. In a herdr workspace set-goal writes the draft to a temp file and
  opens it in a split editor pane; `:wq` launches the run (arming `/goal` and submitting the prompt
  in one beat), `:cq` cancels. Outside herdr it writes the draft and prints the path. set-goal never
  launches itself. The emitted run verifies tasks by commit, reviews each, reaps per-task worker and
  reviewer tabs, and ships through an AFK PR plus bounded PR-watch.
- Commands: added `cape workspace phase <phase>`, which relabels the current herdr workspace and tab
  with the workflow-phase icon (📋 plan, 🔨 build, 🔍 review, 🚀 pr, ⛔ blocked, ✅ done) for the
  active epic. Best-effort and a safe no-op outside a herdr workspace or with no stamped epic. The
  workflow skills (worktree, execute-plan, fix-bug, pr, finish-epic) call it at each phase
  transition, and a set-goal run labels its per-task worker and reviewer tabs with role icons.
- Commands: added `plan`, `build`, and `ship` phase-entry wrappers.
- CLI: added `cape tracker` cache-write commands for Linear MCP results.
- Skills and commands: added tracker reference skill and slash command wrapper.
- Cache: added `project` and `type` fields on cached epics and tasks, populated from Linear.
- Hooks: added a PostToolUse nudge to refresh the tracker cache after Linear writes.
- Skills: added the Linear agent contract to the tracker skill (dedupe, project-or-Inbox routing,
  one `type:*` label, `src:cape`, Medium priority, naming, `Done when:`, Mermaid for multi-step
  flows), referenced by write-plan, execute-plan, and fix-bug.
- Tracker: added a workspace-setup checklist for the one-time Linear bootstrap.
- Tooling: added fallow for dead-code and duplication auditing, with a staged pre-commit audit.
- Tooling: added `.npmrc` with `save-exact` and `strict-peer-dependencies`.

### Changed

- Skills: shortened every remaining frontmatter description to the pstack style `cape:unslop`
  already used — what the skill does, the strongest trigger, one disambiguation — replacing the long
  trigger-phrase enumerations, which routed worse than short descriptions.
- Docs: ran `cape:unslop` over the prose the skill migration left behind, so the whole repo now
  reads the same way: the README, `CLAUDE.md`, all five agents, and the tracker and PR resource
  files. Em dashes are gone, the last XML tag (`<example_calibration>` in `code-reviewer`) is plain
  markdown, citation format is `(URL, Tier N)` everywhere instead of two spellings, and the README
  drops the directory table that repeated its own tree. `CLAUDE.md` now states the rule: every prose
  file goes through `cape:unslop`, the CHANGELOG excepted.
- CLI: the em dashes in user-facing strings are gone, in `cape --help`, the `flowPhase` entry of
  `cape state list`, the session-start preamble that introduces the don-cape skill, and both unknown
  matcher errors from `cape hook`. Code comments keep theirs.
- Skills: rewrote all 13 remaining skills and the skill template from the XML tag structure to plain
  markdown, applying the `cape:unslop` patterns throughout. The frontmatter description now carries
  the triggers and the body starts at the contract, cutting the sections that restated them; the
  skill set shrinks by about a third with every command, gate, and handoff kept. The migration also
  fixed real defects: `cape:commit` names `--no-confirm` as the only approval waiver,
  `cape:finish-epic` reports deferred criteria instead of "all met", `cape:pr` gains the missing
  Deferred verification template section and scopes `Fixes` vs `Related to`, and five divergent
  cache-staleness paraphrases now point at `cape:tracker`'s canonical rule.
- CLI: `cape validate` now checks skills on frontmatter (`name`, `description`) plus a non-empty
  body, dropping the required XML tag structure so skills can be written as clean markdown. Every
  backticked `cape:<name>` reference in a skill body is validated against the known skills and
  agents together, replacing the old `agent_references`-scoped unknown-agent check.
- Skills: every prose gate now points at `cape:unslop` instead of the global `stop-slop` plugin, so
  the external plugin dependency can be dropped.
- CLI: `cape workspace phase` now labels the workspace `<repo>: <emoji> <description>` instead of
  `<emoji> <ABU-ID> <Title>`, so workspaces from different repositories no longer read as
  near-identical strings in the herdr sidebar. The repo name comes from the `origin` remote
  basename, falling back to the directory holding the shared git data — a grove worktree is named
  after its branch, so the worktree basename would have named the branch. Labels are lowercase apart
  from the emoji, and the description is cut on a word boundary to keep the whole label inside a 40
  character budget. The tab shows `<emoji> <id>`, switching to `<emoji> #<pr-number>` in the `pr`
  phase when the branch has an open PR; a missing `gh`, a failed lookup, or a merged or closed PR
  degrades to the issue id and never fails the command.
- CLI: `cape pr create` and `cape pr validate` now require a checked `/code-review` item in the test
  plan. The old check only rejected unticked boxes, which passed vacuously for a body with no
  checkboxes at all, so the gate could be skipped by omitting the box. The item is located in
  whichever template section names the test plan, and checkbox scanning ignores fenced blocks and
  HTML comments, so a quoted example neither satisfies the gate nor fails the body.
- Pr: an unattended run satisfies the review item with a `cape:code-reviewer` pass. The builtin
  `/code-review` is not model-invocable, so without this an AFK run could never open a PR; the
  checkbox admits "an equivalent agent review" and the agent may tick it only on a reviewer pass.
- Tooling: bumped `@types/node` (25 to 26), `fallow`, `oxfmt`, `oxlint`, `smol-toml`, and `tsdown`
  to their latest releases.
- Skills: rewrote step headings to sentence case across six skills (don-cape, execute-plan,
  finish-epic, fix-bug, tracker, write-plan), matching the documented sentence-case heading rule.
- Skills: every `stop-slop` invocation now also requires simple language and clear, scannable
  structure (pr, commit, brainstorm, tracker, write-plan, finish-epic, fix-bug), so generated prose
  stays plain and readable rather than only stripped of AI tells.
- PR: the issue-linking guidance now defaults to a closing keyword (`Fixes ABU-XX`) so the epic
  auto-closes on merge, and reserves `Related to ABU-XX` for PRs that do not complete the epic. The
  template placeholder no longer pairs both keywords on one line, which had produced non-closing
  epic links that left merged epics open.
- Skills: restructured the epic contract for readability and agent precision. Required behavior is
  now a numbered `R1 | Scenario | Expected result` table that doubles as the testable contract;
  global constraints, durable decisions, and anti-patterns collapse into one `Required constraints`
  section; the approach is framed as a `Proposed approach` the agent may improve; and acceptance
  criteria reference R-IDs. Epics open with a scannable at-a-glance card, and the shape now has a
  Light (default) and a Full variant. Tasks name `Delivers: R1, R2`; write-plan, execute-plan, and
  finish-epic reference R-IDs and required constraints. Fixed a stale `epic-template.md` reference
  in the tracker templates.
- Set-goal: the emitted autonomous run now gates each task on the commit message, not just the
  reviewer verdict. The commit-verify step checks for conventional format plus the task id.
- Agents: consolidated to 5; merged bug-tracer, test-auditor, and notebox-researcher into
  codebase-investigator modes.
- Skills: folded standalone bug diagnosis into fix-bug as a loop-first diagnosis gate.
- Skills: inlined expand-task into execute-plan, added a lightweight pre-flight plan scan, and
  removed the dead standalone expansion gate.
- Skills: folded challenge into brainstorm and task-refinement into write-plan.
- Write-plan: added proportional Global Constraints and per-task Interfaces for multi-task epics.
- Skills: rewired write-plan, execute-plan, fix-bug, and finish-epic to use Linear via the tracker
  protocol instead of local issue-tracking commands.
- Skills: added stop-slop prose gates before finalizing prose-emitting skill output.
- Pr: added an AFK branch that opens a PR unattended when the invoking run states no human is
  present to confirm, skipping the interactive approval while preserving human review of the opened
  PR.
- Hooks: moved execute-plan, finish-epic, and fix-bug gates from br shell-outs to the local tracker
  cache.
- Hooks: softened execute-plan, finish-epic, and direct test-driven-development gates to contextual
  warnings.
- Hooks: the session banner now renders a stale cache with a freshness marker instead of vanishing,
  and detects a real worktree instead of always labeling the branch as one.
- Skills: cape no longer sets Linear status; the PR references the epic with `Fixes ABU-XX` so
  Linear's GitHub integration moves it to In Review on open and Done on merge. finish-epic verifies
  and hands off instead of closing.
- Tooling: consolidated formatting on oxfmt; its config now lives in `vite.config.ts`.
- Tooling: bumped oxlint, oxfmt, vite-plus, and `@types/node`, and added pinned `typescript` and
  `tsx` devDeps.
- Tooling: enabled strict `tsconfig` flags (`exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`).
- Tooling: replaced the code-review-graph MCP server with graphify. The graph is built by the
  `graphify` CLI into a committed `graphify-out/` (`graph.json` + `GRAPH_REPORT.md`) every worktree
  inherits, and `.mcp.json` serves it read-only on demand via uvx. codebase-investigator and
  code-reviewer read the committed report first, then use graphify's tools (`query_graph`,
  `get_neighbors`, `shortest_path`) when the server is present, with Grep/Read as the always-on
  fallback — no per-review rebuild.

### Removed

- Commands: the 11 wrappers named after their own skill (brainstorm, commit, execute-plan,
  finish-epic, fix-bug, pr, pr-feedback, set-goal, test-driven-development, worktree, write-plan).
  Each one registered a second `/cape:name` entry in the slash-command menu on top of the skill's
  own, doubling the list and the always-on token cost for nothing. Skills are invocable as
  `/cape:name` on their own. The `argument-hint` values from `pr-feedback` and `set-goal` moved into
  the skill frontmatter. Remaining commands earn their keep: `build`, `plan`, and `ship` alias
  differently-named skills, and `tracker` exposes a skill marked `user-invocable: false`.
- Skills, commands, and hooks: dropped cape's own review skill in favor of Claude Code's builtin
  `/code-review`. Gone with it: the `review` skill and its slash command, the whole `conform`
  subsystem (command, service, and skill gate), the review-before-pr and conform-before-review hard
  gates, both hook override markers (the human escape and the orchestrator one) along with the CLI
  code that stripped them out of PR titles and bodies, the `reviewedAt` and `conformedAt` state
  keys, and the optional hunk inline-comment integration. The requirement now rides on the PR test
  plan: `skills/pr` ships a `/code-review` checkbox the human ticks, and `cape pr create` already
  refuses a body with an unticked box. The SHIP chain is finish-epic then pr. `agents/code-reviewer`
  stays — it reviews against the epic contract, a different job.
- Skills and commands: analyze-tests, design-an-interface, explain, find-test-gaps, refactor.
- Skills and commands: challenge and task-refinement.
- Skills and commands: replaced beads with tracker.
- CLI and services: removed the br/beads command surface and validation service.
- Hooks: removed br-show-log capture/cleanup and raw br-to-cape-br deny redirects.
- CLI: removed the unused detect, epic, stats, and git validate-branch commands.
- Services: removed the dead `TrackerService` Effect layer (interface, live implementation, and the
  throwing `callLinear` stub) and its test, plus the dead resolveTestCommand export; cache writes
  use the pure transform functions directly.
- Skills: removed the orphaned epic-template.md and a stale elements-of-style prose reference.
- Tooling: removed Prettier in favor of oxfmt.

### Fixed

- Tracker routing: the human tier is no longer hardcoded to Aburaya. Human-facing issues go to the
  repo's home team, resolved from the active pair, the tracker cache, or the repo's CLAUDE.md; the
  agent team is the workspace's `AI` team (matching the real team name), created once per Linear
  workspace.
- CLI: `cape state list` no longer describes `flowPhase` as "read by challenge". The challenge skill
  folded into `cape:brainstorm` long ago; the key now says what actually reads it, the session-start
  and user-prompt-submit context plus the `cape:execute-plan` gate.
- Tracker cache: refreshes are forward-only per task — the more advanced of cached vs incoming state
  wins — so a stale refresh cannot resurrect completed work. `cache-status` derives the state type
  from well-known status names when the argument is omitted and fails on unknown issue ids instead
  of silently no-oping; a full `cache-epic` refresh prunes cache-only tasks that never advanced; and
  the cache readers resolve human ticket ids to their AI plan entries.
- CLI: `cape workspace phase` now reads the tracker cache without the 30-minute TTL check, so the
  herdr workspace label keeps the epic title in long sessions. The TTL-checked read dropped the
  title once the cache went stale, relabeling the workspace to a bare phase icon plus Linear ID.
- CLI: `cape state reset` now clears the current worktree's state file by routing through the same
  per-worktree path resolver as `set`, `clear`, and `list`. It previously removed only the
  unsuffixed `state.json`, so in a linked worktree it reported success while leaving every gate
  stamp intact.
- CLI: the `pr` diff scope now uses `git diff HEAD` for the uncommitted part, so
  staged-but-uncommitted changes appear in review flows. Plain `git diff` covered only unstaged
  changes.
- Skills: the `cape:set-goal` launch helper now gates each send on the main pane's tail (a
  `tail_until` poll over the last 15 unwrapped lines) instead of `herdr wait output`, which matches
  recent scrollback including text older than the wait. Staging itself plants both wait markers in
  the pane -- the helper-script preview contains the literal `Goal set:` and any earlier Esc leaves
  an `Interrupted` line -- so both waits passed instantly, the send sequence lost all pacing, and
  the `/goal` condition and approach prompt merged into one over-length input. With tail polling a
  failed submit aborts the launch instead of merging. The builder interview question now also states
  TDD is enforced for either builder.
- Hooks: per-worktree state (the epic stamp and workflow flags) now lives in its own file per
  repository and worktree instead of a single shared `state.json`. Because `cape` is a symlinked
  binary, `pluginRoot` resolved to one install directory, so every repo, worktree, and herdr
  workspace overwrote one stamp -- a stale stamp from repo A could satisfy a gate in repo B. Each
  worktree now gets `state-<sha256(resolved git-dir)>.json` under the same context directory (the
  resolved git-dir is unique per repo and per worktree); non-git callers use `state-no-repo.json`,
  never the legacy `state.json`, so pre-upgrade leftovers are inert. A git error (timeout, missing
  binary) is distinguished from not-a-repo and skips state IO instead of writing to the fallback
  file. Existing stamps reset once on upgrade; `cape state reset` also removes the legacy
  pre-namespacing files. The tracker cache stays global.
- Hooks: the push gate now resolves the current branch from the hook payload's `cwd` instead of the
  hook process cwd, so a `git push` from a feature-branch worktree is no longer blocked when the
  session sits on the default branch. The branch-vs-default-branch check now lives in one shared
  `resolveBranchInfo` helper used by the push gate, the execute-plan nudge, and `cape pr`.

## [1.3.0] - 2026-03-26

### Added

- Commands: beads and finish-epic slash commands.
- Hooks: `hooks/paths.ts` shared module for path constants.
- Tests: short flag matching, atomic log processing, startup-only log clearing, TDD context
  injection, non-matching extension edge cases.

### Changed

- Hooks: extract shared path constants into `hooks/paths.ts`, reducing duplication across all hooks.
- Hooks: atomic edit-log processing in gentle-reminders (rename-read-unlink instead of
  read-then-truncate).
- Hooks: clear br-show-log only on session startup, not on resume/clear/compact.
- Skills: condense verbose agent dispatch sections into compact protocol format.
- Skills: move skill-to-skill calls into `<skill_references>` sections.
- Skills: replace inline br command templates with `epic-template.md` references.
- Execute-plan: load TDD skill explicitly in Step 2 before writing code.
- Don-cape: update routing for finish-epic and commit triggers.

### Fixed

- Hooks: short flag regexes (`-t`, `-p`, `-l`) in enforce-commands matching inside words.

## [1.2.0] - 2026-03-26

### Added

- Hooks: enforce-commands, gentle-reminders, track-br-show, and track-edits hooks.

### Changed

- Skills: improve wording, agent contracts, and remove redundant rules.
- Skills: replace TDD classification gate with unconditional TDD loading.

## [1.1.0] - 2026-03-25

### Added

- Skills: brainstorm, write-plan, execute-plan, expand-task, finish-epic, commit, pr, review,
  branch, beads, test-driven-development, fix-bug, debug-issue, find-test-gaps, analyze-tests,
  challenge, task-refinement, design-an-interface, don-cape (meta-skill).
- Agents: bug-tracer, codebase-investigator, internet-researcher, notebox-researcher, code-reviewer,
  fact-checker, test-auditor, test-runner.
- Commands: 14 slash commands as thin wrappers for user-invocable skills.
- Hooks: TypeScript session-start hook injecting don-cape, user-prompt-submit hook detecting beads
  context.
- Templates: epic, PR, skill, and agent templates in `resources/`.
- Validation script (`scripts/validate.ts`) for structural linting of skills, agents, and commands.
- Pre-commit hooks with prettier formatting and beads sync (`scripts/beads-sync.sh`).
- code-review-graph MCP server integration for structural code review.
- Workflow chains: build chain (brainstorm → write-plan → execute-plan → finish-epic) and fix chain
  (debug-issue → fix-bug).

### Changed

- Brainstorm: conversational with checkpoints, constraint-driven divergent design agents, Socratic
  questioning, and optional challenge phase.
- Execute-plan: auto-chains commit and finish-epic on task completion.
- Commit: selective staging, conventional format, split detection, failure loop.

## [1.0.0] - 2026-03-06

### Added

- Plugin manifest and marketplace registration.
- Session-start hook confirming plugin loaded.
- Directory structure for agents, commands, and skills.
