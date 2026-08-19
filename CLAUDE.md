# Cape

Collection of opinionated Claude Code commands and skills.

See [README.md](README.md) for usage and structure documentation.

## Development

Run checks:

```bash
pnpm check        # lint + typecheck + test
pnpm test:unit    # unit tests only
pnpm test:e2e     # end-to-end tests only
pnpm build        # build CLI
```

Validate definitions:

```bash
cape validate           # all skills, agents, commands
cape validate skills    # skills only
```

## Conventions

- Commands are thin wrappers — route to skills via `Use the cape:<name> skill exactly as written.`
  Add one only when it earns its keep: a different name than the skill (`build` → `execute-plan`) or
  a skill marked `user-invocable: false`. A command named after its own skill duplicates the
  `/cape:name` entry in the slash-command menu.
- Skills place `<critical_rules>` before `<the_process>`. `cape validate` is the source of truth for
  required structure.
- Agents use "Investigation approach" as the section header.
- Tests co-located with source in `cli/src/`. E2E tests in `cli/src/__e2e__/`.
- Effect service pattern: interface in `services/<name>.ts`, live implementation in
  `services/<name>Live.ts`.
