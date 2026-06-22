# Cape

Opinionated Claude Code commands and skills for a single-agent build workflow.

Cape routes every task to the right skill and runs it through one of four chains: plan a change,
build it test-first, ship it, or fix a bug. Issue state lives in [Linear](https://linear.app); a
session-start banner shows where you left off.

## Installation

Add cape as a Claude Code plugin:

```bash
claude plugin add sQVe/cape
```

Or run it from a local clone:

```bash
claude --plugin-dir /path/to/cape
```

The plugin ships a `cape` CLI that the skills and hooks call. Build it and put it on your `PATH`:

```bash
pnpm install && pnpm build
ln -s "$PWD/cli/dist/index.mjs" ~/.local/bin/cape
```

## Inline review with hunk (optional)

`cape:review` can post its findings into [hunk](https://github.com/modem-dev/hunk), a terminal diff
viewer, so they show up inline in the diff you are reading. Skip this and the review stays
text-only.

Install hunk and open a session before you review:

```bash
npm i -g hunkdiff       # binary: hunk (Node 18+)
hunk diff --watch       # run in a separate pane; reloads as changes land
```

When a session is open, `cape:review` finds it and adds inline comments under the author
`cape:review`. Run the review again and it replaces those comments instead of stacking them. Cape
ships no config for hunk; tune hunk through its own `~/.config/hunk/config.toml` or a per-repo
`.hunk/config.toml`.

## Workflow

The `don-cape` router loads at session start and matches each request to a skill. Skills run in four
chains:

| Chain | Steps                                           | Entry    |
| ----- | ----------------------------------------------- | -------- |
| PLAN  | brainstorm → write-plan                         | `/plan`  |
| BUILD | execute-plan → test-driven-development → commit | `/build` |
| SHIP  | finish-epic → review → pr                       | `/ship`  |
| BUG   | fix-bug → test-driven-development → commit      | —        |

`/plan`, `/build`, and `/ship` are the user-invoked entry points. The steps inside each chain run on
their own through routing. A human gate sits after PLAN and before SHIP, and BUILD stops after each
task so you can review.

Two gates are hard and block the next step:

- TDD red-before-green: write a failing test before the production code that passes it.
- Review-before-pr: a review must run before `pr` opens a pull request.

Set `CAPE_HARD_GATE_OVERRIDE` to bypass either one. Every other gate is a contextual warning you can
ignore.

## Skills

Cape ships 11 workflow skills plus the `don-cape` router.

| Skill                     | Role                                              |
| ------------------------- | ------------------------------------------------- |
| `brainstorm`              | Explore a design before writing code              |
| `write-plan`              | Turn a design into a Linear epic and first task   |
| `execute-plan`            | Implement one task, verify it, queue the next     |
| `test-driven-development` | Drive each change RED → GREEN → REFACTOR          |
| `commit`                  | Stage selectively and write a conventional commit |
| `finish-epic`             | Verify success criteria and close the epic        |
| `review`                  | Review changes for bugs, logic, and conventions   |
| `pr`                      | Open a pull request with a verified test plan     |
| `fix-bug`                 | Diagnose to root cause, then patch test-first     |
| `worktree`                | Create a per-epic grove worktree                  |
| `tracker`                 | Write Linear results into the local cache         |

Skills that emit prose (commit messages, PR descriptions, epic text, review write-ups) run their
output through the `stop-slop` skill before finalizing.

## Agents

Five agents handle focused sub-tasks. Each dispatch names a model tier.

| Agent                   | Tier   | Use                                                                                                     |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| `codebase-investigator` | haiku  | Find patterns and verify codebase state; carries bug-tracer, test-auditor, and notebox-researcher modes |
| `code-reviewer`         | sonnet | Review a completed step against the epic contract                                                       |
| `fact-checker`          | sonnet | Verify claims against codebase and external evidence                                                    |
| `internet-researcher`   | sonnet | Pull current docs and external knowledge                                                                |
| `test-runner`           | haiku  | Run tests and hooks without flooding context                                                            |

## Tracker and Linear

Cape tracks epics and tasks as Linear issues and sub-issues through a Tracker seam (`createEpic`,
`createTasks`, `listReady`, `updateStatus`, `close`). Writes go to Linear in-session through the MCP
Linear plugin.

Reads never touch the network. The `cape tracker` CLI writes Linear results into a local cache
(`hooks/context/tracker.json`), and the session-start hook reads that cache to render the banner:
epic, phase, task progress, next task, and branch. The banner stays absent when no epic is active.

## Repository structure

```text
cape/
├── agents/       # Agent definitions
├── cli/          # cape CLI (TypeScript, Effect services)
├── commands/     # Slash commands invoked with /cape:name
├── skills/       # Skill workflows
├── hooks/        # Hook definitions and context cache
├── resources/    # Templates and reference files
├── CLAUDE.md     # Dev guide
└── CHANGELOG.md  # Release history
```

| Directory    | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `agents/`    | Agent configurations with model tiers                 |
| `cli/`       | The `cape` CLI: validation, git, hooks, tracker cache |
| `commands/`  | Slash commands invoked with `/cape:name`              |
| `skills/`    | Reusable skill workflows                              |
| `hooks/`     | Session-start banner, gates, and the tracker cache    |
| `resources/` | Templates for skills, agents, epics, and PRs          |

## Contributing

1. Clone the repository.
2. Create a branch for your change.
3. Place new files in the appropriate directory.
4. Test locally with `claude --plugin-dir .`.
5. Open a pull request.

## License

[MIT](LICENSE)
