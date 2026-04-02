import { basename, extname } from 'node:path';

import { Effect, ServiceMap } from 'effect';

import { logEvent } from '../eventLog';
import { isTrivialFile } from './detect';

const testFilePattern =
  /\.(test|spec)\.(ts|tsx|js|jsx)$|_test\.go$|_spec\.lua$|^test_.*\.py$|[\\/]__tests__[\\/]/;

export const isTestFile = (filePath: string): boolean =>
  testFilePattern.test(filePath) || testFilePattern.test(basename(filePath));

const codeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.rs', '.lua']);

export const isCodeFile = (filePath: string): boolean => codeExtensions.has(extname(filePath));

const TDD_STATE_TTL_MS = 10 * 60 * 1000;
const FLOW_PHASE_TTL_MS = 30 * 60 * 1000;


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
    readonly fileExists: (path: string) => Effect.Effect<boolean>;
  }
>()('HookService') {}


export const readFlowPhase = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    const content = yield* service.readFile(`${root}/hooks/context/flow-phase.json`);
    if (content == null) {
      return null;
    }
    try {
      const raw: unknown = JSON.parse(content);
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
      const isStale = Date.now() - raw.timestamp > FLOW_PHASE_TTL_MS;
      return isStale ? null : raw.phase;
    } catch {
      return null;
    }
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

    const flowPhase = yield* readFlowPhase();

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
    if (flowPhase != null) {
      parts.push(`<flow-context>Current phase: ${flowPhase}</flow-context>`);
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

    const flowPhase = yield* readFlowPhase();
    if (flowPhase != null) {
      contexts.push(`<flow-context>Current phase: ${flowPhase}</flow-context>`);
    }

    if (skills.length === 0 && contexts.length === 0) {
      return { decision: 'approve' as const };
    }

    logEvent(
      'hook.UserPromptSubmit',
      skills.length > 0 ? skills.join(', ') : 'flow-context',
    );

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

export const stripQuotedContent = (command: string): string => {
  let stripped = command;
  stripped = stripped.replace(/<<-?\s*['"]?(\w+)['"]?\n[\s\S]*?\n\s*\1\b/g, '<<HEREDOC');
  stripped = stripped.replace(/"[^"]*"/g, '""');
  stripped = stripped.replace(/'[^']*'/g, "''");
  return stripped;
};

type DenyTier = 'redirect' | 'block' | 'warn';

interface DenyEntry {
  readonly pattern: RegExp;
  readonly message: string;
  readonly tier: DenyTier;
}

export const denyTable: readonly DenyEntry[] = [
  {
    pattern: /\bgit\s+commit\b.*--amend\b/,
    message: 'Commit amend is blocked. Create a new commit instead.',
    tier: 'block',
  },
  {
    pattern: /\bgit\s+push\b.*(?:--force\b(?!-)|-f\b)/,
    message: 'Force push is blocked.',
    tier: 'block',
  },
  {
    pattern: /\bgh\s+pr\s+merge\b/,
    message: 'PR merge via CLI is blocked. Merge through the GitHub UI.',
    tier: 'block',
  },
  {
    pattern: /\bgh\s+pr\s+close\b/,
    message: 'PR close via CLI is blocked. Close through the GitHub UI.',
    tier: 'block',
  },
  {
    pattern: /\bgit\s+commit\b/,
    message: 'Use `cape commit` instead of raw `git commit`.',
    tier: 'redirect',
  },
  // Re-enable as each cape command is implemented:
  {
    pattern: /(?<!\bcape\s)\bbr\s+create\b/,
    message: 'Use `cape br create` instead of raw `br create`.',
    tier: 'redirect',
  },
  // { pattern: /(?<!\bcape\s)\bbr\s+q\b/, message: 'Use `cape br q` to query beads.', tier: 'redirect' },
  {
    pattern: /(?<!\bcape\s)\bbr\s+update\b.*--status\b/,
    message: 'Use `cape br update` to change issue status.',
    tier: 'redirect',
  },
  {
    pattern: /(?<!\bcape\s)\bbr\s+close\b/,
    message: 'Use `cape br close` to close an issue.',
    tier: 'redirect',
  },
  { pattern: /(?<!\bcape\s)\bgh\s+pr\s+create\b/, message: 'Use `cape pr create` instead of raw `gh pr create`.', tier: 'redirect' },
  { pattern: /(?<!\bcape\s)\bgit\s+(?:checkout\s+-b|switch\s+(?:-c|--create)\s|branch\s+(?!-)\w)/, message: 'Use `cape git create-branch` to create a branch.', tier: 'redirect' },
  { pattern: /(?<!\bcape\s)\b(?:npx vitest|vitest|bun test|npm test|pytest|go test|cargo test|busted|python -m (?:pytest|unittest))(?:\s|$)/, message: 'Use `cape test` to run tests so TDD state is tracked.', tier: 'redirect' },
  {
    pattern: /\bgit\s+reset\s+--hard\b/,
    message:
      '`git reset --hard` discards uncommitted changes permanently. Consider `git stash` first.',
    tier: 'warn',
  },
  {
    pattern: /\bgit\s+checkout\s+--(?:\s|$)/,
    message: '`git checkout --` discards working tree changes. Consider `git stash` first.',
    tier: 'warn',
  },
  {
    pattern: /\bgit\s+clean\b.*-f\b/,
    message:
      '`git clean -f` permanently removes untracked files. Consider `git clean -n` first.',
    tier: 'warn',
  },
];

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
      if (result != null) {
        logEvent('hook.PreToolUse.Skill', result.hookSpecificOutput.permissionDecisionReason);
      }
      return result;
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

interface WriteInput {
  readonly filePath: string;
  readonly content: string;
}

const parseWriteInput = (input: string): WriteInput | null => {
  try {
    const data = JSON.parse(input);
    const filePath = parseString(data.tool_input?.file_path);
    const content = parseString(data.tool_input?.content);
    if (!filePath || content == null) {
      return null;
    }
    return { filePath, content };
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

    const flowPhase = yield* readFlowPhase();
    if (!flowPhase) {
      return null;
    }

    const isActivePhase = flowPhase === 'executing' || flowPhase === 'debugging';
    if (!isActivePhase) {
      return null;
    }

    const root = service.pluginRoot();
    const state = yield* readTddState(root);

    if (isTestFile(filePath)) {
      if (state?.phase === 'writing-test') {
        logEvent('hook.PostToolUse.Edit', 'tdd-batching');
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

    logEvent('hook.PostToolUse.Edit', 'tdd-reminder');
    return {
      additionalContext: [
        'TDD reminder: you are editing production code without a failing test.',
        'Consider writing or updating a test first, then making it fail, before changing this code.',
      ].join(' '),
    };
  });

const checkTddGate = (
  filePath: string,
  isNewFile: boolean,
  fileContent: string | null,
) =>
  Effect.gen(function* () {
    if (!isCodeFile(filePath)) {
      return null;
    }
    if (isTestFile(filePath)) {
      return null;
    }
    if (isNewFile) {
      return null;
    }
    if (fileContent != null && isTrivialFile(filePath, fileContent)) {
      return null;
    }

    const flowPhase = yield* readFlowPhase();
    if (!flowPhase) {
      return null;
    }
    const isActivePhase = flowPhase === 'executing' || flowPhase === 'debugging';
    if (!isActivePhase) {
      return null;
    }

    const service = yield* HookService;
    const root = service.pluginRoot();
    const state = yield* readTddState(root);

    if (state?.phase === 'red' || state?.phase === 'green') {
      return null;
    }

    const reason =
      state?.phase === 'writing-test'
        ? 'TDD gate: run the test before editing production code. Dispatch cape test-runner first.'
        : 'TDD gate: write a failing test before editing production code. Load cape:test-driven-development.';

    logEvent('hook.PreToolUse.Edit', reason);
    return denyWith(reason);
  });

export const preToolUseEdit = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const filePath = parseFilePath(input);
    if (!filePath) {
      return null;
    }

    const fileContent = yield* service.readFile(filePath);
    return yield* checkTddGate(filePath, false, fileContent);
  });

export const preToolUseWrite = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const writeInput = parseWriteInput(input);
    if (!writeInput) {
      return null;
    }

    const exists = yield* service.fileExists(writeInput.filePath);
    return yield* checkTddGate(writeInput.filePath, !exists, writeInput.content);
  });

export const postToolUseWrite = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const input = yield* service.readStdin();
    const writeInput = parseWriteInput(input);
    if (!writeInput || !isCodeFile(writeInput.filePath)) {
      return null;
    }

    const flowPhase = yield* readFlowPhase();
    if (!flowPhase) {
      return null;
    }
    const isActivePhase = flowPhase === 'executing' || flowPhase === 'debugging';
    if (!isActivePhase) {
      return null;
    }

    const root = service.pluginRoot();
    const state = yield* readTddState(root);

    if (isTestFile(writeInput.filePath)) {
      if (state?.phase === 'writing-test') {
        logEvent('hook.PostToolUse.Write', 'tdd-batching');
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

    logEvent('hook.PostToolUse.Write', 'tdd-reminder');
    return {
      additionalContext: [
        'TDD reminder: you are editing production code without a failing test.',
        'Consider writing or updating a test first, then making it fail, before changing this code.',
      ].join(' '),
    };
  });

