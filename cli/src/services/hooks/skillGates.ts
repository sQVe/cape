import { Effect } from 'effect';

import { logEvent } from '../../eventLog';
import { denyTable } from './denyTable';
import { parseCommand, parseCwd, parseSkillInput, stripQuotedContent } from './parsing';
import {
  HookService,
  isDoneTask,
  isReadyTask,
  readFlowPhaseContext,
  readState,
  readStateKey,
  readTrackerCache,
  resolveBranchInfo,
} from './state';

export { denyTable } from './denyTable';

export const denyWith = (reason: string) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse' as const,
    permissionDecision: 'deny' as const,
    permissionDecisionReason: reason,
  },
});

const contextWith = (additionalContext: string) => ({ additionalContext });

const REVIEW_BEFORE_PR_TTL_MS = 60 * 60 * 1000;
const CONFORM_BEFORE_REVIEW_TTL_MS = 60 * 60 * 1000;
const HARD_GATE_OVERRIDE = 'CAPE_HARD_GATE_OVERRIDE';
const ORCHESTRATE_OVERRIDE = 'CAPE_ORCHESTRATE';

export const preToolUseBash = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const command = parseCommand(input);
    if (!command) {
      return null;
    }

    const stripped = stripQuotedContent(command);

    for (const entry of denyTable) {
      if (!entry.pattern.test(stripped)) {
        continue;
      }

      if (entry.tier === 'warn') {
        logEvent('hook.PreToolUse.Bash', 'inject');
        return { additionalContext: entry.message };
      }

      logEvent('hook.PreToolUse.Bash', entry.message);
      return denyWith(entry.message);
    }

    // conform-before-review: cape:review must run `cape conform` before it can
    // stamp the reviewedAt completion marker. ponytail: any-scope match, not
    // per-scope — tighten to scope-equality if cross-scope stamping shows up.
    if (/\bcape\s+state\s+set\s+reviewedAt\b/.test(stripped)) {
      if (stripped.includes(HARD_GATE_OVERRIDE)) {
        return contextWith(
          'conform-before-review override accepted: stamping review without a fresh `cape conform` run.',
        );
      }
      const conformed = yield* readStateKey('conformedAt', CONFORM_BEFORE_REVIEW_TTL_MS);
      if (conformed == null) {
        const message =
          'conform-before-review blocked: no fresh `cape conform` run found. Run `cape conform <scope>` and fold its convention findings into the review before stamping reviewedAt. To override explicitly, append CAPE_HARD_GATE_OVERRIDE to the command.';
        logEvent('hook.PreToolUse.Bash', message);
        return denyWith(message);
      }
    }

    if (/\bgit\s+push\b/.test(stripped)) {
      const cwd = parseCwd(input) ?? undefined;
      const { branch, defaultBranch } = yield* resolveBranchInfo(cwd);
      if (branch != null) {
        if (branch === defaultBranch) {
          const message = `Push from \`${branch}\` is blocked. Reason: direct pushes to the default branch bypass review. Run \`cape git create-branch --help\` to start a feature branch first.`;
          logEvent('hook.PreToolUse.Bash', message);
          return denyWith(message);
        }
      }
    }

    return null;
  });

const gatedSkills = new Set(['execute-plan', 'finish-epic', 'pr', 'test-driven-development']);

interface ContextResult {
  additionalContext: string;
}
type GateResult = ReturnType<typeof denyWith> | ContextResult | null;

