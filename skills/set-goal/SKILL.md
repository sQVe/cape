---
name: set-goal
description: >
  Interview-first front end for an autonomous epic run. Asks how to achieve the goal -- worker
  agent, how to split tasks, review strategy -- then PRINTS a reviewable draft: a `/goal` completion
  condition plus an approach prompt that primes the run. The user edits and launches it; set-goal
  never starts the run itself. Takes a Linear epic id or a free-form description (turned into a lean
  epic first). Triggers on: "set up an autonomous run", "draft a /goal for this epic", "prep an AFK
  run", "/cape:set-goal ABU-123", "/cape:set-goal <description>". Do NOT use for: actually driving a
  run (that is the printed prompt fed to `/goal`), a single supervised task (cape:execute-plan), or
  interactive PLAN exploration with a human in the loop (cape:brainstorm / cape:write-plan).
---

<skill_overview> Interview an epic into a reviewable `/goal` draft, print it, and stop. The draft is
two paste-blocks: a `/goal` completion condition and an approach prompt that primes an autonomous
BUILD-and-SHIP run. Core contract: set-goal only prints -- it never launches `/goal`, spawns a
worker, or writes code. The human reviews, edits, and runs. </skill_overview>

<rigidity_level> LOW FREEDOM -- The print-only boundary, the two-block output shape, and the paired
`CAPE-RUN` line and condition are fixed; the interview defaults and the approach-prompt wording
adapt to the epic. </rigidity_level>

<when_to_use>

- A planned epic you want to hand to an autonomous `/goal` run, prepared and reviewed first
- A free-form description you want turned into a lean epic plus an autonomous run draft
- Preparing an AFK run you intend to review before launching

**Don't use for:**

- Driving the run itself -- that is the printed prompt, fed to `/goal`
- A single supervised task -- use `cape:execute-plan`
- Interactive PLAN exploration with a human in the loop -- use `cape:brainstorm` / `cape:write-plan`

</when_to_use>

<critical_rules>

1. **Print, never run** -- set-goal prints a draft and stops. It never launches `/goal`, spawns a
   worker, or commits. The human pastes and runs.
2. **Two blocks, one pair** -- emit the `/goal` condition and the approach prompt as separate
   copy-bounded blocks, generated as a pair so the prompt's final `CAPE-RUN` line and the condition
   always match.
3. **Sole writer for the epic mint** -- if you mint an epic from a description, you are the only
   Linear and cache writer; follow the `cape:tracker` contract and refresh the cache after the
   write.
4. **No sentinel, no leak protocol** -- completion is the data-carrying `CAPE-RUN` line, never a
   constant string; do not reintroduce a fixed sentinel or a summarize-never-paste rule _as leak
   protection_. Summarizing pane output to save context budget is fine -- it just no longer guards a
   sentinel.

</critical_rules>

<the_process>

## Step 1: Orient from the tracker cache

Resolve the target from the invocation:

- **An epic id** (for example `/cape:set-goal ABU-123`): use that epic.
- **A free-form description** (no epic id): mint a lean epic first -- title, goal, success criteria,
  and one first task -- via the `cape:tracker` contract (or load `cape:write-plan` for the fuller
  shape), then refresh the cache. Keep it minimal: one first task is enough because the run creates
  later tasks one ahead. Print a one-line plan summary (epic goal + first task) before drafting.
- **Nothing**: use the active epic from the cache; if several are active, ask which.

Read the tracker cache (`hooks/context/tracker.json`) for the epic: pull the ready-task titles and
count so the interview and the computed turn cap are grounded. Do not network-read for orientation.
If the cache is stale or missing for this epic, say so and offer to refresh -- do not guess.

---

## Step 2: Interview the approach

Ask three structured questions with `AskUserQuestion`, each with a marked default so the user can
accept all at once:

1. **Worker** -- `claude` worker with TDD (default) / `claude` worker, no TDD / `codex` worker.
2. **Split** -- lazy one-ahead (default) / pre-split the epic now / single task.
3. **Review** -- codex reviewer per task, up to 2 fix-cycles (default) / self-review only
   (`cape:review`, no codex) / codex plus required green test output in the transcript.

Everything else is a stated default, surfaced in the draft's header but not asked: one grove epic
worktree, sequential tasks, SHIP = finish-epic then review then AFK pr then bounded PR-watch, and a
turn cap computed from the task count (about `2 x ready tasks + SHIP overhead`). The user changes a
default by editing the printed block in Step 4, not with another question.

---

## Step 3: Render the draft

Compute the turn cap from the cached task count. Print two copy-bounded blocks, framed by a header
and footer the user reads but does not paste. Substitute the epic id, title, and the interview
choices into both blocks; generate Block 1 and the final `CAPE-RUN` line in Block 2 from one
template so they always match.

