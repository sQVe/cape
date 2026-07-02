---
name: skill-name
description: >
  Use whenever [trigger condition]. Triggers on: [explicit triggers like user phrases, commands,
  situations]. Also triggers on: [implicit triggers]. Do NOT use for [negative triggers -- things
  that sound similar but need a different skill].
---

<skill_overview> [1-2 sentences: what this skill does and what it produces. State the core contract
-- the non-negotiable guarantee this skill makes.] </skill_overview>

<rigidity_level> [HIGH, MEDIUM, or LOW] FREEDOM -- [What's rigid and what adapts to context. One
sentence.] </rigidity_level>

<when_to_use>

- [Positive trigger: situation or user phrase]
- [Positive trigger]
- [Positive trigger]

**Don't use for:**

- [Negative trigger -- redirect to correct skill if applicable]
- [Negative trigger]

</when_to_use>

<critical_rules>

1. **[Bold phrase]** -- [rule that has no exceptions]
2. **[Bold phrase]** -- [rule]
3. **[Bold phrase]** -- [rule]
4. **[Bold phrase]** -- [rule]

</critical_rules>

<the_process>

## Step 1: [Title]

[What to do in this step. Include tool commands, agent dispatches, or user interactions.]

---

## Step 2: [Title]

[Steps use `## Step N: Title` headings separated by `---` rules.]

[Convention: if this step makes design or implementation decisions, consider adding a lightweight
assumption checkpoint -- surface scope creep, ambiguous terms, or over-engineering before
committing. Keep it inline and focused.]

---

## Step 3: [Title]

[3-5 steps total. Each step is a discrete phase with a clear deliverable.]

[Convention -- prose output: any step that emits human-facing prose (commit messages, PR or epic
text, review write-ups, issue descriptions, replies) runs that prose through the global `stop-slop`
skill before presenting or posting; skip only for pure code or mechanical output, and write in
simple language with clear, scannable structure. State this as a one-line reminder at the emitting
step -- do not repeat the full convention.]

</the_process>

<agent_references>

[Include this section only when the skill dispatches cape agents.]

## Dispatch `cape:agent-name` when:

- [Condition that warrants dispatching this agent]
- [Condition]

</agent_references>

<skill_references>

[Include this section only when the skill loads other cape skills via the Skill tool.]

## Load `cape:skill-name` with the Skill tool when:

- [Condition that warrants loading this skill]
- [Condition]

</skill_references>

<examples>

[Optional. Two contrasting examples at most; omit the section when the process is self-evident.]

<example>
<scenario>[Setup: what the user did or what state exists]</scenario>

**Wrong:** [What happens without the skill or when skipping steps. Explain the consequence.]

**Right:** [Correct approach following the process. Show the key actions and outcome.] </example>

<example>
<scenario>[A different situation exercising another part of the process]</scenario>

**Wrong:** [Common mistake or shortcut.]

**Right:** [Correct approach.] </example>

</examples>

<key_principles>

[Optional. Include only principles not already stated in critical_rules or the process; cap at 4.
Omit the section rather than restating rules.]

- **[Bold phrase]** -- [explanation of the principle]
- **[Bold phrase]** -- [explanation]

</key_principles>
