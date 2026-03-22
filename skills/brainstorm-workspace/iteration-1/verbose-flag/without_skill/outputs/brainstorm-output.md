# Brainstorm: adding `--verbose` flag to the CLI

## What I'd investigate first

Before writing code, I'd look at:

1. **`src/cli.ts`** -- how `--quiet` and `--json` are defined (likely a flag parser like `yargs`,
   `commander`, or a hand-rolled options object).
2. **How `--quiet` suppresses output** -- is there a logger abstraction, or do call-sites check
   `options.quiet` directly?
3. **Whether `--quiet` and `--json` are mutually exclusive** -- this determines how `--verbose`
   should interact with them.
4. **Existing log levels** -- is there a `LogLevel` enum or similar, or just boolean flags?

## Approaches

### Approach A: boolean flag, mirror the `--quiet` pattern

Add `--verbose` as a simple boolean, exactly like `--quiet`. Every place that currently gates output
on `!options.quiet` gains a parallel check for `options.verbose` to emit extra detail.

**Pros:** Minimal change, consistent with existing code. **Cons:** Three independent booleans
(`quiet`, `json`, `verbose`) create invalid combinations (`--quiet --verbose`). Logic scatters
across call-sites.

### Approach B: log-level enum that subsumes all three flags

Replace the booleans with a single `logLevel` field (`silent | normal | verbose`) and keep `--json`
as an orthogonal output-format flag. The CLI still accepts `--quiet` and `--verbose` but maps them
internally:

```typescript
const logLevel = options.quiet ? "silent" : options.verbose ? "verbose" : "normal";
```

**Pros:** Single source of truth, impossible invalid states (quiet + verbose), easier to extend
later. **Cons:** Refactor touches every existing `options.quiet` check. Larger diff for a "small"
feature.

### Approach C: logger abstraction

Introduce a thin `Logger` that respects the level:

```typescript
const logger = createLogger({ level: logLevel, json: options.json });
logger.debug("detailed info"); // only in verbose
logger.info("normal output"); // normal + verbose
logger.error("always shown"); // always
```

Call-sites use `logger.debug()` for verbose-only output instead of checking a flag.

**Pros:** Cleanest long-term. Centralizes formatting and level concerns. `--json` mode can emit
structured logs from the same calls. **Cons:** Biggest refactor. May be overkill if the CLI is
small.

## Trade-offs and interactions

| Combination         | Behavior                                                                 |
| ------------------- | ------------------------------------------------------------------------ |
| `--verbose --quiet` | Should error or last-flag-wins. Erroring is safer.                       |
| `--verbose --json`  | Reasonable: emit more fields in the JSON output.                         |
| `--json --quiet`    | Suppress all stdout; only exit code matters. Already works if it exists. |

## Recommendation

**Start with Approach A, validate with Approach B's constraint.**

1. Add `--verbose` as a boolean flag, mirroring the `--quiet` definition in `src/cli.ts`.
2. Add a mutual-exclusion check: if both `--quiet` and `--verbose` are set, exit with an error
   message.
3. At call-sites, gate verbose output behind `if (options.verbose)` -- same pattern as
   `if (!options.quiet)`.
4. If the CLI already has more than ~3 places checking `options.quiet`, take the extra 30 minutes to
   introduce the log-level enum (Approach B) now rather than accumulating tech debt.

Skip the full logger abstraction (Approach C) unless the CLI already has one or plans to add
structured logging soon. It's a good future step, not a prerequisite for this flag.

## Implementation sketch

```typescript
// In the flag definitions (matching existing --quiet / --json pattern):
.option("--verbose", "Show detailed output", { default: false })

// Validation (near existing flag validation):
if (options.quiet && options.verbose) {
  console.error("Cannot use --quiet and --verbose together.");
  process.exit(1);
}

// At call-sites:
if (options.verbose) {
  console.log(`Resolved config path: ${configPath}`);
}
```

## Open questions

- Does `--verbose` affect `--json` output (extra fields) or only human-readable output?
- Should verbose output go to stderr so stdout remains pipe-friendly?
- Are there any environment-variable overrides (e.g., `DEBUG=1`) that already serve this purpose?
