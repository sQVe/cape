# Cape

Collection of opinionated Claude Code commands and skills.

See [README.md](README.md) for usage and structure documentation.

## Development

Run checks:

```bash
pnpm check        # format + lint
pnpm typecheck    # tsc
pnpm test         # unit + e2e
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

- Commands are thin wrappers. Each routes to a skill with
  `Use the cape:<name> skill exactly as written.` Add one only when it earns its keep: a different
  name than the skill (`build` → `execute-plan`) or a skill marked `user-invocable: false`. A
  command named after its own skill duplicates the `/cape:name` entry in the slash-command menu.
  `review` is the one command that carries its own instructions instead of routing to a skill, since
  code review is an agent with no skill behind it and nothing else would make it user-invocable.
- Skills are plain markdown: no XML tags, sentence case headings. The frontmatter description
  carries the triggers; the body starts at the contract. `cape validate` enforces the
  machine-checkable part: frontmatter, a nonempty body, and known `cape:<name>` references. The rest
  of this convention is review-enforced.
- Before adding a skill instruction, run the no-op test: would the model already do this without the
  line? If yes, leave it out, and delete existing lines that fail the same test.
- When a skill points at a doc and the model skips or misreads it, sharpen the pointer's trigger
  wording first. Inline the doc only when a sharper pointer still misses.
- Agents use "Investigation approach" as the section header.
- Every prose file in the repo goes through the `cape:unslop` skill: skills, agents, README, this
  file. The CHANGELOG is the exception, since released entries are a record.
- Tests co-located with source in `cli/src/`. E2E tests in `cli/src/__e2e__/`.
- Effect service pattern: interface in `services/<name>.ts`, live implementation in
  `services/<name>Live.ts`.
- Tracker: this repo's Linear home team is `Aburaya`; agent plans and tasks go to the `AI` team (see
  `skills/tracker`).
