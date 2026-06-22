# Linear issue templates

Copy each body into a new Linear issue template in the UI (Settings → Templates). These mirror the
shapes cape produces through MCP, so a human creating an issue by hand lands in the same form.
Linear itself can apply templates via the API (`IssueCreateInput.templateId`), but the Linear MCP
server cape uses does not forward it — `save_issue` takes raw markdown and exposes no template field
— so cape cannot apply them without bypassing the MCP seam. The agent contract in
[SKILL.md](../SKILL.md) stays the enforcement; these templates are a human-side convenience only.

Keep in sync with the authoring sources: epic shape is
[write-plan/resources/epic-template.md](../../write-plan/resources/epic-template.md) (board sections
only; Design rationale and discovery stay in session), task shape is `cape:write-plan`, bug shape is
`cape:fix-bug`.

## Epic

Untyped parent. No `type:*` label. Set `src:*` and Medium priority as template defaults.

```markdown
## Requirements (IMMUTABLE)

- [Specific, testable statement]

## Global constraints

- [Shared rule, or "N/A — single task"]

## Success criteria

- [ ] [Objective, testable criterion]
- [ ] All tests passing
- [ ] Pre-commit hooks passing

## Anti-patterns (FORBIDDEN)

- NO [pattern] (reason: [why])

## Durable decisions

- [Route, schema, boundary, or pattern that stays stable]

## Approach

[2-3 paragraphs: chosen approach, referencing codebase patterns]

## Architecture

[Key components, data flow, integration points. Mermaid for flows over ~3 steps.]
```

## Task

Set exactly one `type:*`, `src:*`, and Medium priority as template defaults.

```markdown
## Goal

[One vertical slice]

## Interface

- Inputs:
- Outputs:
- Side effects:

## Execution mode

[HITL | AFK]

Done when: [load-bearing completion condition]

## Success criteria

- [ ] [Objective check]

## References

- [file:line — verified pattern or helper]
```

## Bug

Set `type:bug`, `src:*`, and Medium priority as template defaults. Title as `Fix <symptom>`.

```markdown
## Root cause

[file:line — mechanism]

## Evidence

- [Key observation]

## Reproduction

1. [Exact step]

## Expected behavior

[What should happen]

## Actual behavior

[What happens]

## Suggested fix

[Approach]

Done when: [symptom no longer reproduces]

## Success criteria

- [ ] [Reproduction test passes]
```
