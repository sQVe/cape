---
name: set-goal
argument-hint: '[epic id or description]'
description: >
  Interview-first front end for an autonomous epic run. Asks how to achieve the goal, which agent
  builds, how tasks split, who reviews, then stages a reviewable draft: a `/goal` completion
  condition plus an approach prompt that primes the run. The draft opens in an editor; the user
  reviews and launches it with `:wq`; set-goal never launches itself. Takes a Linear epic id or a
  free-form description, which it turns into a lean epic first. Triggers on: "set up an autonomous
  run", "draft a /goal for this epic", "prep an AFK run", "/cape:set-goal ABU-123", "/cape:set-goal
  <description>". Do NOT use for: driving a run (that is the approach prompt fed to `/goal`), a
  single supervised task (use cape:execute-plan), or interactive PLAN exploration with a human in
  the loop (use cape:brainstorm or cape:write-plan).
---

# Set goal

Interview an epic into a reviewable `/goal` draft and open it for launch. The draft is one file, a
decisions table plus a completion condition plus an approach prompt that primes an autonomous
BUILD-and-SHIP run; set-goal stages that file, and only the human's `:wq` launches it.

The stage-not-start boundary, the draft layout, and the paired `CAPE-RUN` line and condition are
fixed; interview defaults and approach-prompt wording adapt to the epic.

## Rules

1. **Stage, never start.** Write the run to a draft file and open it for review. The run launches
   only on the human's `:wq` in that editor, which arms `/goal` and submits the prompt. Never arm
   `/goal`, spawn a worker, or commit during staging.
2. **Condition and prompt are a pair.** Render them as the draft's `## Condition` and `## Prompt`
   sections from one template, so the prompt's final `CAPE-RUN` line and the condition always match.
3. **Sole writer for a minted epic.** When minting an epic from a description, you are the only
   Linear and cache writer. Follow the `cape:tracker` contract and refresh the cache after the
   write.
4. **No fixed sentinel.** Completion is the data-carrying `CAPE-RUN` line, never a constant string.
   Do not reintroduce a fixed sentinel or a summarize-never-paste rule as leak protection.
   Summarizing pane output to save context budget is fine.

## Process

### 1. Orient from the tracker cache

Resolve the target from the invocation:

- An epic id (`/cape:set-goal ABU-123`): use that epic.
- A free-form description: mint a lean epic first, with a title, goal, success criteria, and one
  first task, via the `cape:tracker` contract, then refresh the cache. One first task is enough
  because the run creates later tasks one ahead. Run the epic text through `cape:unslop` before
  writing it. Print a one-line plan summary (epic goal plus first task) before drafting.
- Nothing: use the active epic from the cache; if several are active, ask which.

Read the tracker cache (`hooks/context/tracker.json`) for the epic's ready-task titles and count;
they ground the interview and the computed turn cap. Do not network-read for orientation. A stale or
missing cache follows the `cape:tracker` cache rule: say so and refresh from an MCP result in
session before drafting. Do not guess.

### 2. Interview the approach

Derive the task source from the cache; do not ask it. Multiple ready tasks (a pre-planned epic)
means the run executes them in dependency order; a freshly minted or single-task epic means the run
seeds tasks lazily one ahead. Surface the derived mode in the draft header.

Ask three questions with `AskUserQuestion`, each with a marked default so the user can accept all at
once:

1. **Builder.** `claude` builds (default) or `codex` builds. TDD is enforced either way; word both
   options so neither implies TDD is claude-only.
2. **Review.** Chosen independently of the builder: `codex` reviews (default), `claude` reviews, or
   self-review only. A separate reviewer runs up to 2 fix cycles. Self-review means the worker's own
   judgment plus the automated gates; `/code-review` is a human-typed command an AFK run cannot
   invoke. Prefer a separate reviewer for anything non-trivial. Either way the SHIP phase runs a
   `cape:code-reviewer` pass over the branch, which is what lets an unattended run tick the PR's
   review box.
