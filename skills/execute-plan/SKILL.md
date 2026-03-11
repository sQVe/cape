---
name: execute-plan
description: >
  Builds code from a br epic, one task at a time. The counterpart to cape:brainstorm -- brainstorm
  designs the plan, this skill implements it. TRIGGER: any user intent to make forward progress on
  planned work. Common signals: "continue", "next task", "resume", "let's go", "work on the plan", a
  bare "Continue.", br task IDs like br-7.3, or transitioning after brainstorming is complete. Picks
  up from br state automatically -- never asks where you left off. Implements one task, reflects on
  learnings, creates the informed next task, then stops for user review. NOT for: initial planning
  (cape:brainstorm), bug investigation, status queries, or git operations.
---

<skill_overview> The companion to `cape:brainstorm`. Brainstorm designs an epic with one first task.
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

- No epic exists yet (use `cape:brainstorm`)
- Investigating a defect (use `cape:debug-issue`)
- Requirements still unclear (use `cape:brainstorm`)

</when_to_use>

<the_process>

## Step 1: Orient

Check br state to figure out where you are. Never ask the user.

```bash
br list --type epic --status open
br list --status in_progress
br ready
```

- **In-progress task found** -- pick up where it left off (step 2)
- **Ready tasks available** -- load epic context, then execute the next one (step 2)
- **All tasks closed, epic open** -- check if success criteria are met (step 4)
- **No open epic** -- nothing to execute; suggest `cape:brainstorm`

Load the epic once at the start of each invocation. Its requirements, success criteria, and
anti-patterns are the guardrails for every decision you make during execution.

```bash
br show <epic-id>
```

---

## Step 2: Execute

Mark the task in-progress and read its details:

```bash
br update <task-id> --status in_progress
br show <task-id>
```

Break the task into substeps and track them. Do the work -- write tests, implement, verify. Use TDD
when building new functionality.

When you hit obstacles, re-read the epic before changing course. The "Approaches considered" section
documents what was already rejected and why. Those reasons usually still apply when things get hard.
If you genuinely need to switch approaches, explain why the original reasoning no longer holds and
get user confirmation.

Close the task only when all substeps are done:

```bash
br close <task-id>
```

---

## Step 3: Reflect and plan

After closing the task, step back and think about what happened.

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
```

---

## Step 4: Checkpoint

Present a summary and stop. The user needs the chance to review your work, adjust the next task, and
clear context before continuing.

```
## Checkpoint -- <task-id> complete

**Done:** [What was implemented and learned]
**Next:** <next-id>: [Title and brief description]
**Progress:** [X/Y epic success criteria met]

Run `/cape:execute-plan` to continue.
```

When all success criteria appear met, run verification (tests, linting, hooks) and present findings
before closing the epic.

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

<key_principles>

- **One task, then stop** -- the rhythm exists because each completed task changes what you know
- **Tasks are disposable, requirements are not** -- delete redundant tasks freely; never water down
  epic requirements
- **Learn forward** -- each task's next step is created from what was learned, not what was assumed
- **Obstacles don't justify shortcuts** -- re-read the epic when blocked, research the problem, ask
  the user

</key_principles>

<critical_rules>

1. **Stop after each task** -- present checkpoint, wait for user to continue
2. **Epic requirements are immutable** -- when blocked, research or ask; never weaken
3. **Re-read the epic before changing course** -- rejected approaches were rejected for reasons
4. **Complete all substeps before closing a task** -- partially done is not done
5. **Use `--description` on `br create`** -- `--design` does not exist on create
6. **Orient from br state** -- never ask "where did we leave off"

</critical_rules>