const gateExecutePlan = () =>
  Effect.gen(function* () {
    const cache = yield* readTrackerCache();
    if (cache === null) {
      return null;
    }
    if (Object.keys(cache.epics).length === 0) {
      return contextWith(
        'No open epic exists. Load cape:brainstorm to explore the problem, then cape:write-plan to create an epic.',
      );
    }
    const flowPhase = yield* readFlowPhaseContext();
    const activeEpic = flowPhase == null ? null : cache.epics[flowPhase.issueId];
    const readyTask = activeEpic?.tasks.find(isReadyTask);
    if (readyTask == null) {
      return contextWith(
        'No ready tasks. All tasks under the open epic are either in-progress or blocked. Task expansion runs inside cape:execute-plan; create a new Linear task with cape:tracker if more work remains.',
      );
    }
    const { branch, defaultBranch } = yield* resolveBranchInfo();
    if (branch != null) {
      if (branch === defaultBranch) {
        return {
          additionalContext: [
            `You are on \`${branch}\` (the default branch).`,
            'Ask the user whether to start or enter the epic worktree before starting work.',
            'Use cape:worktree if they agree.',
          ].join(' '),
        };
      }
    }
    return null;
  });

const gateFinishEpic = (targetEpicId: string | null) =>
  Effect.gen(function* () {
    const cache = yield* readTrackerCache();
    if (cache === null) {
      return null;
    }
    for (const epic of Object.values(cache.epics)) {
      if (targetEpicId != null && epic.id !== targetEpicId) {
        continue;
      }
      const openCount = epic.tasks.filter((task) => !isDoneTask(task)).length;
      if (openCount > 0) {
        return contextWith(
          `Epic ${epic.id} still has ${openCount} open task(s). Close each task through Linear via cape:tracker (or run cape:execute-plan to finish them) before running cape:finish-epic.`,
        );
      }
    }
    return null;
  });

const gateInternalSkill = () =>
  Effect.gen(function* () {
    const state = yield* readState();
    if (!state.workflowActive) {
      return contextWith(
        'This skill is internal to cape:execute-plan / cape:fix-bug and cannot be invoked directly. Load cape:execute-plan or cape:fix-bug to drive it.',
      );
    }
    return null;
  });

const hasReviewBeforePrOverride = (args: string | null) =>
  args?.includes(HARD_GATE_OVERRIDE) ?? false;

const hasOrchestrateOverride = (args: string | null) =>
  args?.includes(ORCHESTRATE_OVERRIDE) ?? false;

const gatePr = (args: string | null) =>
  Effect.gen(function* () {
    const state = yield* readState();
    const reviewedAt = state.reviewedAt;
    const missingOrStale = (() => {
      if (reviewedAt == null || typeof reviewedAt.timestamp !== 'number') {
        return 'missing';
      }
      return Date.now() - reviewedAt.timestamp > REVIEW_BEFORE_PR_TTL_MS ? 'stale' : null;
    })();

    if (missingOrStale == null) {
      return null;
    }

    const reason =
      missingOrStale === 'stale' ? 'the review stamp is stale' : 'no fresh review stamp exists';
    const proceeding = `proceeding without a fresh review stamp (${reason}).`;

    if (hasOrchestrateOverride(args)) {
      return contextWith(`review-before-pr override accepted (orchestrate): ${proceeding}`);
    }

    if (hasReviewBeforePrOverride(args)) {
      return contextWith(`review-before-pr override accepted: ${proceeding}`);
    }

    const denyMessage =
      `review-before-pr blocked: ${reason}. Run cape:review before cape:pr. ` +
      `To override explicitly, invoke cape:pr with ${HARD_GATE_OVERRIDE}.`;
    return denyWith(denyMessage);
  });

const skillGates: Record<
  string,
  (args: string | null) => Effect.Effect<GateResult, never, HookService>
> = {
  'execute-plan': () => gateExecutePlan(),
  'finish-epic': (args) => gateFinishEpic(args),
  pr: (args) => gatePr(args),
  'test-driven-development': () => gateInternalSkill(),
};

export const preToolUseSkill = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const skill = parseSkillInput(input);
    if (!skill) {
      return null;
    }

    const name = skill.name.replace(/^cape:/, '');
    if (!gatedSkills.has(name)) {
      return null;
    }

    const gate = skillGates[name];
    if (gate != null) {
      const result = yield* gate(skill.args);
      if (result != null && 'hookSpecificOutput' in result) {
        logEvent('hook.PreToolUse.Skill', result.hookSpecificOutput.permissionDecisionReason);
      }
      return result;
    }

    return null;
  });