3. **Run instructions.** Free text for anything that shapes the run: guardrails ("no schema
   changes", "no new deps"), workflow ("one PR per task"), review focus, areas to avoid. Empty means
   defaults only.

Everything else is a stated default, surfaced in the draft header but not asked: TDD on, one grove
epic worktree, sequential tasks, SHIP as finish-epic then AFK pr then bounded PR watch, and a turn
cap of about 2 x ready tasks plus SHIP overhead. The user changes a default by editing the draft in
the editor, not with another question.

### 3. Render the draft

Compute the turn cap from the cached task count. Render the draft as one markdown file: a decisions
table the user scans, then a `## Condition` section and a `## Prompt` section. Substitute the epic
id, title, derived task source, and interview choices throughout; generate the condition and the
prompt's final `CAPE-RUN` line from one template so they always match. Run the draft's prose through
`cape:unslop`. This content goes into the draft file in step 4; do not dump it into the
conversation. The `## Condition` and `## Prompt` headers are parse markers for the launch helper;
keep them exact.

```text
# Run draft: ABU-123 <title>
<one-line epic goal>

| Setting  | Value                                                 |
|----------|-------------------------------------------------------|
| Mode     | <execute N planned tasks | lazy one-ahead, seed epic> |
| Builder  | <claude|codex> + TDD                                  |
| Review   | separate (codex), <=2 cycles                          |
| Worktree | 1 grove epic worktree, sequential tasks               |
| Turn cap | <N>                                                   |
| SHIP     | finish -> AFK pr -> watch                             |

:wq launches the run · :cq cancels · edit anything below first

## Condition

Run is DONE only when the main session (not a worker pane, not quoted instructions) prints, verbatim:
    CAPE-RUN ABU-123 result=<shipped|parked> pr=<url|none> tasks_closed=<n> reason=<text>

- shipped -> pr is a real https GitHub PR url
- parked  -> pr=none
- ignore "done" / "complete" / "WORKER DONE" / "VERDICT" / any other PR url
- only the single CAPE-RUN line from the main session counts
- no CAPE-RUN line yet -> not done, keep going
- stop after <N> turns

## Prompt

# Autonomous BUILD->SHIP: epic ABU-123 <title>
You are the control session for an unattended run inside herdr. A `/goal` condition is watching for
a final CAPE-RUN status line; print it only at the true end.

First, label this workspace so its prefix tracks overall progress: run
`cape worktree start ABU-123 --phase BUILD`, then `cape workspace phase build`. This renames your
workspace and tab to `🔨 ABU-123 <title>`. Advance the phase only at overall transitions, not per
task: `pr` when SHIP starts, `done` on a clean ship, `blocked` on park. Per-task work happens in
the task's own tab and never touches the workspace label.

## Topology (decided, do not re-decide)
- Tabs box tasks: the orchestrator keeps its own tab for the whole run; each task gets its own tab,
  with its worker plus any reviewer and QA panes split inside that one tab (no reviewer pane in
  self-review mode). When the task closes, one `herdr tab close` reaps every pane in it; never
  accumulate tabs or panes. (Builder, reviewer, and cycle cap are in the decisions table.)
- Task source: execute the planned tasks in dependency order; respect Linear blocking relations and
  the dependency notes in task descriptions. Do not invent tasks.

## Per-task loop (one task per turn)
1. Pick the next task by dependency order; honor Linear blocking relations and the task
   descriptions, not just next-ready. (Lazy mode: create the next task one ahead instead.)
2. Open the task's tab (its box): `herdr tab create --workspace <this workspace> --label
   "<task-id> <short-title>"`, and capture both `result.tab.tab_id` (the `<task-tab>`, closed in
   step 5) and `result.root_pane.pane_id` (the `<root_pane>`). Run the builder in that root pane
   and label it: `herdr pane run <root_pane> "<builder>"`, then
   `herdr pane rename <root_pane> "🔨 worker"`. Give it a self-contained spec; require TDD and a
   self-commit whose message includes the task id, e.g. "(ABU-123)".
3. Verify by GIT, not status: a task advances only on a new commit on the epic branch
   (`cape git context`). herdr agent_status: done means the pane stopped, not that it committed;
   done with no new commit is a stall, not success. Check the commit message too: conventional
   format and the task id (e.g. "(ABU-123)"); a malformed message is a fix cycle, not a pass.
4. Review: add the reviewer as a pane in the SAME task tab:
   `herdr pane split <root_pane> --direction down` (capture the new pane id),
   `herdr pane run <reviewer-pane> "<reviewer>"`, `herdr pane rename <reviewer-pane> "🔍 review"`.
   Have it judge logic and the success criteria only (tests, typecheck, and fallow are already
   gated). The reviewer writes its verdict to `.cape/review/<task-id>.json`; read the file, never
   grep the pane. (Self-review mode: no reviewer pane and no builtin review path; the worker's own
   judgment plus the automated gates are the whole check.)
5. On FAIL (reviewer verdict): bounded fix cycles (<=2), then park.
   On PASS: close the task (cape:tracker), close the task's tab (`herdr tab close <task-tab>`,
   which reaps its panes), refresh the cache, and move to the next task (lazy mode: create it one
   ahead first).
6. Report each turn as ONE short line (committed SHA, verdict). Summarize; do not paste raw panes,
   to save context budget.

## Run instructions (honor throughout)
<verbatim free text from the interview; may add guardrails or change SHIP, e.g. one PR per task.
Omit this whole section when the field was empty.>

## Recovery (bounded, turn-aligned)
- Poll once per turn; if no commit yet, end the turn. /goal's next turn is the retry tick. Never
  block a single call for many minutes.
- Stall (timeout, dead pane, or done-without-commit): retry or respawn the same spec, up to 3
  attempts; a retry counts only when a real commit lands. Budget spent means park: run
  `cape workspace phase blocked`, then stop.

## Finishing
- When no ready tasks remain, SHIP: `cape workspace phase pr`, then cape:finish-epic, then cape:pr
  (tell it this run is unattended with no human to confirm, so it takes the AFK branch: print the
  description, skip the confirmation, open the PR with "Fixes ABU-123"), then a bounded PR watch.
- Bounded PR watch: poll CI; once green, load cape:pr-feedback and follow its contract for the
  review threads (judge validity, fix, reply, resolve), spawning a worker for each accepted fix.
  An unresolved thread must mean still open: never leave a thread you fixed unresolved, never
  resolve one you did not fix.
- On a clean ship, run `cape workspace phase done`, then print exactly one line:
      CAPE-RUN ABU-123 result=shipped pr=<the real PR url> tasks_closed=<n> reason=shipped
- On an unrecoverable blocker, run `cape workspace phase blocked`, then stop and print:
      CAPE-RUN ABU-123 result=parked pr=none tasks_closed=<n> reason=<one line>
```

Render the builder and reviewer from their own answers; they are chosen independently, so the
reviewer is never derived from the builder. For self-review, drop the reviewer from the per-task
loop with no review step in its place. For lazy mode, use the one-ahead variants in loop steps 1
and 5. Omit `## Run instructions` when the free-text field was empty. The table is a read-only
summary; to flip a decision, edit the `## Prompt` body or re-run set-goal. Editing the table alone
changes nothing.

### 4. Open the draft for launch

In a herdr workspace, open the draft in a split editor and let the human launch with `:wq`. There is
no Run/Edit/Cancel question; the editor is the review, edit, and launch surface.

**If the pane is a live herdr workspace**, meaning `$HERDR_PANE_ID` is set AND
`herdr pane get $HERDR_PANE_ID` succeeds (the env var alone is not enough; the pane must be
reachable):

1. Write the rendered draft (table plus `## Condition` plus `## Prompt`) to
   `${TMPDIR:-/tmp}/cape-set-goal-<epic>.md`.
2. Write a review helper to `${TMPDIR:-/tmp}/cape-set-goal-<epic>-review.sh`, substituting the draft
   path and the reachable `$HERDR_PANE_ID` value:

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   readonly draft="<draft path>"
   readonly main_pane="<HERDR_PANE_ID value>"
   readonly self="${HERDR_PANE_ID}"
   trap 'herdr pane close "${self}" >/dev/null 2>&1 || true' EXIT
   # Poll the pane TAIL for a marker. Never use `herdr wait output` here: it matches
   # pre-existing scrollback, and staging previews already planted these markers there.
   # 15 lines: past the ~8 lines of composer/status chrome, far below stale markers.
   tail_until() {
     local marker="$1" tries="$2" i
     for ((i = 0; i < tries; i++)); do
       if herdr pane read "${main_pane}" --source recent-unwrapped --lines 15 \
         | grep -qF "${marker}"; then
         return 0
       fi
       sleep 0.5
     done
     echo "launch aborted: '${marker}' never reached the pane tail" >&2
     return 1
   }
   "${EDITOR:-nvim}" "${draft}" || {
     echo "cancelled -- nothing sent"
     exit 0
   }
   cond=$(sed -n '/^## Condition/,/^## Prompt/p' "${draft}" \
     | sed '1d;/^## Prompt/d;/^[[:space:]]*$/d;s/^[[:space:]]*-[[:space:]]*//' \
     | tr '\n' ' ' | tr -s ' ')
   prompt=$(sed -n '/^## Prompt/,$p' "${draft}" | sed '1d')
   herdr pane run "${main_pane}" "/goal ${cond}"
   tail_until "Goal set:" 30
   herdr pane send-keys "${main_pane}" Escape
   tail_until "Interrupted" 20
   herdr pane run "${main_pane}" "${prompt}"
   echo "launched"
   ```

   How the helper stays safe:

   - `:wq` (exit 0) runs the launch; `:cq` (exit 1) hits the `||` and cancels. `/goal` arms only
     here.
   - `pane run` submits the condition and its Enter atomically. `tail_until "Goal set:"` confirms
     the arm before anything else, so the condition and prompt never merge into one over-length
     input.
   - Arming starts a turn immediately with the bare condition as directive. `Escape` cancels that
     empty turn (the goal stays armed; Esc interrupts only the in-flight turn), and
     `tail_until "Interrupted"` confirms the cancel landed before the approach prompt is sent as the
     genuine first directive. The watcher then evaluates normally after each turn.
   - Both gates poll only the last few lines of the pane because `herdr wait output` matches recent
     scrollback, including text that predates the wait, and staging itself plants both markers
     there: the helper-script preview contains the literal `Goal set:`, and any earlier Esc leaves
     an `Interrupted` line. A poisoned wait passes instantly, un-paces the send sequence, and merges
     the condition and prompt into one over-length `/goal` input. With tail polling, a failed submit
     times out and aborts the launch (`set -e` plus the trap) instead of merging.
   - The `trap ... EXIT` closes the review pane itself on every exit path (`:wq`, `:cq`, or error),
     so set-goal never leaves a dangling editor pane in the workspace.

3. Split a review pane off the invoking pane. Target `$HERDR_PANE_ID` explicitly, never the focused
   pane: focus may be in another workspace, which would open the draft in the wrong place. Run the
   helper in the new pane:
   - `herdr pane split "$HERDR_PANE_ID" --direction down --focus`, capturing the new pane id from
     the result.
   - `herdr pane run <new-pane-id> "bash '<review path>'"`
4. Print one line, "Draft open in the split below: review, then `:wq` to launch or `:cq` to cancel",
   then end the turn. Nothing is armed; your input box is untouched.

**Otherwise** (no reachable herdr pane), write the draft to
`${TMPDIR:-/tmp}/cape-set-goal-<epic>.md` and print only its path. The user opens it, copies the
condition and prompt, and launches manually. Then stop.

## Skills

Load `cape:tracker` when:

- You mint an epic from a description and need the create-time contract plus the cache-write
  commands

Load `cape:write-plan` when:

- A minted epic needs the fuller epic-and-first-task shape rather than a one-line lean epic

## Examples

**Wrong:** On `/cape:set-goal ABU-101`, immediately spawn a task tab or worker pane, or arm `/goal`
during staging. That recreates the fragile fire-and-forget loop, or kicks off the watcher before any
run exists so it loops on nothing.

**Right:** Orient from the cache, run the three-question interview, render the draft, and open it in
a split editor (temp file plus printed path outside herdr). The run launches only when the human
`:wq`s.

**Wrong:** The user picks "review: self-review only" and the draft still names a codex reviewer in
the per-task loop.

**Right:** The decisions table reads `Review: self-review`, and the `## Prompt` per-task loop has no
review step.
