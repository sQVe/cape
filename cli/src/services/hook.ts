import { basename, extname } from 'node:path';

import { Effect, ServiceMap } from 'effect';

const testFilePattern =
  /\.(test|spec)\.(ts|tsx|js|jsx)$|_test\.go$|_spec\.lua$|^test_.*\.py$|[\\/]__tests__[\\/]/;

export const isTestFile = (filePath: string): boolean =>
  testFilePattern.test(filePath) || testFilePattern.test(basename(filePath));

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.rs', '.lua']);

export const isCodeFile = (filePath: string): boolean => codeExtensions.has(extname(filePath));

const testCommandPattern =
  /(?:^|\s)(?:bun test|npm test|npx vitest|vitest|pytest|go test|cargo test|busted|python -m (?:pytest|unittest))(?:\s|$)/;

export const isTestCommand = (command: string): boolean => testCommandPattern.test(command);

const TDD_STATE_TTL_MS = 10 * 60 * 1000;

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

const errorPatterns = [
  /(?:^|\n)\s*at\s+\S+\s+\(.*:\d+:\d+\)/,
  /(?:^|\n)\s*File ".*", line \d+/,
  /(?:^|\n)(?:panic|fatal|FATAL|PANIC):/,
  /(?:^|\n)\S+Error:/,
  /(?:^|\n)Traceback \(most recent call last\)/,
  /(?:getting|seeing|hitting|got|have)\s+(?:an?\s+)?error/i,
  /(?:this|it)\s+(?:is\s+)?(?:broken|crashing|failing)(?!\s+(?:into|down|up|to)\b)/i,
];

export const detectDebugIssue = (prompt: string) =>
  errorPatterns.some((pattern) => pattern.test(prompt));

const continuePatterns = [
  /^(?:yes,?\s+)?(?:continue|keep going|carry on|next task|proceed|go ahead)\.?$/i,
];

export const detectExecutePlan = (prompt: string) =>
  continuePatterns.some((pattern) => pattern.test(prompt));

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
    readonly spawnGit: (args: readonly string[]) => Effect.Effect<string | null>;
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
    if (detectDebugIssue(prompt)) {
      skills.push('cape:debug-issue');
    }
    if (detectExecutePlan(prompt)) {
      skills.push('cape:execute-plan');
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

export const denyWith = (reason: string) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse' as const,
    permissionDecision: 'deny' as const,
    permissionDecisionReason: reason,
  },
});

const parseString = (value: unknown): string | null => (typeof value === 'string' ? value : null);

const parseCommand = (input: string): string | null => {
  try {
    const data = JSON.parse(input);
    return parseString(data.tool_input?.command);
  } catch {
    return null;
  }
};

interface SkillInput {
  readonly name: string;
  readonly args: string | null;
}

const parseSkillInput = (input: string): SkillInput | null => {
  try {
    const data = JSON.parse(input);
    const name = parseString(data.tool_input?.skill);
    if (!name) {
      return null;
    }
    return { name, args: parseString(data.tool_input?.args) };
  } catch {
    return null;
  }
};

const cmdPrefix = /(?:^|&&|\|\||;)\s*/;

const checkBrCreateFlags = (command: string): string[] => {
  const violations: string[] = [];

  if (/--design\b/.test(command)) {
    violations.push(
      'Use `--description` on `br create`, not `--design`. The `--design` flag only works on `br update`.',
    );
  }
  if (!/--type\b|(?:^|\s)-t(?:\s|$)/.test(command)) {
    violations.push('Add `--type` to `br create` (epic, task, bug, or feature).');
  }
  if (!/--priority\b|(?:^|\s)-p(?:\s|$)/.test(command)) {
    violations.push('Add `--priority` to `br create` (0-4).');
  }
  if (!/--labels\b|(?:^|\s)-l(?:\s|$)/.test(command)) {
    violations.push('Add `--labels` to `br create` for categorization.');
  }

  return violations;
};

const checkBrDescriptionHeaders = (command: string): string[] => {
  if (!/--description\b/.test(command)) {
    return [];
  }

  const typeMatch = command.match(/(?:--type\s+|(?:^|\s)-t\s+)(\w+)/);
  const type = typeMatch?.[1];
  const violations: string[] = [];

  if (type === 'task') {
    if (!/##\s*Goal/i.test(command)) {
      violations.push('Task descriptions need a `## Goal` header.');
    }
    if (!/##\s*Behaviors/i.test(command)) {
      violations.push(
        'Task descriptions need a `## Behaviors` header listing one behavior per TDD cycle.',
      );
    }
    if (!/##\s*Success criteria/i.test(command)) {
      violations.push('Task descriptions need a `## Success criteria` header.');
    }
  } else if (type === 'bug') {
    if (!/##\s*Reproduction steps/i.test(command) && !/##\s*Evidence/i.test(command)) {
      violations.push('Bug descriptions need a `## Reproduction steps` or `## Evidence` header.');
    }
  } else if (type === 'epic') {
    if (!/##\s*Requirements/i.test(command)) {
      violations.push('Epic descriptions need a `## Requirements` header.');
    }
    if (!/##\s*Success criteria/i.test(command)) {
      violations.push('Epic descriptions need a `## Success criteria` header.');
    }
  }

  return violations;
};

