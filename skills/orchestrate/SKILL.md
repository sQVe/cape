---
name: orchestrate
description: >
  Drive a planned Linear epic autonomously through its BUILD phase: spawn a worker tab per task,
  verify its commit, have a codex tab review it, then close and lazily create the next task. Use
  whenever the user hands a set plan to the machine. Triggers on: "orchestrate this epic", "run the
  epic", "AFK the epic", "/cape:orchestrate", or starting an auto-mode `/goal` session after PLAN is
  done. Do NOT use for: PLAN itself (use cape:brainstorm / cape:write-plan), a single manual task
  (use cape:execute-plan), or when no planned epic with ready tasks exists.
---

<skill_overview> Run one task per turn of an autonomous BUILD loop: orient from the tracker cache,
drive the task through a herdr worker tab and a codex reviewer tab, verify a real commit, then close
it in Linear and create the next task one ahead. When no tasks remain, run the SHIP phase
(finish-epic, review, AFK PR, bounded PR-watch) and emit the completion sentinel. Core contract: a
task advances only on a verified git commit plus a PASS verdict; anything else halts the run with a
summary. </skill_overview>

<rigidity_level> LOW FREEDOM -- The per-turn order (orient, work, verify commit, review, close,
create-next), commit-not-status verification, and sole-writer cache discipline are fixed; worker and
reviewer prompt wording adapts to the task. </rigidity_level>

<when_to_use>

- A planned epic is In Progress with ready tasks and the user wants it built unattended
- Running as Claude in a herdr control tab under auto mode + `/goal`
- Resuming an autonomous run after a turn boundary

**Don't use for:**

- PLAN-phase work -- use `cape:brainstorm` then `cape:write-plan`
- A single supervised task -- use `cape:execute-plan`
- No epic, or no ready tasks remain

</when_to_use>

<critical_rules>

1. **Commit is success, not status** -- a worker is done only when a new commit exists on the epic
   branch. herdr `agent_status: done` means the pane stopped, not that it committed. Verify with
   git.
2. **Summarize, never paste** -- never copy raw worker or reviewer pane output into your transcript.
   It can leak the completion sentinel and end `/goal` early. Report a short summary instead.
3. **Sole writer, fresh cache** -- the orchestrator is the only Linear and tracker writer. Refresh
   the cache after every write. Linear plus the cache plus git are the only run state; keep no run
   file.
4. **One epic worktree, sequential tasks** -- tasks run one at a time in the single grove epic
   worktree, created one ahead. No per-task worktree, no parallel fan-out.
5. **Recover, then halt** -- a stalled or dead worker triggers bounded retry/respawn (see Recovery),
   not an immediate halt. A FAIL verdict or a spent retry budget halts the run with a summary. Never
   advance a task on assumed success or fabricate a result.

</critical_rules>

<the_process>

## Step 1: Orient from the tracker cache

Read the tracker cache and pick the next task under the active epic, using the same orient logic as
`cape:execute-plan` (in-progress task first, then the next ready `unstarted` / `Todo` task). Do not
network-read for orientation.

If no ready tasks remain, BUILD is done: go to the SHIP phase below. The BUILD loop itself never
emits the completion sentinel.

The run is bounded: the `/goal` session caps at 60 turns (roughly one task cycle per turn) and also
stops if a task parks. Set the `/goal` condition accordingly when launching.

---

## Step 2: Spawn a worker tab

Confirm `HERDR_ENV=1`. Using the `herdr` skill, create a tab and run a non-interactive `claude`
worker in it, handed a self-contained spec it can act on without your context:

- The task goal and success criteria, copied in full
- TDD discipline: RED-GREEN-REFACTOR (`cape:test-driven-development`)
- The commit convention, and that the worker commits its own work
- A required terminal signal: print `WORKER DONE` on success or `WORKER BLOCKED` on a blocker

Mark the task In Progress in Linear, then refresh the cache
(`cape tracker cache-status <id> "In Progress" started`).

---

## Step 3: Wait, then verify the commit

Block on the worker with `herdr wait agent-status <pane> --status done` (and a timeout). When it
stops, **verify a real commit landed** on the epic branch (`git log` shows a new commit for this
task) -- this, not the pane status, is the success check.

On `blocked`, a timeout, or `done` with no new commit, the worker stalled -- apply the Recovery
policy below (bounded retry/respawn) before parking.

---

## Step 4: Review with a codex tab

Spawn a separate `codex` reviewer tab (codex has no cape skills) and hand it a self-contained brief:
the task diff, the epic anti-patterns, the task success criteria, and a required `VERDICT: PASS` or
`VERDICT: FAIL` line. Read the verdict and **summarize it** -- do not paste the pane.

