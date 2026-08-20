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

Cape's hook denies only workflow-specific commands. Install cc-safety-net alongside it for
destructive-command policy (force push, `git reset --hard`, `git clean -f`); without it those run
unblocked on feature branches.

```bash
claude plugin add cc-safety-net@kenryu42/cc-marketplace
```

## Workflow

The `don-cape` router loads at session start and matches each request to a skill. Skills run in four
chains:

| Chain | Steps                                           | Entry    |
| ----- | ----------------------------------------------- | -------- |
| PLAN  | brainstorm → write-plan                         | `/plan`  |
| BUILD | execute-plan → test-driven-development → commit | `/build` |
| SHIP  | finish-epic → pr                                | `/ship`  |
| BUG   | fix-bug → test-driven-development → commit      | None     |

`/plan`, `/build`, and `/ship` are the entry points you type. The steps inside a chain run on their
own through routing. A human gate sits after PLAN and before SHIP, and BUILD stops after each task
so you can review.

Code review has no cape skill. You run Claude Code's builtin `/code-review`, or a skill dispatches
the `code-reviewer` agent, which returns its findings as JSON for the dispatching skill to relay
through one `ReportFindings` call. Either way the findings render the same. The `pr` skill carries
the requirement as a test-plan checkbox, runs the review itself when nothing has reviewed the
current commits, and `cape pr create` refuses a body with an unticked box.

Skill gates are contextual warnings you can ignore. Some Bash commands are denied outright: pushing
to the default branch, `git commit --amend`, `gh pr merge`, and `gh pr close`. Raw commands with a
cape equivalent (`git commit`, `gh pr create`) are redirected, not blocked. Broader
destructive-command policy (force push, `git reset --hard`, `git clean -f`) belongs to the
cc-safety-net plugin, not cape. See [Installation](#installation).

## Skills

Cape ships 12 workflow skills plus the `don-cape` router.

| Skill                     | Role                                                  |
| ------------------------- | ----------------------------------------------------- |
| `brainstorm`              | Explore a design before writing code                  |
| `write-plan`              | Turn a design into a Linear epic and first task       |
| `execute-plan`            | Implement one task, verify it, queue the next         |
| `set-goal`                | Draft a `/goal` and approach prompt for an AFK run    |
| `test-driven-development` | Drive each change RED → GREEN → REFACTOR              |
| `commit`                  | Stage selectively and write a conventional commit     |
| `finish-epic`             | Verify acceptance criteria and hand off the epic      |
| `pr`                      | Open a pull request with a verified test plan         |
| `pr-feedback`             | Triage inbound PR review comments and resolve threads |
| `fix-bug`                 | Diagnose to root cause, then patch test-first         |
| `tracker`                 | Write Linear results into the local cache             |
| `unslop`                  | Cut AI tells from prose and add human voice           |

Skills that emit prose (commit messages, PR descriptions, epic text) run their output through the
`cape:unslop` skill before finalizing.

## Agents

Five agents handle focused sub-tasks. Each dispatch names a model tier.

| Agent                   | Tier   | Use                                                                                |
| ----------------------- | ------ | ---------------------------------------------------------------------------------- |
| `codebase-investigator` | haiku  | Find patterns and verify codebase state; carries bug-tracer and test-auditor modes |
| `code-reviewer`         | opus   | Review a completed step against the epic contract                                  |
| `fact-checker`          | sonnet | Verify claims against codebase and external evidence                               |
| `internet-researcher`   | sonnet | Pull current docs and external knowledge                                           |
| `test-runner`           | haiku  | Run tests and hooks without flooding context                                       |

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
├── agents/       # Agent definitions with model tiers
├── cli/          # cape CLI: validation, git, hooks, tracker cache
├── commands/     # Aliases only; skills are already /cape:name
├── skills/       # Skill workflows
├── hooks/        # Session-start banner, gates, and the tracker cache
├── CLAUDE.md     # Dev guide
└── CHANGELOG.md  # Release history
```

## Contributing

1. Clone the repository and branch off `main`.
2. Put new files in the directory that already holds their kind.
3. Run `pnpm check` and try the change with `claude --plugin-dir .`.
4. Open a pull request.

## License

[MIT](LICENSE)
