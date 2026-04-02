# TDD enforcement improvements

## Design summary

**Problem:** Claude Code does not consistently follow TDD during execution despite skill
instructions and soft hook reminders. The PostToolUse Edit hook is advisory (additionalContext), not
blocking (deny). The Write tool has no hook at all. Expand-task prescribes implementation details
that let Claude skip test-first discovery.

**Chosen approach:** Hard runtime enforcement via PreToolUse hooks + lighter expand-task output.

**Requirements:**

- PreToolUse hooks for Edit and Write deny production code edits when tdd-state is not `red` or
  `green` during executing/debugging phases
- `tdd-bypass` context flag provides explicit escape hatch (manual set/clear only)
- PostToolUse Edit stops warning on `green` phase (valid refactoring)
- PostToolUse Write added for tdd-state tracking on test file creation
- Expand-task `**Changes:**` field stripped of prose descriptions (file paths only)
- Execute-plan resets tdd-state to null at the start of each expanded plan step
- Execute-plan GREEN phase updated to reference Pattern and file targets, not descriptions

**Anti-patterns:**

- NO auto-clear on tdd-bypass (reason: hidden coupling between context flags, surprising behavior)
- NO transition of `green` → null on production edits (reason: breaks multi-file atomic refactoring)
- NO structural hints or fallback descriptions in Changes (reason: expand-task must find patterns;
  hints drift toward prescriptions)
- NO description of what to write in expanded plan steps (reason: lets Claude skip test-first
  discovery)

**Architecture:**

- `cli/src/services/hook.ts` — new PreToolUse handlers for Edit/Write, fix PostToolUse Edit false
  positive, add PostToolUse Write handler
- `hooks/hooks.json` — register PreToolUse Edit/Write matchers, PostToolUse Write matcher
- `cli/src/commands/hook.ts` — route new matchers to handlers
- `skills/expand-task/SKILL.md` — strip prose from Changes format
- `skills/execute-plan/SKILL.md` — reset tdd-state per step, update GREEN phase instructions

**Scope:**

- In: PreToolUse deny logic, tdd-bypass flag, PostToolUse fixes, expand-task format, execute-plan
  step loop
- Out: beads/task structure changes, new tdd-state phases, auto-clear mechanisms

## Confirmed constraints (from challenge)

- Hooks fire across agent boundaries — PreToolUse/PostToolUse fire for sub-agent tool calls.
  Verified via Claude Code docs.
- Reset tdd-state per step, not per edit — `green` stays permissive for refactoring. State resets to
  null at the start of each expanded plan step.
- No description fallbacks in Changes — strip all prose, rely on Pattern. Expand-task is responsible
  for finding patterns.
- Manual bypass only — `tdd-bypass` is set/cleared explicitly. No auto-clear, no TTL, no coupling.

## Key decisions

| Question                            | Answer                       | Implication                                            |
| ----------------------------------- | ---------------------------- | ------------------------------------------------------ |
| Hooks vs structure for enforcement? | Both, hooks are the 80% fix  | PreToolUse deny is primary; expand-task is secondary   |
| Escape hatch mechanism?             | Context flag `tdd-bypass`    | Manual set/clear, no auto-clear                        |
| `green` state handling?             | Reset per step, not per edit | Refactoring stays free; each new behavior starts clean |
| Expand-task Changes format?         | File paths only, no prose    | Pattern field carries convention guidance              |
| Auto-clear bypass?                  | No                           | Simple, explicit, no hidden coupling                   |

## Approaches considered

1. **Option A: Lighten** (selected) — hard hooks + strip descriptions from Changes, keep file paths
2. **Option B: Restructure** (rejected) — remove Changes entirely, scope only. Too aggressive;
   Claude re-discovers what expand-task already found, wastes tokens, risks wrong-file edits.

## TDD state machine (PreToolUse deny logic)

| tdd-state               | Production code edit      | Test file edit      |
| ----------------------- | ------------------------- | ------------------- |
| `null` (no TDD started) | **DENY**                  | allow               |
| `writing-test`          | **DENY** (run test first) | **DENY** (batching) |
| `red` (test failing)    | allow (GREEN phase)       | allow               |
| `green` (test passing)  | allow (REFACTOR phase)    | allow               |

State resets to null at the start of each expanded plan step.

## Files to change

- `cli/src/services/hook.ts` — `preToolUseEdit`, `preToolUseWrite`, fix `postToolUseEdit`, add
  `postToolUseWrite`
- `cli/src/commands/hook.ts` — route Edit/Write in PreToolUse and PostToolUse switches
- `hooks/hooks.json` — register new matchers
- `skills/expand-task/SKILL.md` — update Changes format (strip descriptions)
- `skills/execute-plan/SKILL.md` — add tdd-state reset per step, update GREEN phase wording
- `cli/src/commands/hook.test.ts` — tests for new PreToolUse handlers
- `cli/src/services/hook.test.ts` — if exists, tests for new service functions
