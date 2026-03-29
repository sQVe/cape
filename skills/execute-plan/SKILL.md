---
name: execute-plan
description: >
  Builds code from a br epic, one task at a time. The counterpart to cape:write-plan -- write-plan
  creates the epic, this skill implements it. TRIGGER: any user intent to make forward progress on
  planned work. Common signals: "continue", "next task", "resume", "let's go", "work on the plan", a
  bare "Continue.", br task IDs like br-7.3, or transitioning after planning is complete. Picks up
  from br state automatically -- never asks where you left off. Implements one task, reflects on
  learnings, creates the informed next task, then stops for user review. NOT for: initial planning
  (cape:brainstorm, cape:write-plan), bug investigation, status queries, or git operations.
---

<skill_overview> The companion to `cape:write-plan`. Write-plan creates an epic with one first task.
This skill picks up that task, completes it, figures out what comes next based on what was learned,
then hands control back to the user before continuing.

The rhythm: load epic context, do one task, reflect on what changed, create the next task, stop.
</skill_overview>

<rigidity_level> LOW FREEDOM -- The rhythm (one task, reflect, stop) is non-negotiable. Everything
else -- how you implement, what tools you reach for, how you structure the next task -- adapts to
context. </rigidity_level>

<when_to_use>

- A br epic exists with ready or in-progress tasks
- User wants to implement the next task in a plan
- Resuming work after clearing context

**Don't use for:**

- No epic exists yet (use `cape:brainstorm` then `cape:write-plan`)
- Investigating a defect (use `cape:debug-issue`)
- Requirements still unclear (use `cape:brainstorm`)

</when_to_use>

<critical_rules>

1. **STOP after each task** — present the checkpoint and wait for the user to continue. Do not start
   the next task without user input (unless AFK mode). This is the most important rule.
2. **Epic requirements are immutable** — when blocked, research or ask; never weaken
3. **Re-read the epic before changing course** — rejected approaches were rejected for reasons
4. **Complete all substeps before closing a task** — partially done is not done
5. **Orient from br state** — never ask "where did we leave off"
6. **Test before code** — load `cape:test-driven-development` before writing any production code

</critical_rules>

<the_process>

## Step 1: Orient

Check br state to figure out where you are. Never ask the user.

```bash
br list --type epic --status open
br list --status in_progress
br ready
```

- **Multiple open epics** -- ask the user which epic to work on, then use
  `br ready --parent <epic-id>`
- **In-progress task found** -- pick up where it left off (step 2)
- **Ready tasks available** -- load epic context, then execute the next one (step 2)
- **All tasks closed, epic open** -- check if success criteria are met (step 4)
- **No open epic** -- nothing to execute; suggest `cape:brainstorm` then `cape:write-plan`

Load the epic once at the start of each invocation. Its requirements, success criteria, and
anti-patterns are the guardrails for every decision you make during execution.

```bash
br show <epic-id>
```

---

## Step 2: Execute

Read the task's details:

```bash
br show <task-id>
```

If the task's design field does not already contain an `## Expanded plan` section, load
`cape:expand-task` with the Skill tool to ground the task in codebase reality before writing any
code. Expand-task investigates actual files and patterns, then appends a step-by-step plan with
exact file paths, line numbers, and verification commands to the task's design field. Skip this if
the section already exists.

After expand-task returns, re-read the task (`br show <task-id>`). If the design field contains a
`## Split recommendation` section instead of an expanded plan, the task is too large. Close it with
reason "split per expand-task recommendation", create the recommended subtasks, and stop for user
review.

Once an expanded plan exists, mark the task in-progress:

```bash
br update <task-id> --status in_progress
```

Load `cape:test-driven-development` with the Skill tool before writing any production code. Follow
its RED-GREEN-REFACTOR cycle — one behavior per cycle, no batching.

If the code you need to modify is tangled — hard to add the new behavior without restructuring first
— load `cape:refactor` with the Skill tool. Refactor commits the structural change separately, then
returns here. This keeps structural and behavioral changes in distinct commits.

When you hit obstacles, re-read the epic before changing course. The "Approaches considered" section
documents what was already rejected and why. Those reasons usually still apply when things get hard.
If you genuinely need to switch approaches, explain why the original reasoning no longer holds and
get user confirmation. Then append a divergence log entry to the task's design field via
`cape br design <task-id> "Divergence"`.

Before closing, append an Outcome section to the task's design field via
`cape br design <task-id> "Outcome"`.

Close the task only when all substeps are done. Run `cape br close-check <task-id>` first to verify
substasks are complete and checks pass, then close:

```bash
cape br close-check <task-id>
br close <task-id>
```

---

## Step 3: Reflect and plan

After closing the task, review and optionally challenge before planning the next step.

**Review implementation:** Dispatch `cape:code-reviewer` to review the completed task against the
epic's requirements and anti-patterns. Address any critical findings before creating the next task.

**Challenge completed work (opt-in):** Ask: "Want me to load `cape:challenge` to check for scope
creep or over-engineering, or proceed to the next task?" If the user accepts, load `cape:challenge`
with the Skill tool, focusing on scope creep, unrequested features, and over-engineering. Skip for
straightforward single-file changes.

