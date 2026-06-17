# Cape V2 specification

Derived from the redesign interview. V2's north star: a **lightweight, opinionated framework for the
single-agent workflow** you actually run — streamlined to how you work, with orchestration (herdr,
parallel agents) layered on later.

**Must-nail:** the single-agent PLAN → BUILD → SHIP chain flow, end to end.

## Principles

- **Lean over complete.** 22 skills → 11 + router. A finding becomes lines inside an existing skill
  or config — never a new skill. New skills must clear a high bar (distinct trigger, distinct phase,
  used standalone).
- **Opinionated, one path.** No config knobs; forking is the escape hatch.
- **Steps auto-fire inside named phases.** You invoke a phase; its steps chain.
- **State is the spine.** The workflow rides on the tracker; it must be trustworthy.
- **Build for one agent now; leave seams for orchestration later.**

## Skill roster (11 + router)

| Chain | Skill                     | Notes                                                                                         |
| ----- | ------------------------- | --------------------------------------------------------------------------------------------- |
| PLAN  | `brainstorm`              | `challenge` folded in; one-question-at-a-time elicitation that proposes its own answer        |
| PLAN  | `write-plan`              | `task-refinement` folded in; Global Constraints + per-task Interfaces for multi-task epics    |
| BUILD | `execute-plan`            | `expand-task` inlined; inline pre-flight plan scan before task 1                              |
| BUILD | `test-driven-development` | red-before-green hard-gated                                                                   |
| BUILD | `commit`                  | stays simple (no conform gate here)                                                           |
| SHIP  | `finish-epic`             | verify criteria with fresh evidence                                                           |
| SHIP  | `review`                  | `conform` folded in (bugs/logic **and** conventions); reviewer contract; invocable standalone |
| SHIP  | `pr`                      | runs `review` first                                                                           |
| BUG   | `fix-bug`                 | `debug-issue` folded in as a loop-first diagnosis gate (no repro, no hypothesis)              |
| INFRA | `worktree`                | repurposed from dead `branch`; wraps grove; per-epic; deliberate "start work" step            |
| INFRA | `tracker`                 | replaces `beads`; Linear-backed via a seam (see State layer)                                  |
| —     | `don-cape`                | always-on router                                                                              |

**Cut:** `analyze-tests`, `design-an-interface`, `explain`, `find-test-gaps`, `refactor`.
**Repurposed:** `branch` → `worktree`. **Replaced:** `beads` → `tracker`.

## The chains

```text
PLAN   brainstorm ──→ write-plan ──→ [human gate: approve epic]
BUILD  execute-plan ──→ tdd ──→ commit   (loop per task; stop after each for review)
SHIP   finish-epic ──→ review (+conform) ──→ [human gate: approve PR] ──→ pr
BUG    fix-bug (diagnose-then-patch) ──→ rejoins BUILD tail (tdd → commit)
```

- **Human gates:** after PLAN (approve epic), before SHIP (approve PR). BUILD runs without per-step
  approval.
- **BUILD cadence:** implement one task → reflect → create next task → **stop for review**.
- **Entry points:** named phase invocations (`plan` / `build` / `ship`); internal steps auto-fire.
  Phase entries are **user-invoked** (no trigger prose → lighter session context); internal
  disciplines (tdd, review) stay **model-invoked**.

## Enforcement (hooks)

Hard-block the critical few; nudge the rest. Reuses the existing `cape hook` machinery.

- **Hard:** TDD red-before-green; review-before-pr.
- **Soft:** everything else (warnings, suggestions).
- Hard blocks must be overridable in the moment via an explicit escape — never silent.

## State layer — Linear behind a Tracker seam

br is retired. Linear becomes the tracker (real work already lives there; br sync was the core
pain). Decoupled so cape isn't hard-coupled and orchestration can reuse it.

- **Seam:** a `Tracker` interface (`createEpic`, `createTasks`, `listReady`, `updateStatus`,
  `close`). Linear is the implementation.
