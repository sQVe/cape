# Cape

Collection of opinionated Claude Code commands and skills.

## Installation

Add cape as a Claude Code plugin:

```bash
claude plugin add sQVe/cape
```

Or use it directly from a local clone:

```bash
claude --plugin-dir /path/to/cape
```

## Structure

```
cape/
├── agents/       # Agent definitions
├── commands/     # Slash commands
├── skills/       # Skill workflows
├── hooks/        # Hook scripts and definitions
├── resources/    # Templates and reference files
├── scripts/      # Validation and tooling
├── CLAUDE.md     # Dev guide
└── CHANGELOG.md  # Release history
```

| Directory    | Purpose                                  |
| ------------ | ---------------------------------------- |
| `agents/`    | Specialized agent configurations         |
| `commands/`  | Slash commands invoked with `/cape:name` |
| `skills/`    | Reusable skill workflows                 |
| `hooks/`     | Event hooks (session start, tool calls)  |
| `resources/` | Templates for skills, agents, and epics  |
| `scripts/`   | Validation (`bun scripts/validate.ts`)   |

## Contributing

1. Clone the repository.
2. Create a branch for your change.
3. Place new files in the appropriate directory.
4. Test locally with `claude --plugin-dir .`.
5. Open a pull request.

## License

[MIT](LICENSE)