**Verify claims:** Optionally dispatch `cape:fact-checker` if the task made specific claims about
codebase structure, API behavior, or dependencies that should be confirmed before proceeding.

Then step back and think about what happened.

- What did this task reveal about the problem?
- Did you discover existing code, new constraints, or dead ends?
- Is the epic's approach still sound?
- What's the natural next step?

Re-read the epic to stay anchored:

```bash
br show <epic-id>
```

If a planned task is now redundant, close it with a reason. If a new task is needed, create one that
reflects what you actually learned -- not what you assumed at the start:

```bash
br create "Task N: [Informed next step]" \
  --type task \
  --parent <epic-id> \
  --priority <match-epic> \
  --description "$(cat <<'EOF'
## Goal
[What this task delivers, informed by previous task]

## Context
[Key discoveries from the completed task]

## Implementation
[Steps based on current reality]

## Success criteria
- [ ] [Measurable outcomes]
- [ ] Tests passing
EOF
)"
cape br validate <task-id>
```

---

## STOP — Step 4: Checkpoint

**You MUST stop here and wait for user input before continuing (HITL mode).**

Present a summary and stop. The user needs the chance to review your work, adjust the next task, and
clear context before continuing.

```
## Checkpoint -- <task-id> complete

**Done:** [What was implemented and learned]
**Next:** <next-id>: [Title and brief description]
**Progress:** [X/Y epic success criteria met]

Clear context with `/clear` before picking up the next task — br state has everything needed to
orient. Then continue with `cape:execute-plan`.
```

Context resets with structured handoffs (br state, expanded plans) produce better results than
growing context. The next invocation orients from br state alone — no conversation history needed.

Check the task's `## Execution mode` field (set by write-plan). **HITL (human-in-the-loop):**
present checkpoint and stop as normal. **AFK (autonomous):** skip the stop — load `cape:commit`,
create the next task, and continue into it without waiting for user input. If no execution mode is
set, default to HITL.

Load `cape:commit` with the Skill tool to commit the completed task, then stop (HITL) or continue
(AFK).

When all tasks are closed and all success criteria appear met:

```
## Checkpoint -- all tasks complete

**Done:** [What was implemented across all tasks]
**Progress:** All [N] success criteria appear met.

Committing and running finish-epic to verify and close.
```

Then load `cape:commit` with the Skill tool, followed by `cape:finish-epic` with the Skill tool. Do
not tell the user to run these — execute them yourself.

</the_process>

<examples>

<example>
<scenario>First task reveals the second task is unnecessary</scenario>

Epic has two planned tasks: br-3 "add config parser" and br-4 "add config validation." While
implementing br-3, you discover the parsing library already validates schemas.

**Wrong:** Implement br-4 anyway because it's in the plan. Duplicates built-in validation.

**Right:** Close br-4 with reason "library handles validation natively," then create a task for
integration testing instead. Plans adapt to reality. </example>

<example>
<scenario>Obstacle tempts a shortcut the epic forbids</scenario>

Epic anti-pattern says "NO mocking the database in integration tests." Setting up a test database
turns out to be harder than expected.

**Wrong:** Mock the database "just for now" with a TODO to fix later. The TODO never gets addressed,
and the tests don't actually test integration.

**Right:** Research how the project sets up test databases. Check for existing test fixtures or
Docker configs. If truly stuck, ask the user -- don't silently violate the anti-pattern. </example>

<example>
<scenario>Skipping the checkpoint to maintain momentum</scenario>

Completed br-3, context is fresh, br-4 looks straightforward.

**Wrong:** Continue into br-4 without stopping. If br-4 hits complexity, context is now exhausted
with two tasks' worth of state, and the user hasn't reviewed br-3.

**Right:** Present the checkpoint. Context reloads are cheap. Mistakes from skipped review are not.
</example>

</examples>

<agent_references>

## `cape:code-reviewer` protocol:

**Pass:** epic ID (`br show <epic-id>` for requirements, anti-patterns, success criteria) and git
diff for this task's changes. Do NOT pass the task's expanded plan or implementation notes — the
reviewer judges code against the contract, not the implementation intent. **Expect back:** verdict
(pass/fail) with categorized findings (Critical/Important/Suggestion).

## `cape:fact-checker` protocol:

Dispatch when verifying that assumptions from expand-task still hold after implementation. **Pass:**
specific claims to verify (file paths, function signatures, import relationships). **Expect back:**
per-claim verdict: Confirmed/Refuted/Partially correct/Unverifiable with file:line evidence.

</agent_references>

<skill_references>

## Load `cape:challenge` with the Skill tool (opt-in) when:

- Task is complete and touched multiple components or took longer than expected
- User accepts the challenge offer from step 3

**Pass as context:**

- The task's goal and what was actually built
- The epic's requirements and anti-patterns

**Expect back:**

- Challenge summary with confirmed constraints and rejected assumptions

</skill_references>

<key_principles>

- **One task, then stop** -- the rhythm exists because each completed task changes what you know
- **Tasks are disposable, requirements are not** -- delete redundant tasks freely; never water down
  epic requirements
- **Learn forward** -- each task's next step is created from what was learned, not what was assumed
- **Obstacles don't justify shortcuts** -- re-read the epic when blocked, research the problem, ask
  the user

</key_principles>
