# Brainstorm: add --verbose flag to CLI tool

I'm using the brainstorming skill to refine your idea into a design.

## Step 1: Understand the idea

### Research findings

**Codebase investigation (simulated):**

Investigated `src/cli.ts` and found the existing flag pattern. The CLI uses a standard argument
parsing approach with boolean flags:

- `--quiet` (alias `-q`): suppresses all non-error output. Defined as a boolean option with default
  `false`. When active, sets `logLevel` to `"error"`.
- `--json`: switches output to machine-readable JSON. Defined as a boolean option with default
  `false`. When active, sets `outputFormat` to `"json"`.

Both flags follow the same pattern:

1. Defined in the options object passed to the argument parser
2. Stored on a parsed `Options` interface
3. Consumed by a logger/output module that checks the flags to decide behavior

No existing `--verbose` or `-v` flag. No log-level enum beyond the implicit quiet/normal binary.

**Questions answered by codebase research (not asked to user):**

| Question                                  | Answer from code                                        | Implication                                                           |
| ----------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| What argument parser is used?             | `commander` (simulated finding in package.json)         | Follow commander's `.option()` pattern                                |
| Is there a centralized logger?            | Yes, `src/logger.ts` with `info()`, `warn()`, `error()` | Verbose output routes through existing logger                         |
| Does `--quiet` conflict with `--verbose`? | `--quiet` sets logLevel to "error"                      | Must define precedence: `--quiet` wins, or they're mutually exclusive |
| Is `-v` alias taken?                      | No existing `-v` alias                                  | Safe to use `-v` for verbose                                          |

### Clarifying questions (simulated user interaction)

Since this task has clear scope and an existing pattern to follow, no critical questions require
human judgment. The codebase provides all needed answers.

**Key decisions table:**

| Question                                      | Answer                                                        | Implication                                                             |
| --------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Follow existing flag pattern?                 | Yes, match `--quiet` and `--json` pattern                     | Use same `.option()` call structure, same `Options` interface extension |
| What does verbose output include?             | Debug-level info: timing, resolved config, intermediate steps | Add `debug()` method to logger, gate on verbose flag                    |
| How does `--verbose` interact with `--quiet`? | Mutually exclusive; `--quiet` takes precedence                | Add validation: if both set, warn and honor `--quiet`                   |
| How does `--verbose` interact with `--json`?  | Compatible; verbose adds extra fields to JSON output          | When both active, JSON output includes debug-level entries              |

---

## Step 2: Research and propose approaches

### Complexity assessment

This is a **single-file change with one obvious pattern to follow**. The existing `--quiet` and
`--json` flags establish the exact pattern. No architectural decisions, no competing viable
approaches, no multiple components touched.

**Decision: Inline mode.** Skip divergent agents.

### Approach 1: Boolean verbose flag (recommended)

Add `--verbose` / `-v` as a boolean flag following the exact same pattern as `--quiet`.

**Implementation:**

1. Add `.option('-v, --verbose', 'Enable verbose output')` to the commander chain in `src/cli.ts`
2. Add `verbose: boolean` to the `Options` interface
3. In `src/logger.ts`, add a `debug()` method that only emits when `verbose` is true
4. Add mutual exclusion check: if both `--quiet` and `--verbose` are set, emit a warning and honor
   `--quiet`
5. Sprinkle `logger.debug()` calls at key points (config resolution, command dispatch, timing)

**Pros:**

- Matches existing pattern exactly
- Minimal change surface
- No new dependencies

**Cons:**

- Binary verbose (on/off) -- no granularity levels

### Approach 2: Log-level flag with verbose as a level

Replace the implicit quiet/normal binary with an explicit `--log-level` enum (`error`, `warn`,
`info`, `debug`) and make `--verbose` an alias for `--log-level debug`.

**Pros:**

- More granular control
- Forward-compatible with future log levels

**Cons:**

- Larger change scope -- retrofits `--quiet` behavior
- Over-engineering for the stated need
- Breaks existing `--quiet` interface semantics

**Recommendation: Approach 1.** It matches the codebase pattern, solves the stated need, and avoids
scope creep. Approach 2's granularity isn't needed yet (YAGNI).

---

## Step 3: Lock design -- assumption challenge

### Branch 1/4: Mutual exclusion with --quiet

`--verbose` enables debug output; `--quiet` suppresses everything except errors. They conflict.

**Recommended:** `--quiet` wins silently. If both flags are passed, honor `--quiet` and skip verbose
output. No error, no warning -- the user explicitly asked for quiet.

a) `--quiet` wins silently -- simplest, no extra output b) Emit a warning and honor `--quiet` --
helps catch user mistakes c) Exit with an error -- strictest, forces user to pick one

**Simulated resolution:** Option (a). Emitting a warning during `--quiet` mode contradicts the
intent of `--quiet`. A silent precedence rule is most consistent. If the user passed both, `--quiet`
is the stronger constraint.

### Branch 2/4: Short flag alias

`-v` is the conventional alias for `--verbose`. But `-v` is also conventionally used for
`--version`.

**Recommended:** Check if `-v` is already bound to `--version`. If so, use `-V` for verbose or skip
the short alias.

