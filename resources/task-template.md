# Task template

Use this template when creating `br` tasks — both the first task (from write-plan) and subsequent
tasks (from execute-plan step 3). Every section listed below is required. If a section is missing
after creation, the task is malformed and must be recreated.

## Why this structure matters

Tasks describe **behaviors to test**, not files to create. Each behavior maps to one TDD cycle
(red-green-refactor). Without behaviors, there is nothing to write a failing test for, and TDD
becomes impossible. The `## Deliverables` or `## Files` sections that LLMs naturally produce
describe implementation artifacts — they tell you what to build but not what to prove. Behaviors
tell you what to prove, and the implementation follows from that.

## Template

```
## Goal
[What this task delivers — one clear outcome]

## TDD classification
[REQUIRED — has assertable behavior | EXEMPT — config, strings, migrations only (state why)]

## Behaviors
[Each behavior is one TDD cycle. List them in implementation order.
A behavior reads as a sentence describing what the system does, not what files exist.]
- [Behavior 1: "returns 200 with { status: ok } for GET /api/health"]
- [Behavior 2: "starts HTTP server on the port specified by --port flag"]
- ...

## Success criteria
- [ ] [Specific, measurable outcome]
- [ ] Tests passing
- [ ] Pre-commit hooks passing
```

Write-plan tasks may also include these optional sections:

```
## Execution mode
[HITL (needs human decisions during implementation) or AFK (can be executed autonomously)]

## References
[Point to 1-3 similar implementations or patterns: file:line]
```

Execute-plan tasks (created after completing a previous task) should also include:

```
## Context
[Key discoveries from the completed task that inform this one]
```

## Worked examples

### TDD-REQUIRED task

```bash
br create "Task 3: Health endpoint — Effect HttpServer + CLI serve command" \
  --type task \
  --parent greppa-3nc \
  --priority 1 \
  --description "$(cat <<'EOF'
## Goal

Wire the vertical slice: greppa serve --port 4400 starts an Effect HttpServer that responds to
GET /api/health with { status: ok }.

## Context

Task 2 created package stubs for all 5 workspace packages. pnpm install resolves, vp check runs
clean. Server and CLI packages have placeholder exports.

## TDD classification

REQUIRED — the health endpoint and CLI serve command both have assertable behavior.

## Behaviors

- GET /api/health returns 200 with JSON body { status: "ok" }
- GET /api/unknown returns 404
- serve command starts HTTP server on port 4400 by default
- serve command accepts --port flag to override the default port
- server responds to health check when started via CLI entry point

## Success criteria

- [ ] Each behavior has a test that failed before implementation (RED) and passes after (GREEN)
- [ ] vp test passes across all packages
- [ ] vp check passes (lint + format clean)
EOF
)"
```

### TDD-EXEMPT task

```bash
br create "Task 1: Root monorepo scaffold" \
  --type task \
  --parent greppa-3nc \
  --priority 1 \
  --description "$(cat <<'EOF'
## Goal

Set up the root monorepo config that all packages build on.

## TDD classification

EXEMPT — scaffolding config files (package.json, tsconfig, .npmrc, pnpm-workspace.yaml) with no
assertable behavior. Verified by running toolchain commands.

## Behaviors

(None — TDD-EXEMPT. Verification via success criteria commands below.)

## Success criteria

- [ ] pnpm install succeeds
- [ ] vp --version runs
- [ ] vp check runs (may warn about no source files)
EOF
)"
```

## Post-creation validation

After running `br create`, verify the task matches this template:

```bash
br show <task-id>
```

Check that the output contains:

- `## TDD classification` with either REQUIRED or EXEMPT and a reason
- `## Behaviors` section (even if "(None — TDD-EXEMPT)" for exempt tasks)
- `## Success criteria` with checkbox items

If any required section is missing, the task is malformed. Delete it with `br close <task-id>` and
recreate using this template.

## Common rationalizations for skipping the template

These all mean: follow the template.

- "This task is just creating files" — files serve behaviors; list the behaviors the files enable.
- "Behaviors are obvious from the deliverables" — if they are obvious, writing them takes seconds.
- "TDD classification is overhead" — without it, execute-plan defaults to REQUIRED and the task may
  lack the behaviors needed for TDD cycles.
- "I will figure out the tests during expand-task" — expand-task grounds behaviors in real files; it
  cannot invent behaviors that the task never listed.