const checkBrUpdateStatus = (command: string): string[] => {
  const violations: string[] = [];

  if (/--status\s+in-progress\b/.test(command)) {
    violations.push(
      'Use `--status in_progress` (underscore), not `--status in-progress` (hyphen).',
    );
  }
  if (/--status\s+done\b/.test(command)) {
    violations.push('Use `br close <id>` to complete an issue, not `--status done`.');
  }

  return violations;
};

export const checkBrRules = (command: string): string[] => {
  const isBrCreate = new RegExp(`${cmdPrefix.source}br\\s+create\\b`).test(command);
  const isBrUpdate = new RegExp(`${cmdPrefix.source}br\\s+update\\b`).test(command);

  return [
    ...(isBrCreate ? checkBrCreateFlags(command) : []),
    ...(isBrCreate ? checkBrDescriptionHeaders(command) : []),
    ...(isBrUpdate ? checkBrUpdateStatus(command) : []),
  ];
};

export const checkGitStagingRules = (command: string): string[] => {
  const violations: string[] = [];
  if (/\bgit\s+add\s+\.(?:\s|$|;|&&|\|)/.test(command)) {
    violations.push('Stage specific files instead of `git add .`.');
  }
  if (/\bgit\s+add\s+(?:-A|--all)\b/.test(command)) {
    violations.push('Stage specific files instead of `git add -A`.');
  }
  return violations;
};

export const checkPrBodyRules = (command: string): string[] => {
  if (!/\bgh\s+pr\s+create\b/.test(command)) {
    return [];
  }
  if (!/--body\b/.test(command)) {
    return [];
  }
  if (/\n##\s+(?:Summary|Root cause|Overview|Background|Description)\b/i.test(command)) {
    return [
      'PR description uses invented sections (e.g. ## Summary, ## Root cause). ' +
        'Follow the cape:pr template: use #### Motivation, #### Changes, #### Test plan, ' +
        "or the repo's own .github/pull_request_template.md.",
    ];
  }
  return [];
};

export const checkBrShowRequirement = (command: string) =>
  Effect.gen(function* () {
    if (!/(?:^|&&|\|\||;)\s*br\s+update\b/.test(command) || !/--design\b/.test(command)) {
      return null;
    }

    const idMatch = command.match(/\bbr\s+update\s+(\S+)/);
    if (!idMatch) {
      return null;
    }

    const id = idMatch[1];
    const service = yield* HookService;
    const root = service.pluginRoot();
    const content = yield* service.readFile(`${root}/hooks/context/br-show-log.txt`);

    const recentShows = (content ?? '').trim().split('\n').filter(Boolean);
    if (recentShows.some((line) => line.trim() === id)) {
      return null;
    }

    return `Run \`br show ${id}\` first to read existing content before \`br update --design\`.`;
  });

export const checkPrCreationGuards = (command: string) =>
  Effect.gen(function* () {
    if (!/\bgh\s+pr\s+create\b/.test(command)) {
      return [];
    }

    const violations: string[] = [];
    const service = yield* HookService;

    const branch = yield* service.spawnGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch != null) {
      const defaultRef = yield* service.spawnGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
      const defaultBranch = defaultRef?.replace(/^refs\/remotes\/origin\//, '') ?? 'main';
      if (branch === defaultBranch) {
        violations.push(`Cannot create a PR from \`${branch}\`. Create a feature branch first.`);
      }
    }

    const status = yield* service.spawnGit(['status', '--short']);
    if (status != null && status !== '') {
      violations.push('Uncommitted changes detected. Commit changes before creating a PR.');
    }

    return violations;
  });

export const checkStopReinforcement = (command: string): string | null => {
  if (!/\bbr\s+close\b/.test(command)) {
    return null;
  }
  return [
    'A task was just closed via `br close`.',
    'STOP working immediately. Present a checkpoint summary and wait for user input.',
    'Do not start the next task or make further code changes.',
  ].join(' ');
};

export const preToolUseBash = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const command = parseCommand(input);
    if (!command) {
      return null;
    }

    const violations = [
      ...checkBrRules(command),
      ...checkGitStagingRules(command),
      ...checkPrBodyRules(command),
    ];

    const brShowViolation = yield* checkBrShowRequirement(command);
    if (brShowViolation != null) {
      violations.push(brShowViolation);
    }

    const prViolations = yield* checkPrCreationGuards(command);
    violations.push(...prViolations);

    if (violations.length > 0) {
      return denyWith(violations.join(' '));
    }

    const stopMessage = checkStopReinforcement(command);
    if (stopMessage != null) {
      return { additionalContext: stopMessage };
    }

    return null;
  });