a) `-v` for verbose (if `--version` uses `-V` or `--version` only) -- conventional b) No short alias
-- avoids any conflict, minor inconvenience c) `-V` for verbose -- unconventional but avoids
collision

**Simulated resolution:** Option (a). Simulated codebase check shows `--version` is handled by
commander's built-in `.version()` which binds `-V` by default. So `-v` is free for `--verbose`.

### Branch 3/4: What verbose output actually includes

Without defining what verbose emits, the flag becomes a no-op or gets inconsistently used.

**Recommended:** Start with three concrete verbose outputs: (1) resolved configuration after all
defaults/overrides, (2) command timing, (3) external call details (API requests, file I/O paths).
Add more as needed.

a) Define 3 initial verbose outputs now, expand later -- practical starting point b) Verbose emits
everything through a debug logger -- too noisy, hard to maintain c) Define a verbose output spec
document -- over-engineering for a flag

**Simulated resolution:** Option (a). Three concrete outputs give immediate value. Future verbose
additions happen organically as developers add `logger.debug()` calls where useful.

### Branch 4/4: Verbose + JSON interaction

When both `--verbose` and `--json` are active, should JSON output change?

**Recommended:** JSON output gains an optional `debug` array field containing verbose entries.
Structured output stays parseable; extra data is additive.

a) Add `debug` array to JSON output -- additive, backward-compatible b) Verbose has no effect on
JSON output -- simpler but loses verbose info in scripted usage c) Separate verbose JSON to stderr
-- keeps stdout clean, splits output streams

**Simulated resolution:** Option (b). JSON consumers expect a stable schema. Adding a `debug` field
risks breaking downstream parsers. Verbose output goes to stderr when `--json` is active, keeping
stdout as clean JSON.

**Updated resolution for Branch 4:** Verbose messages go to stderr. This is consistent regardless of
`--json` mode and follows Unix conventions (diagnostic output to stderr, data to stdout).

---

## Design summary

**Problem:** The CLI tool needs a `--verbose` flag to emit debug-level output for troubleshooting
and development, following the existing `--quiet` and `--json` flag patterns.

**Chosen approach:** Boolean `--verbose` / `-v` flag matching the existing flag pattern in
`src/cli.ts`.

**Requirements:**

- Add `--verbose` / `-v` boolean option to commander chain in `src/cli.ts`
- Add `verbose: boolean` to the `Options` interface
- Add `debug()` method to `src/logger.ts` gated on `verbose` flag
- Verbose output goes to stderr (consistent with Unix conventions)
- When `--quiet` and `--verbose` are both set, `--quiet` wins silently
- Initial verbose outputs: resolved configuration, command timing, external call details

**Anti-patterns:**

- NO log-level enum (reason: YAGNI -- binary verbose/normal suffices for current needs)
- NO verbose output to stdout (reason: keeps stdout clean for piping and `--json` mode)
- NO modifying JSON schema for verbose (reason: downstream parsers expect stable schema)
- NO warning when `--quiet` overrides `--verbose` (reason: emitting output during quiet mode
  contradicts its purpose)

**Architecture:**

- `src/cli.ts`: flag definition (`.option('-v, --verbose', 'Enable verbose output')`)
- `src/logger.ts`: new `debug()` method, checks `options.verbose && !options.quiet`
- Callers: use `logger.debug()` at key points

**Scope:**

- In: flag definition, logger extension, 3 initial debug call sites
- Out: log-level granularity, verbose output spec document, changes to `--quiet` or `--json`
  behavior

**Open questions:**

- Exact call sites for initial `logger.debug()` placements (determine during implementation)

### Key decisions

| Question                          | Answer                                | Implication                                           |
| --------------------------------- | ------------------------------------- | ----------------------------------------------------- |
| Follow existing flag pattern?     | Yes                                   | `.option()` call, `Options` interface, same structure |
| `--quiet` + `--verbose` conflict? | `--quiet` wins silently               | Logger checks `verbose && !quiet`                     |
| Short alias?                      | `-v` (free, `-V` used by `--version`) | Standard Unix convention                              |
| Verbose output destination?       | stderr                                | Keeps stdout clean for piping and JSON                |
| JSON interaction?                 | No JSON schema changes                | Verbose to stderr regardless of `--json`              |
| Initial verbose content?          | Config, timing, external calls        | Three concrete starting points                        |

### Research findings

**Codebase (simulated):**

- `src/cli.ts`: commander-based arg parsing, existing `--quiet` and `--json` options
- `src/logger.ts`: centralized logger with `info()`, `warn()`, `error()` methods
- `--version` uses commander built-in with `-V` alias
- `-v` alias is available

**External:** No external research needed. Standard CLI flag pattern.

### Approaches considered

1. **Boolean --verbose flag** (selected) -- matches codebase pattern, minimal scope, solves the
   stated need
2. **Log-level enum** -- rejected. Over-engineers for a single flag addition. Retrofitting `--quiet`
   adds risk and scope. DO NOT REVISIT UNLESS multiple distinct verbosity levels become a real user
   need.

### Dead ends

None. The task is straightforward with a clear pattern to follow. No alternative paths were explored
and abandoned.

---

Design summary complete. Run `/cape:write-plan` to formalize this into a br epic.
