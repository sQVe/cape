import { Effect, ServiceMap } from 'effect';

import { logEvent } from '../../eventLog';
import { safeParseJson } from '../../utils/json';
import { detectBeadsSkill, detectDebugIssue, detectExecutePlan, parseCommand } from './parsing';

export const TDD_STATE_TTL_MS = 10 * 60 * 1000;
export const FLOW_PHASE_TTL_MS = 30 * 60 * 1000;

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

type StateValue = Record<string, unknown> & { timestamp: number };
type StateFile = Record<string, StateValue>;

const statePath = (root: string) => `${root}/hooks/context/state.json`;

export const readState = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    const content = yield* service.readFile(statePath(root));
    if (content == null) {
      return {} as StateFile;
    }
    const raw = safeParseJson(content);
    if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
      return {} as StateFile;
    }
    return Object.fromEntries(Object.entries(raw)) as StateFile;
  });

export const writeStateKey = (key: string, value: Record<string, unknown>) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    const state = yield* readState();
    state[key] = { ...value, timestamp: Date.now() };
    yield* service.ensureDir(`${root}/hooks/context`);
    yield* service.writeFile(statePath(root), JSON.stringify(state));
  });

export const removeStateKey = (key: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    const state = yield* readState();
    if (!(key in state)) {
      return;
    }
    const { [key]: _, ...rest } = state;
    if (Object.keys(rest).length === 0) {
      yield* service.removeFile(statePath(root));
    } else {
      yield* service.writeFile(statePath(root), JSON.stringify(rest));
    }
  });

export const readStateKey = (key: string, ttlMs: number) =>
  Effect.gen(function* () {
    const state = yield* readState();
    const entry = state[key];
    if (entry == null) {
      return null;
    }
    if (typeof entry.timestamp !== 'number') {
      return null;
    }
    const isStale = Date.now() - entry.timestamp > ttlMs;
    return isStale ? null : entry;
  });

export const readFlowPhase = () =>
  Effect.gen(function* () {
    const entry = yield* readStateKey('flowPhase', FLOW_PHASE_TTL_MS);
    if (entry == null || typeof entry.phase !== 'string') {
      return null;
    }
    return entry.phase;
  });

export const readTddState = () =>
  Effect.gen(function* () {
    const entry = yield* readStateKey('tddState', TDD_STATE_TTL_MS);
    if (entry == null || typeof entry.phase !== 'string') {
      return null;
    }
    return { phase: entry.phase, timestamp: entry.timestamp };
  });

export const writeTddState = (phase: string) =>
  Effect.gen(function* () {
    yield* writeStateKey('tddState', { phase });
  });

export const clearLogs = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    yield* service.ensureDir(`${root}/hooks/context`);
    yield* service.writeFile(`${root}/hooks/context/br-show-log.txt`, '');
    yield* removeStateKey('tddState');
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

    const data = safeParseJson(input);
    const prompt =
      typeof data === 'object' &&
      data !== null &&
      !Array.isArray(data) &&
      'prompt' in data &&
      typeof data.prompt === 'string'
        ? data.prompt
        : '';

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