- **Granularity:** epic + tasks become Linear issues/sub-issues. Fine-grained `expand-task`
  breakdown stays **ephemeral / in-session** — keep the team board clean.
- **Scope:** Linear everywhere, including personal repos (personal Linear workspace). **No local
  fallback.**
- **Cache:** the workflow writes a **local cache** as it touches Linear; reads (banner, "what's
  ready") come from the cache — instant, offline-safe. TTL refresh covers out-of-band edits. The
  banner never depends on the network.
- **Migration:** build the seam + Linear impl this pass, **scoped tight** (only the operations the
  chains need — no "manage Linear" skill). Park br's code as a one-time migration source, then
  retire it.

## Session-start banner

Extend the existing `cape hook session-start` (`cli/src/services/hooks/state.ts`, already injects
`additionalContext` on startup/resume/clear/compact). Add a computed banner — rendered verbatim by
Claude as its first message:

```text
+-- cape -----------------------------------+
| Epic   <id>  <title>                      |
| Phase  BUILD  (3/7 tasks done)            |
| Next   <task-id> - <title>                 |
| Branch <branch> (worktree)                |
+-- Say "Continue." to start ---------------+
```

Sources: active epic + next ready task (tracker cache), phase (`flowPhase` state), branch/worktree
(git). No active epic → no banner (zero noise).

## Worktrees

- **grove owns everything worktree-related** (create + manage). herdr is **not** in V2.
- **One worktree per epic.** The `worktree` skill is the deliberate "start work" step; it also
  stamps the epic ID into the worktree so the banner/resume knows the context.
- Concurrency: many epics may exist (each its own worktree); the current worktree is the focused
  one.

## Agents (5 + tiers)

Keep the workhorses; merge the 3 near-dead into `codebase-investigator` as `--mode` flags.

| Agent                                                                                | Default model tier |
| ------------------------------------------------------------------------------------ | ------------------ |
| `codebase-investigator` (absorbs test-auditor, bug-tracer, notebox-researcher modes) | cheap              |
| `test-runner`                                                                        | cheap              |
| `fact-checker`                                                                       | mid                |
| `internet-researcher`                                                                | cheap/mid          |
| `code-reviewer`                                                                      | mid                |

Every dispatch names a model tier explicitly — never silently inherit the session's top tier.

## Adopted methodology (folds, no new skills)

From obra/superpowers and mattpocock/skills, folded into existing skills:

- **Pre-flight plan scan** → `execute-plan` (inline, before task 1).
- **Reviewer contract** → `review` (read-only, cites file:line, treats implementer rationales as
  unverified claims, no severity pre-judging).
- **Global Constraints + per-task Interfaces** → `write-plan` (multi-task epics only).
- **One-question-at-a-time elicitation** → `brainstorm`.
- **Skill-authoring discipline** → one lazy-loaded vocabulary/failure-mode reference, consumed only
  by `skill-creator`. Zero session cost.

## Explicitly deferred (follow-up epics)

- **herdr orchestration** — workspaces, panes, multi-agent fan-out across worktrees.
- **Parallel execution** + file-handoff scripts (needs the isolation discipline first).
- **More skills** — resolving-merge-conflicts, domain-modeling, handoff docs.
- **Distribution/versioning** — changesets, skills.sh, public packaging.

## Open / foundational risks

- **Linear integration weight.** Auth + API + cache + status sync could balloon scope and crowd out
  the must-nail. Mitigation: scope tight, sequence after the chain flow.
- **Cache staleness** on out-of-band Linear edits. Acceptable for a pointer; TTL refresh.

## Suggested build sequence

1. **Roster surgery** — cut/fold/repurpose skills; flat names; invocation split.
2. **Tracker seam + minimal Linear impl + cache** — the spine the chains ride on.
3. **Chain flow end to end** (the must-nail) — gates, BUILD cadence, hooks.
4. **Session-start banner** — extend the existing hook.
5. **worktree skill** (grove) + epic stamping.
6. **Agent merge + model tiers**, **methodology folds**, **skill-authoring doc**.
7. Retire br after migrating existing issues.
