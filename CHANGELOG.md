# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- Templates: epic, task, PR, skill, and agent templates in `resources/`.
- Validation script (`scripts/validate.ts`) for structural linting of skills, agents, and commands.
- Pre-commit hooks with prettier formatting and beads sync (`scripts/beads-sync.sh`).
- code-review-graph MCP server integration for structural code review.
- Workflow chains: build chain (brainstorm → write-plan → execute-plan → finish-epic) and fix chain
  (debug-issue → fix-bug).
- TDD classification system gating execute-plan's test-driven-development enforcement.

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
