# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
