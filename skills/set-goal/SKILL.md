---
name: set-goal
description: >
  Interview-first front end for an autonomous epic run. Asks how to achieve the goal -- worker
  agent, how to split tasks, review strategy -- then STAGES a reviewable draft: a `/goal` completion
  condition plus an approach prompt that primes the run. The draft opens in an editor; the user
  reviews and launches it with `:wq`; set-goal never launches itself. Takes a Linear epic id or a
  free-form description (turned into a lean epic first). Triggers on: "set up an autonomous run",
  "draft a /goal for this epic", "prep an AFK run", "/cape:set-goal ABU-123", "/cape:set-goal
  <description>". Do NOT use for: actually driving a run (that is the approach prompt fed to
  `/goal`), a single supervised task (cape:execute-plan), or interactive PLAN exploration with a
  human in the loop (cape:brainstorm / cape:write-plan).
---

<skill_overview> Interview an epic into a reviewable `/goal` draft and open it for launch. The draft
is one file: a decisions table, a `/goal` completion condition, and an approach prompt that primes
an autonomous BUILD-and-SHIP run. In a herdr workspace set-goal writes the draft to a temp file and
opens it in a split editor pane; you review and edit there, then `:wq` launches (arms `/goal`,
submits the prompt to the main pane) or `:cq` cancels. Outside herdr it writes the file and prints
the path. Core contract: set-goal stages the draft but never launches -- the human's `:wq` does.
</skill_overview>

<rigidity_level> LOW FREEDOM -- The stage-not-start boundary, the draft layout (decisions table,
condition, prompt), and the paired `CAPE-RUN` line and condition are fixed; the interview defaults
and the approach-prompt wording adapt to the epic. </rigidity_level>

<when_to_use>

- A planned epic you want to hand to an autonomous `/goal` run, prepared and reviewed first
- A free-form description you want turned into a lean epic plus an autonomous run draft
- Preparing an AFK run you intend to review before launching

**Don't use for:**

- Driving the run itself -- that is the approach prompt, fed to `/goal`
- A single supervised task -- use `cape:execute-plan`
- Interactive PLAN exploration with a human in the loop -- use `cape:brainstorm` / `cape:write-plan`

</when_to_use>

<critical_rules>

1. **Stage, never start** -- set-goal writes the run to a draft file and opens it for review; the
   run launches only on the human's `:wq` in that editor (which arms `/goal` and submits the
   prompt). set-goal never arms `/goal`, spawns a worker, or commits during staging.
2. **Two sections, one pair** -- render the `/goal` condition and the approach prompt as the draft's
   `## Condition` and `## Prompt` sections, generated as a pair so the prompt's final `CAPE-RUN`
   line and the condition always match.
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

First, auto-derive the **task source** from the cache -- do not ask it. Multiple ready tasks (a
pre-planned epic) means the run executes them in dependency order; a freshly minted or single-task
epic means the run seeds tasks lazily one ahead. Surface the derived mode in the draft header (Step
3).

Then ask three structured questions with `AskUserQuestion`, each with a marked default so the user
can accept all at once:

1. **Builder** -- `claude` builds (default) / `codex` builds.
2. **Review** -- who reviews each task, chosen independently of the builder: `codex` reviews
   (default) / `claude` reviews / self-review only (no separate reviewer, the run self-reviews via
   `cape:review`). A separate reviewer runs up to 2 fix-cycles.
