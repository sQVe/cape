---
name: skill-name
description: >
  Use whenever [trigger condition]. Triggers on: [explicit triggers like user phrases, commands,
  situations]. Also triggers on: [implicit triggers]. Do NOT use for [negative triggers, things that
  sound similar but need a different skill].
---

# Skill name

[1-2 sentences: what this skill does and what it produces. State the core contract, the guarantee
this skill makes.]

[One sentence on rigidity: what is fixed and what adapts to context.]

[The description frontmatter carries the triggers. Do not repeat them in a "when to use" section;
the body starts at the contract.]

## Arguments

[Only when the skill takes arguments.]

- `--flag` (optional): [what it changes]

## Rules

1. **[Bold phrase.]** [Rule with no exceptions. Hard gates like "never commit without approval" go
   first.]
2. **[Bold phrase.]** [Rule.]

## Process

### 1. [Title]

[What to do. Include tool commands, agent dispatches, or user interactions. 3-5 steps total, each
with a clear deliverable.]

### 2. [Title]

[If this step makes design or implementation decisions, add a short assumption checkpoint: show
scope creep, ambiguous terms, or over-engineering before committing. Keep it inline.]

### 3. [Title]

[Any step that emits human-facing prose (commit messages, PR or epic text, review write-ups, issue
descriptions, replies) runs that prose through the `cape:unslop` skill before presenting or posting.
Skip only for pure code or mechanical output. State this as a one-line reminder at the emitting
step; do not repeat the full convention.]

## Agents

[Only when the skill dispatches cape agents.]

Dispatch `cape:agent-name` when:

- [Condition that warrants dispatching this agent]

## Skills

[Only when the skill loads other cape skills via the Skill tool.]

Load `cape:skill-name` when:

- [Condition that warrants loading this skill]

## Examples

[Optional. Two contrasting wrong/right examples at most; omit the section when the process is
self-evident. Never add a principles section that restates the rules.]

**Wrong:** [What happens when skipping steps, and the consequence.]

**Right:** [The correct approach: key actions and outcome.]
