# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
  workflow skills (worktree, execute-plan, fix-bug, review, pr, finish-epic) call it at each phase
  transition, and a set-goal run labels its per-task worker and reviewer tabs with role icons.
- Hooks: added the `CAPE_ORCHESTRATE` marker that downgrades the review-before-pr gate for
  orchestrator runs, kept distinct from `CAPE_HARD_GATE_OVERRIDE`.
- Commands: added `plan`, `build`, and `ship` phase-entry wrappers.
- Hooks: added review-before-pr hard gate with the explicit `CAPE_HARD_GATE_OVERRIDE` escape.
- Hooks: added conform-before-review hard gate; `cape conform` stamps a marker that `cape:review`
  requires before it can stamp completion.
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
- Skills: `cape:review` posts findings as inline comments to a live hunk diff session when one is
  open, falling back to text-only otherwise; documented the optional hunk setup in the README.

### Changed

- Skills: rewrote step headings to sentence case across seven skills (don-cape, execute-plan,
  finish-epic, fix-bug, review, tracker, write-plan), matching the documented sentence-case heading
  rule.
- Skills: every `stop-slop` invocation now also requires simple language and clear, scannable
  structure (review, pr, commit, brainstorm, tracker, write-plan, finish-epic, fix-bug), so
  generated prose stays plain and readable rather than only stripped of AI tells.
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
- Set-goal: the emitted autonomous run now gates each task on conventions and the commit message,
  not just the reviewer verdict. `cape conform` findings are a fix-cycle the same as a reviewer
  FAIL, the commit-verify step checks for conventional format plus the task id, and the codex
  reviewer brief lists conform among the already-gated checks so style ownership reads as
  intentional.
- Agents: consolidated to 5; merged bug-tracer, test-auditor, and notebox-researcher into
  codebase-investigator modes.
- Skills: folded standalone bug diagnosis into fix-bug as a loop-first diagnosis gate.
- Skills: folded conform into review for bugs/logic plus conventions, and added the reviewer
  contract.
- Skills: inlined expand-task into execute-plan, added a lightweight pre-flight plan scan, and
  removed the dead standalone expansion gate.
- Skills: folded challenge into brainstorm and task-refinement into write-plan.
- Write-plan: added proportional Global Constraints and per-task Interfaces for multi-task epics.
- Skills: rewired write-plan, execute-plan, fix-bug, finish-epic, and review to use Linear via the
  tracker protocol instead of local issue-tracking commands.
- Skills: added stop-slop prose gates before finalizing prose-emitting skill output.
- Pr: added an AFK branch that opens a PR unattended under the `CAPE_ORCHESTRATE` marker, skipping
  the interactive approval while preserving human review of the opened PR.
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
  inherits, and `.mcp.json` serves it read-only on demand via uvx. codebase-investigator,
  code-reviewer, and the review skill read the committed report first, then use graphify's tools
  (`query_graph`, `get_neighbors`, `shortest_path`) when the server is present, with Grep/Read as
  the always-on fallback — no per-review rebuild.

### Removed

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

- Hooks: per-worktree state (the epic stamp and workflow flags) now lives in its own file per
  worktree instead of a single shared `state.json`. Because `cape` is a symlinked binary,
  `pluginRoot` resolved to one install directory, so every worktree and herdr workspace overwrote
  one stamp -- the last `cape worktree start` won, collapsing multiple workspaces onto the same epic
  label. Each linked worktree now gets its own `state-<name>.json` under the same context directory,
  keyed off `git-dir` differing from `git-common-dir`; the tracker cache stays global.
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
