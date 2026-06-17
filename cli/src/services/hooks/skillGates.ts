import { Effect } from 'effect';

import { logEvent } from '../../eventLog';
import { denyTable } from './denyTable';
import { parseCommand, parseSkillInput, stripQuotedContent } from './parsing';
import {
  HookService,
  isDoneTask,
  isReadyTask,
  readFlowPhaseContext,
  readState,
  readTrackerCache,
} from './state';

export { denyTable } from './denyTable';

export const denyWith = (reason: string) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse' as const,
    permissionDecision: 'deny' as const,
    permissionDecisionReason: reason,
  },
});

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

    if (/\bgit\s+push\b/.test(stripped)) {
      const branch = yield* service.spawnGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      if (branch != null) {
        const defaultRef = yield* service.spawnGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
        const defaultBranch = defaultRef?.replace(/^refs\/remotes\/origin\//, '') ?? 'main';
        if (branch === defaultBranch) {
          const message = `Push from \`${branch}\` is blocked. Reason: direct pushes to the default branch bypass review. Run \`cape git create-branch --help\` to start a feature branch first.`;
          logEvent('hook.PreToolUse.Bash', message);
          return denyWith(message);
        }
      }
    }

    return null;
  });

const gatedSkills = new Set([
  'execute-plan',
  'finish-epic',
  'fix-bug',
  'test-driven-development',
]);

interface ContextResult {
  additionalContext: string;
}
type GateResult = ReturnType<typeof denyWith> | ContextResult | null;

const gateExecutePlan = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const cache = yield* readTrackerCache();
    if (cache === null) {
      return null;
    }
    if (Object.keys(cache.epics).length === 0) {
      return denyWith(
        'No open epic exists. Load cape:brainstorm to explore the problem, then cape:write-plan to create an epic.',
      );
    }
    const flowPhase = yield* readFlowPhaseContext();
    const activeEpic = flowPhase == null ? null : cache.epics[flowPhase.issueId];
    const readyTask = activeEpic?.tasks.find(isReadyTask);
    if (readyTask == null) {
      return denyWith(
        'No ready tasks. All tasks under the open epic are either in-progress or blocked. Task expansion runs inside cape:execute-plan; create a new Linear task with cape:tracker if more work remains.',
      );
    }
    const branch = yield* service.spawnGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch != null) {
      const defaultRef = yield* service.spawnGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const defaultBranch = defaultRef?.replace(/^refs\/remotes\/origin\//, '') ?? 'main';
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
        return denyWith(
          `Epic ${epic.id} still has ${openCount} open task(s). Close each task through Linear via cape:tracker (or run cape:execute-plan to finish them) before running cape:finish-epic.`,
        );
      }
    }
    return null;
  });

const gateFixBug = () =>
  Effect.succeed({
    additionalContext:
      'No diagnosed bug exists. Run the fix-bug diagnosis gate first, then create a Linear bug with cape:tracker.',
  });

const gateInternalSkill = () =>
  Effect.gen(function* () {
    const state = yield* readState();
    if (!state.workflowActive) {
      return denyWith(
        'This skill is internal to cape:execute-plan / cape:fix-bug and cannot be invoked directly. Load cape:execute-plan or cape:fix-bug to drive it.',
      );
    }
    return null;
  });

const skillGates: Record<
  string,
  (args: string | null) => Effect.Effect<GateResult, never, HookService>
> = {
  'execute-plan': () => gateExecutePlan(),
  'finish-epic': (args) => gateFinishEpic(args),
  'fix-bug': () => gateFixBug(),
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