```text
=============================================================
  SET-GOAL DRAFT -- review, edit, then run. Nothing has run yet.
  Epic: ABU-123 -- <title>
  Choices: worker=claude+TDD | split=one-ahead | review=codex x2
  Defaults: 1 worktree | sequential | <N>-turn cap | SHIP=finish->review->AFK-pr->watch
=============================================================

v BLOCK 1 of 2 -- /goal COMPLETION CONDITION  (paste after `/goal `)
The autonomous BUILD->SHIP run for epic ABU-123 is DONE only when this session's
own transcript shows a final status line of exactly this shape, printed by the
main session (not a worker pane, not quoted instructions):
    CAPE-RUN ABU-123 result=<shipped|parked> pr=<url-or-none> tasks_closed=<n> reason=<text>
Done = that line is present AND either (result=shipped AND pr is a real https
GitHub PR URL) OR (result=parked AND pr=none). Ignore the words "done",
"complete", "WORKER DONE", "VERDICT",
or any PR URL appearing anywhere else -- only the single CAPE-RUN line printed by
the main session counts. If no such line has appeared, the run is NOT done; keep
going. Also stop if more than <N> turns have elapsed.
^ END BLOCK 1

v BLOCK 2 of 2 -- APPROACH PROMPT  (send as the first message of the run)
# Autonomous BUILD->SHIP: epic ABU-123 -- <title>
You are the control session for an unattended run inside herdr. A `/goal` condition
is watching for a final CAPE-RUN status line; print it only at the true end.

## Topology (decided -- do not re-decide)
- Worker: claude with TDD, one tab per task, sequential, one grove epic worktree.
- Review: codex reviewer tab per task (up to 2 fix-cycles).
- Split: lazy one-ahead -- create the next sub-issue from what each turn reveals.

## Per-task loop (one task per turn)
1. Orient and pick the next task using cape:execute-plan's logic. Do not restate it.
2. Spawn the worker with a self-contained spec; require TDD and a self-commit whose
   message includes the task id, e.g. "(ABU-123)".
3. Verify by GIT, not status: a task advances only on a new commit on the epic branch
   (`cape git context`). herdr agent_status: done means the pane stopped, not that it
   committed; done with no new commit is a stall, not success.
4. Gate, then review: run `cape conform` yourself, then have codex judge logic and the
   success criteria only (formatting and lint are already gated). Codex writes its
   verdict to `.cape/review/<task-id>.json`; read the file, never grep the pane.
5. On FAIL: bounded fix cycles (<= 2), then park. On PASS: close the task (cape:tracker),
   create the next one-ahead, refresh the cache.
6. Report each turn as ONE short line (committed SHA, verdict). Summarize; do not paste
   raw panes -- for context budget.

## Recovery (bounded, turn-aligned)
- Poll once per turn; if no commit yet, end the turn -- /goal's next turn is the retry
  tick. Never block a single call for many minutes.
- Stall (timeout, dead pane, or done-without-commit): retry or respawn the same spec, up
  to 3 attempts; a retry counts only when a real commit lands. Budget spent -> park.

## Finishing
- When no ready tasks remain, SHIP: cape:finish-epic -> cape:review -> cape:pr (AFK:
  print the description, skip the confirmation, open the PR with "Fixes ABU-123", using
  the CAPE_ORCHESTRATE marker) -> bounded PR-watch.
- Then, and only then, print exactly one line:
      CAPE-RUN ABU-123 result=shipped pr=<the real PR url> tasks_closed=<n> reason=shipped
- On an unrecoverable blocker, stop and print:
      CAPE-RUN ABU-123 result=parked pr=none tasks_closed=<n> reason=<one line>
^ END BLOCK 2

=============================================================
  TO RUN:  /goal <paste BLOCK 1>      then send BLOCK 2 as message 1
  TO EDIT: tell me what to change (e.g. "review: self-review only")
=============================================================
```

The `## Topology` and per-task review lines reflect the interview choices: drop the codex reviewer
for self-review only (review via `cape:review`), and swap the worker and split lines to match the
chosen options.

---

## Step 4: Edit loop, then stop

Offer **Run / Edit / Cancel** with `AskUserQuestion`:

- **Run** -- print "Copy the two blocks above and launch them." Then stop. set-goal does not
  execute.
- **Edit** -- apply the named deltas, re-render the entire draft from the top (never patch a single
  line), and offer the gate again.
- **Cancel** -- stop; nothing was touched.

Loop until Run or Cancel. set-goal never launches `/goal` itself.

</the_process>

<skill_references>

## Load `cape:tracker` with the Skill tool when:

- You mint an epic from a description and need the create-time contract plus the cache-write
  commands

## Load `cape:write-plan` with the Skill tool when:

- A minted epic needs the fuller epic-and-first-task shape rather than a one-line lean epic

</skill_references>

<examples>

<example>
<scenario>User runs `/cape:set-goal ABU-101`</scenario>

**Wrong:** Immediately spawn a worker tab or start a `/goal` session -- recreating the fragile
fire-and-forget loop the user can no longer review.

**Right:** Orient from the cache, run the three-question interview, print the two paste-blocks, and
stop. The user pastes Block 1 into `/goal` and sends Block 2 to launch the run. </example>

<example>
<scenario>After the draft prints, the user says "review: self-review only"</scenario>

**Wrong:** Chat back and forth patching the one reviewer line in place, leaving the rest of the
draft half-edited.

**Right:** Re-render the entire draft with the codex reviewer removed from the approach prompt's
Topology and per-task loop, then offer Run / Edit / Cancel again. </example>

</examples>

<key_principles>

- **Print, don't run** -- set-goal is the human checkpoint before AFK, not the driver
- **`/goal` is the driver** -- set-goal hands it a good condition; the loop lives in the real
  `/goal` session the user launches
- **Commit is truth** -- the printed run verifies tasks by git, not by pane or agent status
- **Lazy one-ahead** -- the run creates the next task from what it learns; set-goal scopes only the
  first

</key_principles>