3. **Run instructions** -- open free-text for anything that shapes the run: guardrails ("no schema
   changes", "no new deps"), workflow ("one PR per task"), review focus, areas to avoid. Empty =
   defaults only.

Everything else is a stated default, surfaced in the draft's header but not asked: TDD on, one grove
epic worktree, sequential tasks, SHIP = finish-epic then review then AFK pr then bounded PR-watch,
and a turn cap computed from the task count (about `2 x ready tasks + SHIP overhead`). The user
changes a default by editing the draft in the editor (Step 4), not with another question.

---

## Step 3: Render the draft

Compute the turn cap from the cached task count. Render the draft as one markdown file -- a
decisions table the user scans, then a `## Condition` section and a `## Prompt` section. Substitute
the epic id, title, derived task source, and interview choices throughout; generate the condition
and the prompt's final `CAPE-RUN` line from one template so they always match. This content is
written to the draft file in Step 4 -- do not dump it into the conversation. The `## Condition` and
`## Prompt` headers are parse markers for the launch helper; keep them exact.

```text
# Run draft -- ABU-123 : <title>
<one-line epic goal>

| Setting  | Value                                                 |
|----------|-------------------------------------------------------|
| Mode     | <execute N planned tasks | lazy one-ahead, seed epic> |
| Builder  | claude + TDD                                          |
| Review   | separate (codex), <=2 cycles                          |
| Worktree | 1 grove epic worktree, sequential tasks               |
| Turn cap | <N>                                                   |
| SHIP     | finish -> review -> AFK pr -> watch                    |

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

# Autonomous BUILD->SHIP: epic ABU-123 -- <title>
You are the control session for an unattended run inside herdr. A `/goal` condition is watching for a
final CAPE-RUN status line; print it only at the true end.

First, label this workspace so its prefix tracks overall progress:
run `cape worktree start ABU-123 --phase BUILD`, then `cape workspace phase build` -- this renames
your workspace and tab to
`🔨 ABU-123 <title>`. Advance the phase only at overall transitions (not per task): `pr` when SHIP
starts, `done` on a clean ship, `blocked` on park. Per-task work happens in the task's own tab and
never touches the workspace label.

## Topology (decided -- do not re-decide)
- Tabs box tasks: the orchestrator keeps its own tab for the whole run; each task gets its own tab,
  with its worker, reviewer, and any QA as panes split inside that one tab. When the task closes, one
  `herdr tab close` reaps every pane in it -- never accumulate tabs or panes. (Builder, reviewer, and
  cycle cap are in the decisions table.)
- Task source: execute the planned tasks in dependency order; respect Linear blocking relations and
  the dependency notes in task descriptions. Do not invent tasks.

## Per-task loop (one task per turn)
1. Pick the next task by dependency order -- honor Linear blocking relations and the task
   descriptions, not just next-ready. (Lazy mode: create the next task one ahead instead.)
2. Open the task's tab (its box): `herdr tab create --workspace <this workspace> --label
   "<task-id> <short-title>"`, and capture both `result.tab.tab_id` (the `<task-tab>`, closed in
   step 5) and `result.root_pane.pane_id` (the `<root_pane>`). Run the builder in that root pane and
   label it: `herdr pane run <root_pane> "<builder>"`, then `herdr pane rename <root_pane> "🔨 worker"`.
   Give it a self-contained spec; require TDD and a self-commit whose message includes the task id,
   e.g. "(ABU-123)".
3. Verify by GIT, not status: a task advances only on a new commit on the epic branch
   (`cape git context`). herdr agent_status: done means the pane stopped, not that it committed; done
   with no new commit is a stall, not success. Check the commit message too: conventional format and
   the task id (e.g. "(ABU-123)"); a malformed message is a fix-cycle, not a pass.
4. Gate, then review: run `cape conform` yourself and treat its convention findings as a task gate --
   unaddressed violations are a fix-cycle, same as a reviewer FAIL. Then add the codex reviewer as a
   pane in the SAME task tab: `herdr pane split <root_pane> --direction down` (capture the new pane
   id), `herdr pane run <reviewer-pane> "<reviewer>"`, `herdr pane rename <reviewer-pane> "🔍 review"`.
   Have it judge logic and the success criteria only (tests, typecheck, fallow, and conform are
   already gated). The reviewer writes its verdict to `.cape/review/<task-id>.json`; read the file,
   never grep the pane. (Self-review mode: skip the reviewer pane and review via `cape:review`
   instead.)
5. On FAIL (reviewer verdict or unresolved conform findings): bounded fix cycles (<= 2), then park.
   On PASS: close the task (cape:tracker), close the task's tab (`herdr tab close <task-tab>`, which
   reaps its panes), refresh the cache, and move to the next task (lazy mode: create it one ahead
   first).
6. Report each turn as ONE short line (committed SHA, verdict). Summarize; do not paste raw panes --
   for context budget.

## Run instructions (honor throughout)
<verbatim free-text from the interview; may add guardrails or change SHIP, e.g. one PR per task.
Omit this whole section when the field was empty.>

## Recovery (bounded, turn-aligned)
- Poll once per turn; if no commit yet, end the turn -- /goal's next turn is the retry tick. Never
  block a single call for many minutes.
- Stall (timeout, dead pane, or done-without-commit): retry or respawn the same spec, up to 3
  attempts; a retry counts only when a real commit lands. Budget spent -> park: run
  `cape workspace phase blocked`, then stop.

## Finishing
- When no ready tasks remain, SHIP: `cape workspace phase pr`, then cape:finish-epic -> cape:review
  -> cape:pr (AFK: print the description, skip the confirmation, open the PR with "Fixes ABU-123",
  using the CAPE_ORCHESTRATE marker) -> bounded PR-watch.
- Bounded PR-watch: poll CI; once green, poll the PR's review threads. For a valid one, fix it (spawn
  a worker, verify the commit, re-review, push), then resolve that thread with a reply citing the fix
  commit. For an invalid / out-of-scope one, reply with a one-line reason and leave it unresolved. An
  unresolved thread must mean still-open: never leave a thread you fixed unresolved, never resolve one
  you did not fix. Resolve via the GraphQL `resolveReviewThread` mutation; the `gh` CLI cannot resolve
  threads.
- On a clean ship, run `cape workspace phase done`, then print exactly one line:
      CAPE-RUN ABU-123 result=shipped pr=<the real PR url> tasks_closed=<n> reason=shipped
- On an unrecoverable blocker, run `cape workspace phase blocked`, then stop and print:
      CAPE-RUN ABU-123 result=parked pr=none tasks_closed=<n> reason=<one line>
```

The decisions table and the `## Prompt` per-task loop reflect the interview choices and the derived
task source: render the builder and reviewer from their own answers (they
are chosen independently -- the reviewer is not derived from the builder); for self-review, drop the
separate reviewer from the loop and review via `cape:review`; for lazy mode, use the one-ahead
variants in steps 1 and 5; and omit `## Run instructions` when the free-text field was empty. The
table is a
read-only summary -- to flip a decision, edit the `## Prompt` body (or re-run set-goal); editing the
table alone changes nothing.

---

## Step 4: Open the draft for launch

In a herdr workspace set-goal opens the draft in a split editor and lets the human launch with
`:wq`. There is no Run / Edit / Cancel question -- the editor is the review, edit, and launch
surface.

**If the pane is a live herdr workspace** -- `$HERDR_PANE_ID` is set AND
`herdr pane get $HERDR_PANE_ID` succeeds (the env var alone is not enough; the pane must be
reachable):

1. Write the rendered draft (table + `## Condition` + `## Prompt`) to
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
   "${EDITOR:-nvim}" "${draft}" || { echo "cancelled -- nothing sent"; exit 0; }
   cond=$(sed -n '/^## Condition/,/^## Prompt/p' "${draft}" \
     | sed '1d;/^## Prompt/d;/^[[:space:]]*$/d;s/^[[:space:]]*-[[:space:]]*//' \
     | tr '\n' ' ' | tr -s ' ')
   prompt=$(sed -n '/^## Prompt/,$p' "${draft}" | sed '1d')
   herdr pane run "${main_pane}" "/goal ${cond}"
   herdr wait output "${main_pane}" --match "Goal set:" --timeout 15000
   herdr pane send-keys "${main_pane}" Escape
   herdr wait output "${main_pane}" --match "Interrupted" --timeout 10000
   herdr pane run "${main_pane}" "${prompt}"
   echo "launched"
   ```

   `:wq` (exit 0) runs the launch; `:cq` (exit 1) hits the `||` and cancels. `/goal` arms only here.
   `pane run` submits the condition and its Enter atomically; `wait output` on `Goal set:` confirms
   the arm before anything else, so the condition and prompt never merge into one over-length input.
   Arming starts a turn immediately with the bare condition as directive, so `Escape` cancels that
   empty turn (the goal stays armed -- Esc interrupts only the in-flight turn); `wait output` on
   `Interrupted` confirms the cancel landed before the approach prompt is sent as the genuine first
   directive. The watcher then evaluates normally after each turn. The `trap ... EXIT` closes the
   review pane itself on every exit path (`:wq`, `:cq`, or error), so set-goal never leaves a
   dangling editor pane in the workspace.

3. Split a review pane off the invoking pane -- target `$HERDR_PANE_ID` explicitly, never the
   focused pane: focus may be in another workspace, which would open the draft in the wrong place.
   Run the helper in the new pane:
   - `herdr pane split "$HERDR_PANE_ID" --direction down --focus` -- capture the new pane id from
     the result.
   - `herdr pane run <new-pane-id> "bash '<review path>'"`

4. Print one line -- "Draft open in the split below: review, then `:wq` to launch or `:cq` to
   cancel" -- then end the turn. Nothing is armed; your input box is untouched.

**Otherwise** (no reachable herdr pane) -- write the draft to
`${TMPDIR:-/tmp}/cape-set-goal-<epic>.md` and print only its path. The user opens it, copies the
condition and prompt, and launches manually. Then stop.

set-goal stages the draft but never launches; the human's `:wq` does.

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

**Wrong:** Immediately spawn a task tab or worker pane, or arm `/goal` during staging -- recreating
the fragile fire-and-forget loop, or kicking off the watcher before any run exists so it loops on
nothing.

**Right:** Orient from the cache, run the four-question interview, render the draft, and open it in
a split editor (temp file plus path outside herdr). The run launches only when the human `:wq`s;
set-goal never arms `/goal` or launches itself. </example>

<example>
<scenario>During the interview the user picks "review: self-review only"</scenario>

**Wrong:** Render a draft that still names a codex reviewer in the per-task loop.

**Right:** Render the draft with the codex reviewer dropped from the loop -- the decisions table
reads `Review: self-review`, and the `## Prompt` reviews via `cape:review` -- then open it for
`:wq`. </example>

</examples>

<key_principles>

- **Stage, don't run** -- set-goal is the human checkpoint before AFK, not the driver
- **`/goal` is the driver** -- set-goal hands it a good condition; the loop lives in the real
  `/goal` session the user launches
- **Commit is truth** -- the printed run verifies tasks by git, not by pane or agent status
- **Lazy one-ahead** -- the run creates the next task from what it learns; set-goal scopes only the
  first

</key_principles>
