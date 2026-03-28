import { Effect, ServiceMap } from 'effect';

interface FlowState {
  readonly bugs: string | null;
  readonly inProgressTasks: string | null;
  readonly epics: string | null;
}

export const deriveFlowContext = (state: FlowState) => {
  const brAvailable = state.bugs !== null || state.inProgressTasks !== null || state.epics !== null;
  if (!brAvailable) {
    return null;
  }

  let phase: string;
  if (state.bugs) {
    phase = 'debugging';
  } else if (state.inProgressTasks) {
    phase = 'executing';
  } else if (state.epics) {
    phase = 'planning';
  } else {
    phase = 'idle';
  }
  return `<flow-context>Current phase: ${phase}</flow-context>`;
};

const beadsPatterns = [
  /\bbr\b/i,
  /\bbeads?\b/i,
  /\.beads/i,
  /issue.*(track|create|log)/i,
  /track.*(bug|issue|finding|gap|these|them)/i,
  /what.*(task|work).*next/i,
  /batch.*(create|issue)/i,
  /--design.*create/i,
  /--description.*--design/i,
  /\bgaps?\b.*\btrack/i,
];

const managingPattern = /(?:split|merge|archiv).*\bbr-/i;

export const detectBeadsSkill = (prompt: string) => {
  if (managingPattern.test(prompt)) {
    return false;
  }
  return beadsPatterns.some((pattern) => pattern.test(prompt));
};

export const normalizeEventName = (name: string) => {
  if (name.includes('-')) {
    return name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');
  }
  return name;
};

export class HookService extends ServiceMap.Service<
  HookService,
  {
    readonly pluginRoot: () => string;
    readonly readFile: (path: string) => Effect.Effect<string | null>;
    readonly writeFile: (path: string, content: string) => Effect.Effect<void>;
    readonly removeFile: (path: string) => Effect.Effect<void>;
    readonly ensureDir: (path: string) => Effect.Effect<void>;
    readonly brQuery: (args: readonly string[]) => Effect.Effect<string | null>;
    readonly readStdin: () => Effect.Effect<string>;
  }
>()('HookService') {}

export const queryFlowState = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const [bugs, inProgressTasks, epics] = yield* Effect.all([
      service.brQuery(['list', '--type', 'bug', '--status', 'open']),
      service.brQuery(['list', '--status', 'in_progress', '--type', 'task']),
      service.brQuery(['list', '--type', 'epic', '--status', 'open']),
    ]);
    return { bugs, inProgressTasks, epics };
  });

export const clearLogs = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    yield* service.ensureDir(`${root}/hooks/context`);
    yield* service.writeFile(`${root}/hooks/context/br-show-log.txt`, '');
    yield* service.removeFile(`${root}/hooks/context/tdd-state.json`);
  });

export const sessionStart = (clearLogsFlag: boolean) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();

    if (clearLogsFlag) {
      yield* clearLogs();
    }

    const flowState = yield* queryFlowState();
    const flowContext = deriveFlowContext(flowState);

    const skillPath = `${root}/skills/don-cape/SKILL.md`;
    const skill = yield* service.readFile(skillPath);

    const parts: string[] = [];
    if (skill != null) {
      parts.push(
        `The content below is from skills/don-cape/SKILL.md — cape's workflow system:\n\n${skill}`,
      );
    } else {
      parts.push('cape plugin loaded.');
    }
    if (flowContext != null) {
      parts.push(flowContext);
    }

    return { additionalContext: parts.join('\n\n') };
  });

export const userPromptSubmit = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();

    let prompt = '';
    try {
      const data = JSON.parse(input);
      prompt = data.prompt ?? '';
    } catch {
      return { decision: 'approve' as const };
    }

    if (!prompt) {
      return { decision: 'approve' as const };
    }

    const skills: string[] = [];
    const contexts: string[] = [];

    if (detectBeadsSkill(prompt)) {
      skills.push('cape:beads');
    }

    const flowState = yield* queryFlowState();
    const flowContext = deriveFlowContext(flowState);
    if (flowContext != null) {
      contexts.push(flowContext);
    }

    if (skills.length === 0 && contexts.length === 0) {
      return { decision: 'approve' as const };
    }

    const parts: string[] = [];
    if (skills.length > 0) {
      parts.push(`Use the following skill(s): ${skills.join(' ')}`);
    }
    parts.push(...contexts);

    return {
      decision: 'approve' as const,
      additionalContext: parts.join('\n\n'),
    };
  });