const gatedSkills = new Set([
  'execute-plan',
  'expand-task',
  'finish-epic',
  'fix-bug',
  'test-driven-development',
  'write-plan',
]);

type DenyResult = ReturnType<typeof denyWith> | null;

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

const gateWritePlan = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const contextPath = `${service.pluginRoot()}/hooks/context/brainstorm-summary.txt`;
    const content = yield* service.readFile(contextPath);
    if (!content) {
      return denyWith(
        'No brainstorm artifact found. Run cape:brainstorm first to explore and lock a design.',
      );
    }
    return null;
  });

const gateInternalSkill = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const contextPath = `${service.pluginRoot()}/hooks/context/workflow-active.txt`;
    const content = yield* service.readFile(contextPath);
    if (!content) {
      return denyWith(
        'This skill is internal to execute-plan / fix-bug and cannot be invoked directly.',
      );
    }
    return null;
  });

const skillGates: Record<
  string,
  (args: string | null) => Effect.Effect<DenyResult, never, HookService>
> = {
  'execute-plan': () => gateExecutePlan(),
  'expand-task': () => gateInternalSkill(),
  'finish-epic': (args) => gateFinishEpic(args),
  'fix-bug': () => gateFixBug(),
  'test-driven-development': () => gateInternalSkill(),
  'write-plan': () => gateWritePlan(),
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
      return yield* gate(skill.args);
    }

    return null;
  });

const parseFilePath = (input: string): string | null => {
  try {
    const data = JSON.parse(input);
    return parseString(data.tool_input?.file_path);
  } catch {
    return null;
  }
};

export const postToolUseBash = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const command = parseCommand(input);
    if (!command) {
      return null;
    }

    const root = service.pluginRoot();
    const contextPath = `${root}/hooks/context`;

    const showMatch = command.match(/\bbr\s+show\s+(\S+)/);
    if (showMatch) {
      yield* service.ensureDir(contextPath);
      const existing = yield* service.readFile(`${contextPath}/br-show-log.txt`);
      yield* service.writeFile(
        `${contextPath}/br-show-log.txt`,
        `${existing ?? ''}${showMatch[1]}\n`,
      );
    }

    if (isTestCommand(command)) {
      yield* service.ensureDir(contextPath);
      yield* service.writeFile(
        `${contextPath}/tdd-state.json`,
        JSON.stringify({ phase: 'green', timestamp: Date.now() }),
      );
    }

    return null;
  });

const readTddState = (root: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const stateContent = yield* service.readFile(`${root}/hooks/context/tdd-state.json`);
    if (stateContent == null) {
      return null;
    }
    try {
      const raw: unknown = JSON.parse(stateContent);
      if (
        typeof raw !== 'object' ||
        raw == null ||
        !('phase' in raw) ||
        typeof raw.phase !== 'string' ||
        !('timestamp' in raw) ||
        typeof raw.timestamp !== 'number'
      ) {
        return null;
      }
      const state = { phase: raw.phase, timestamp: raw.timestamp };
      const isStale = Date.now() - state.timestamp > TDD_STATE_TTL_MS;
      return isStale ? null : state;
    } catch {
      return null;
    }
  });

const writeTddState = (root: string, phase: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const contextPath = `${root}/hooks/context`;
    yield* service.ensureDir(contextPath);
    yield* service.writeFile(
      `${contextPath}/tdd-state.json`,
      JSON.stringify({ phase, timestamp: Date.now() }),
    );
  });

export const postToolUseEdit = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const filePath = parseFilePath(input);
    if (!filePath || !isCodeFile(filePath)) {
      return null;
    }

    const flowState = yield* queryFlowState();
    const flowContext = deriveFlowContext(flowState);
    if (!flowContext) {
      return null;
    }

    const isActivePhase = flowContext.includes('executing') || flowContext.includes('debugging');
    if (!isActivePhase) {
      return null;
    }

    const root = service.pluginRoot();
    const state = yield* readTddState(root);

    if (isTestFile(filePath)) {
      if (state?.phase === 'writing-test') {
        return {
          additionalContext: [
            'TDD batching warning: you are writing another test before running the previous one.',
            'Dispatch cape:test-runner now. One test at a time — write it, run it, then proceed.',
          ].join(' '),
        };
      }
      yield* writeTddState(root, 'writing-test');
      return null;
    }

    if (state?.phase === 'red') {
      return null;
    }

    return {
      additionalContext: [
        'TDD reminder: you are editing production code without a failing test.',
        'Consider writing or updating a test first, then making it fail, before changing this code.',
      ].join(' '),
    };
  });

export const postToolUseFailureBash = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const command = parseCommand(input);
    if (!command || !isTestCommand(command)) {
      return null;
    }

    const root = service.pluginRoot();
    const contextPath = `${root}/hooks/context`;
    yield* service.ensureDir(contextPath);
    yield* service.writeFile(
      `${contextPath}/tdd-state.json`,
      JSON.stringify({ phase: 'red', timestamp: Date.now() }),
    );

    return null;
  });
