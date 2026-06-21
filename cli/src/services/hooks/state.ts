import { Effect, ServiceMap } from 'effect';

import { logEvent } from '../../eventLog';
import { safeParseJson } from '../../utils/json';
import { TRACKER_CACHE_TTL_MS } from '../tracker';
import type { TrackerCache, TrackerEpic, TrackerTask } from '../tracker';
import { detectBugReport, detectExecutePlan, detectTrackerSkill } from './parsing';

export const FLOW_PHASE_TTL_MS = 30 * 60 * 1000;

// HookService methods declare E=never intentionally: hooks must degrade
// gracefully so a broken hook never crashes the CLI. hookLive.ts absorbs all
// failures via Effect.orElseSucceed(fallback) — the one documented exception
// to the "propagate errors through E" Live pattern.
export class HookService extends ServiceMap.Service<
  HookService,
  {
    readonly pluginRoot: () => string;
    readonly readFile: (path: string) => Effect.Effect<string | null>;
    readonly writeFile: (path: string, content: string) => Effect.Effect<void>;
    readonly removeFile: (path: string) => Effect.Effect<void>;
    readonly ensureDir: (path: string) => Effect.Effect<void>;
    readonly readStdin: () => Effect.Effect<string>;
    readonly spawnGit: (args: readonly string[]) => Effect.Effect<string | null>;
    readonly fileExists: (path: string) => Effect.Effect<boolean>;
  }
>()('HookService') {}

type StateValue = Record<string, unknown> & { timestamp: number };
type StateFile = Record<string, StateValue>;

const statePath = (root: string) => `${root}/hooks/context/state.json`;
const trackerPath = (root: string) => `${root}/hooks/context/tracker.json`;

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

export const readFlowPhaseContext = () =>
  Effect.gen(function* () {
    const entry = yield* readStateKey('flowPhase', FLOW_PHASE_TTL_MS);
    if (entry == null || typeof entry.phase !== 'string' || typeof entry.issueId !== 'string') {
      return null;
    }
    return { phase: entry.phase, issueId: entry.issueId };
  });

const isTrackerTask = (value: unknown): value is TrackerTask => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }
  const task = value as {
    readonly id?: unknown;
    readonly title?: unknown;
    readonly status?: unknown;
    readonly stateType?: unknown;
  };
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    typeof task.status === 'string' &&
    typeof task.stateType === 'string'
  );
};

const isTrackerEpic = (value: unknown): value is TrackerEpic => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }
  const epic = value as {
    readonly id?: unknown;
    readonly title?: unknown;
    readonly status?: unknown;
    readonly tasks?: unknown;
  };
  return (
    typeof epic.id === 'string' &&
    typeof epic.title === 'string' &&
    typeof epic.status === 'string' &&
    Array.isArray(epic.tasks) &&
    epic.tasks.every(isTrackerTask)
  );
};

const isTrackerCache = (value: unknown): value is TrackerCache => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const cache = value as {
    readonly version?: unknown;
    readonly timestamp?: unknown;
    readonly epics?: unknown;
  };
  if (cache.version !== 1 || typeof cache.timestamp !== 'number') {
    return false;
  }
  if (typeof cache.epics !== 'object' || cache.epics == null || Array.isArray(cache.epics)) {
    return false;
  }

  return Object.values(cache.epics).every(isTrackerEpic);
};

export const readTrackerCache = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    const content = yield* service.readFile(trackerPath(root));
    if (content == null) {
      return null;
    }

    const parsed = safeParseJson(content);
    if (!isTrackerCache(parsed)) {
      return null;
    }

    const isStale = Date.now() - parsed.timestamp > TRACKER_CACHE_TTL_MS;
    return isStale ? null : parsed;
  });

export const isDoneTask = (task: TrackerTask) => {
  const status = task.status.toLowerCase();
  const stateType = task.stateType.toLowerCase();
  return (
    stateType === 'completed' || status === 'done' || status === 'closed' || status === 'completed'
  );
};

export const isReadyTask = (task: TrackerTask) => {
  const status = task.status.toLowerCase();
  const stateType = task.stateType.toLowerCase();
  return (
    stateType === 'unstarted' ||
    stateType === 'backlog' ||
    status === 'ready' ||
    status === 'todo' ||
    status === 'open'
  );
};

const buildSessionBanner = (epic: TrackerEpic, phase: string, branch: string | null) => {
  const done = epic.tasks.filter(isDoneTask).length;
  const next = epic.tasks.find(isReadyTask);
  const nextText = next == null ? 'None' : `${next.id} - ${next.title}`;
  const branchText = branch ?? 'unknown';

  return [
    'Render this cape session banner verbatim as your first message, before any other text:',
    '',
    '+-- cape -----------------------------------+',
    `| Epic   ${epic.id}  ${epic.title}`,
    `| Phase  ${phase}  (${done}/${epic.tasks.length} tasks done)`,
    `| Next   ${nextText}`,
    `| Branch ${branchText} (worktree)`,
    '+-- Say "Continue." to start ---------------+',
  ].join('\n');
};

const readSessionBanner = () =>
  Effect.gen(function* () {
    const flowPhase = yield* readFlowPhaseContext();
    if (flowPhase == null) {
      return null;
    }

    const cache = yield* readTrackerCache();
    const epic = cache?.epics[flowPhase.issueId];
    if (epic == null) {
      return null;
    }

    const service = yield* HookService;
    const branch = yield* service.spawnGit(['branch', '--show-current']);
    return buildSessionBanner(epic, flowPhase.phase, branch);
  });

export const clearLogs = () => Effect.succeed(undefined);

export const sessionStart = (clearLogsFlag: boolean) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();

    if (clearLogsFlag) {
      yield* clearLogs();
    }

    // One-time migration: prune legacy tddState key from user state files.
    yield* removeStateKey('tddState');

    const flowPhase = yield* readFlowPhase();
    const sessionBanner = yield* readSessionBanner();

    const skillPath = `${root}/skills/don-cape/SKILL.md`;
    const skill = yield* service.readFile(skillPath);

    const parts: string[] = [];
    if (sessionBanner != null) {
      parts.push(sessionBanner);
    }
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

    if (detectTrackerSkill(prompt)) {
      skills.push('cape:tracker');
    }
    if (detectBugReport(prompt)) {
      skills.push('cape:fix-bug');
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

    logEvent('hook.UserPromptSubmit', skills.length > 0 ? skills.join(', ') : 'flow-context');

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

export const postToolUseBash = () => Effect.succeed(null);
