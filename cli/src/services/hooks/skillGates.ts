import { Effect } from 'effect';

import { logEvent } from '../../eventLog';
import { denyTable } from './denyTable';
import { parseCommand, parseSkillInput, stripQuotedContent } from './parsing';
import { HookService, readState } from './state';

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
          const message = `Cannot push from \`${branch}\`. Create a feature branch first.`;
          logEvent('hook.PreToolUse.Bash', message);
          return denyWith(message);
        }
      }
    }

    return null;
  });

const gatedSkills = new Set([
  'execute-plan',
  'expand-task',
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
    const epics = yield* service.brQuery(['list', '--type', 'epic', '--status', 'open']);
    if (epics === null) {
      return null;
    }
    if (!epics) {
      return denyWith(
        'No open epic exists. Load cape:brainstorm to explore the problem, then cape:write-plan to create an epic.',
      );
    }
    const ready = yield* service.brQuery(['ready']);
    if (ready === null) {
      return null;
    }
    if (!ready) {
      return denyWith(
        'No ready tasks. All tasks under the open epic are either in-progress or blocked. Use cape:expand-task or create a new task with cape:beads.',
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
            'Ask the user whether to create a feature branch before starting work.',
            'Use cape:branch to create one if they agree.',
          ].join(' '),
        };
      }
    }
    return null;
  });

const parseEpicStatusEntry = (raw: unknown): { epicId: string | null; openCount: number } => {
  if (typeof raw !== 'object' || raw == null) {
    return { epicId: null, openCount: 0 };
  }
  const total =
    'total_children' in raw && typeof raw.total_children === 'number' ? raw.total_children : 0;
  const closed =
    'closed_children' in raw && typeof raw.closed_children === 'number' ? raw.closed_children : 0;
  let epicId: string | null = null;
  if ('epic' in raw && typeof raw.epic === 'object' && raw.epic != null && 'id' in raw.epic) {
    epicId = String(raw.epic.id);
  }
  return { epicId, openCount: total - closed };
};

const gateFinishEpic = (targetEpicId: string | null) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const output = yield* service.brQuery(['epic', 'status', '--json']);
    if (output === null) {
      return null;
    }
    try {
      const epics: unknown = JSON.parse(output);
      if (!Array.isArray(epics)) {
        return null;
      }
      for (const raw of epics) {
        const { epicId, openCount } = parseEpicStatusEntry(raw);
        if (targetEpicId != null && epicId !== targetEpicId) {
          continue;
        }
        if (openCount > 0 && epicId != null) {
          return denyWith(
            `Epic ${epicId} still has ${openCount} open task(s). Close all tasks before running cape:finish-epic.`,
          );
        }
      }
    } catch {
      return null;
    }
    return null;
  });

const gateFixBug = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const bugs = yield* service.brQuery(['list', '--type', 'bug', '--status', 'open']);
    if (bugs === null) {
      return null;
    }
    if (!bugs) {
      return denyWith(
        'No open bug exists. Load cape:debug-issue to investigate the problem first, then create a bug with cape:beads.',
      );
    }
    return null;
  });

const gateInternalSkill = () =>
  Effect.gen(function* () {
    const state = yield* readState();
    if (!state.workflowActive) {
      return denyWith(
        'This skill is internal to execute-plan / fix-bug and cannot be invoked directly.',
      );
    }
    return null;
  });

const skillGates: Record<
  string,
  (args: string | null) => Effect.Effect<GateResult, never, HookService>
> = {
  'execute-plan': () => gateExecutePlan(),
  'expand-task': () => gateInternalSkill(),
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