On `VERDICT: FAIL`, spawn a fix-worker with the findings (same worker contract as Step 2; recover
stalls per the Recovery policy), verify its commit, and re-review -- up to 2 review cycles. If the
2nd cycle still fails, park: halt and summarize the findings for the user.

---

## Step 5: Close, then create the next task

On `VERDICT: PASS`, close the task in Linear and refresh the cache
(`cape tracker cache-status <id> Done completed`). Reflect in session on what the turn revealed and
the next smallest vertical slice, then create that next sub-issue in Linear (one ahead) and refresh
the cache.

Loop back to Step 1 for the next turn.

---

## SHIP: when no tasks remain

Once Step 1 finds no ready tasks, run the SHIP phase yourself (the orchestrator, as Claude) -- never
a worker or the codex reviewer. Each step reuses an existing cape skill by reference:

1. **`cape:finish-epic`** -- verify the epic's success criteria with evidence and close the epic.
2. **`cape:review`** -- the Claude SHIP-phase review (structural graph + conform). This stamps the
   fresh `reviewedAt` that `cape:pr` requires; it is never the codex reviewer.
3. **`cape:pr` with the `CAPE_ORCHESTRATE` marker** -- the AFK branch: print the full description to
   the transcript, skip `AskUserQuestion`, and open the PR. Human review of the opened PR still
   happens; AFK waives only the pre-create confirmation.
4. **Bounded PR-watch** -- poll CI with `gh` every 30s for up to 30 min. On green, poll PR review
   comments every 3 min for 15 min. For each valid comment, spawn a fix-worker tab (same worker
   contract as Step 2; recover stalls per the Recovery policy below), verify its commit, re-run
   `cape:review`, and push. Skip invalid or out-of-scope comments with a one-line reason.
5. **Emit the sentinel** -- only now, at the very end, print
   `CAPE_ORCHESTRATE_COMPLETE epic=<id> pr=<url>`. This is the single line that satisfies the
   `/goal` completion check, so it appears nowhere else in the run.

`gh` and review-comment output can echo the sentinel; the summarize-never-paste rule stays binding
through the whole PR-watch.

---

## Recovery: stalled or dead workers

Applies to any worker -- the BUILD worker (Step 3) and the SHIP fix-worker. Never park on the first
stall; real runs recover by retrying or respawning.

- **Stall** -- `blocked`, a timeout, or `done` with no new commit. Retry the same self-contained
  spec: re-prompt the existing worker, or respawn a fresh worker tab if the pane is wedged.
- **Death** -- the worker tab is gone or crashed (check `herdr pane list`). Respawn a fresh tab with
  the same spec.
- **Bounded** -- retry/respawn up to 3 attempts. A retry counts as success only when a real commit
  lands -- status alone never counts (critical rule 1).
- **Park** -- only after the budget is spent: halt the run, leave the task as it is in Linear, and
  summarize what was tried and the last failure for the user.

</the_process>

<skill_references>

## Load `cape:execute-plan` with the Skill tool when:

- You need the exact orient-and-close logic for a task; orchestrate reuses it rather than restating
  it

## Load `cape:tracker` with the Skill tool when:

- You need the cache write commands or the cache shape after any Linear write

## Load `cape:finish-epic`, `cape:review`, `cape:pr` with the Skill tool when:

- BUILD is done and you enter the SHIP phase; run each in order rather than restating it

</skill_references>

<examples>

<example>
<scenario>A worker prints WORKER DONE but never committed</scenario>

**Wrong:** Trust the `done` status, close the task in Linear, and move on -- advancing on work that
does not exist.

**Right:** Check `git log` on the epic branch, find no new commit, treat it as a stall, and
retry/respawn the worker within the bounded budget before parking -- never close it on status.
</example>

<example>
<scenario>The codex reviewer returns a detailed verdict</scenario>

**Wrong:** Paste the reviewer's full pane output into your transcript, which can echo the completion
sentinel and end the `/goal` loop early.

**Right:** Read the verdict, write one short summary line (PASS / FAIL plus the key reason), and act
on it. </example>

</examples>

<key_principles>

- **Commit is truth** -- git decides whether a task is done, not an agent's reported status
- **Protect the evaluator** -- summarize pane output so the transcript-only `/goal` check never sees
  a stray sentinel
- **One writer, one source of truth** -- Linear plus the cache plus git; no run-state file
- **Lazy one-ahead** -- create the next task from what this turn revealed, not a pre-scoped list

</key_principles>
