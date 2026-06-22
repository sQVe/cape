# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Changed

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
- Hooks: moved execute-plan, finish-epic, and fix-bug gates from br shell-outs to the local tracker
  cache.
- Hooks: softened execute-plan, finish-epic, and direct test-driven-development gates to contextual
  warnings.
- Hooks: the session banner now renders a stale cache with a freshness marker instead of vanishing,
  and detects a real worktree instead of always labeling the branch as one.
- Skills: cape no longer sets Linear status; the PR references the epic with `Fixes ABU-XX` so
  Linear's GitHub integration moves it to In Review on open and Done on merge. finish-epic verifies
  and hands off instead of closing.

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
