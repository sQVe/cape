import { createHash } from 'node:crypto';
import { basename, resolve } from 'node:path';

import { Effect, ServiceMap } from 'effect';

import { logEvent } from '../../eventLog';
import { safeParseJson } from '../../utils/json';
import { TRACKER_CACHE_TTL_MS, isTrackerCache } from '../tracker';
import type { TrackerEpic, TrackerTask } from '../tracker';
import { detectBugReport, detectExecutePlan, detectTrackerSkill } from './parsing';

export const FLOW_PHASE_TTL_MS = 30 * 60 * 1000;

// Distinguishes "git ran and said no" from "git never answered": exit-nonzero
// means not-a-repo, unavailable means timeout/missing binary. Conflating the
// two made transient git failures write state to the wrong file.
export type GitSpawnResult =
  | { readonly kind: 'ok'; readonly stdout: string }
  | { readonly kind: 'exit-nonzero' }
  | { readonly kind: 'unavailable' };

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
    readonly spawnGit: (args: readonly string[], cwd?: string) => Effect.Effect<string | null>;
    readonly spawnGitChecked: (
      args: readonly string[],
      cwd?: string,
    ) => Effect.Effect<GitSpawnResult>;
    readonly fileExists: (path: string) => Effect.Effect<boolean>;
  }
>()('HookService') {}

export const resolveBranchInfo = (cwd?: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const branch = yield* service.spawnGit(['rev-parse', '--abbrev-ref', 'HEAD'], cwd);
    const defaultRef = yield* service.spawnGit(['symbolic-ref', 'refs/remotes/origin/HEAD'], cwd);
    const defaultBranch = defaultRef?.replace(/^refs\/remotes\/origin\//, '') ?? 'main';
    return { branch, defaultBranch };
  });

type StateValue = Record<string, unknown> & { timestamp: number };
type StateFile = Record<string, StateValue>;

const trackerPath = (root: string) => `${root}/hooks/context/tracker.json`;

type GitContext =
  | { readonly kind: 'repo'; readonly gitDir: string; readonly isLinkedWorktree: boolean }
  | { readonly kind: 'no-repo' }
  | { readonly kind: 'unavailable' };

// One combined rev-parse answers both questions in a single spawn; the
// resolved comparison is the single source of worktree identity for both the
// state path and the session banner.
const gitContext = (): Effect.Effect<GitContext, never, HookService> =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const result = yield* service.spawnGitChecked(['rev-parse', '--git-dir', '--git-common-dir']);
    if (result.kind === 'unavailable') {
      return { kind: 'unavailable' as const };
    }
    if (result.kind === 'exit-nonzero') {
      return { kind: 'no-repo' as const };
    }
    const [gitDirRaw, commonDirRaw] = result.stdout.split('\n').map((line) => line.trim());
    if (gitDirRaw == null || gitDirRaw === '' || commonDirRaw == null || commonDirRaw === '') {
      return { kind: 'no-repo' as const };
    }
    const gitDir = resolve(gitDirRaw);
    return { kind: 'repo' as const, gitDir, isLinkedWorktree: gitDir !== resolve(commonDirRaw) };
  });

// The resolved git-dir is unique per repo AND per worktree (main tree:
// <repo>/.git; linked: <common>/worktrees/<name>), so one hash isolates both.
export const stateFileName = (gitDir: string) =>
  `state-${createHash('sha256').update(resolve(gitDir)).digest('hex')}.json`;

// Invariant: git state is isolated by hashing the resolved git-dir under the
// shared plugin root; non-git callers use state-no-repo.json (never the legacy
// state.json, so pre-namespacing leftovers are inert); a git error yields null
// and callers skip state IO rather than touch the wrong file.
export const stateFilePath = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const contextDir = `${service.pluginRoot()}/hooks/context`;
    const git = yield* gitContext();
    if (git.kind === 'unavailable') {
      return null;
    }
    if (git.kind === 'no-repo') {
      return { dir: contextDir, path: `${contextDir}/state-no-repo.json` };
    }
    return { dir: contextDir, path: `${contextDir}/${stateFileName(git.gitDir)}` };
  });

// Everything `cape state reset` should remove: the current scheme's file plus
// the pre-namespacing files (state.json, state-<worktree-name>.json) that
// nothing reads anymore but that would otherwise be stranded forever.
export const stateResetPaths = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const contextDir = `${service.pluginRoot()}/hooks/context`;
    const git = yield* gitContext();
    if (git.kind === 'unavailable') {
      return [] as string[];
    }
    if (git.kind === 'no-repo') {
      return [`${contextDir}/state-no-repo.json`, `${contextDir}/state.json`];
    }
    const paths = [`${contextDir}/${stateFileName(git.gitDir)}`, `${contextDir}/state.json`];
    if (git.isLinkedWorktree) {
      const legacyName = basename(git.gitDir).replace(/[^A-Za-z0-9._-]/g, '-');
      paths.push(`${contextDir}/state-${legacyName}.json`);
    }
    return paths;
  });

const readStateAt = (path: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const content = yield* service.readFile(path);
    if (content == null) {
      return {} as StateFile;
    }
    const raw = safeParseJson(content);
    if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
      return {} as StateFile;
    }
    return Object.fromEntries(Object.entries(raw)) as StateFile;
  });

export const readState = () =>
  Effect.gen(function* () {
    const file = yield* stateFilePath();
    if (file == null) {
      return {} as StateFile;
    }
    return yield* readStateAt(file.path);
  });

export const writeStateKey = (key: string, value: Record<string, unknown>) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const file = yield* stateFilePath();
    if (file == null) {
      return;
    }
    const { dir, path } = file;
    const state = yield* readStateAt(path);
    state[key] = { ...value, timestamp: Date.now() };
    yield* service.ensureDir(dir);
    yield* service.writeFile(path, JSON.stringify(state));
  });

export const removeStateKey = (key: string) =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const file = yield* stateFilePath();
    if (file == null) {
      return;
    }
    const { path } = file;
    const state = yield* readStateAt(path);
    if (!(key in state)) {
      return;
    }
    const { [key]: _, ...rest } = state;
    if (Object.keys(rest).length === 0) {
      yield* service.removeFile(path);
    } else {
      yield* service.writeFile(path, JSON.stringify(rest));
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

const readRawTrackerCache = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();
    const content = yield* service.readFile(trackerPath(root));
    if (content == null) {
      return null;
    }

    const parsed = safeParseJson(content);
    return isTrackerCache(parsed) ? parsed : null;
  });

export const readTrackerCache = () =>
  Effect.gen(function* () {
    const cache = yield* readRawTrackerCache();
    if (cache == null) {
      return null;
    }
    const isStale = Date.now() - cache.timestamp > TRACKER_CACHE_TTL_MS;
    return isStale ? null : cache;
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

const formatRelativeAge = (timestamp: number) => {
  const ageMs = Math.max(0, Date.now() - timestamp);
  const ageMinutes = Math.max(1, Math.floor(ageMs / (60 * 1000)));
  if (ageMinutes < 60) {
    return `${ageMinutes}m ago`;
  }
  return `${Math.floor(ageMinutes / 60)}h ago`;
};

const buildSessionBanner = (
  epic: TrackerEpic,
  phase: string,
  git: { readonly branch: string | null; readonly isWorktree: boolean },
  staleAge: string | null,
) => {
  const done = epic.tasks.filter(isDoneTask).length;
  const next = epic.tasks.find(isReadyTask);
  const nextText = next == null ? 'None' : `${next.id} - ${next.title}`;
  const branchText = `${git.branch ?? 'unknown'}${git.isWorktree ? ' (worktree)' : ''}`;
  const staleLine = staleAge == null ? [] : [`| Cache stale, updated ${staleAge}`];

  return [
    'Render this cape session banner verbatim as your first message, before any other text:',
    '',
    '+-- cape -----------------------------------+',
    `| Epic   ${epic.id}  ${epic.title}`,
    `| Phase  ${phase}  (${done}/${epic.tasks.length} tasks done)`,
    `| Next   ${nextText}`,
    `| Branch ${branchText}`,
    ...staleLine,
    '+-- Say "Continue." to start ---------------+',
  ].join('\n');
};

const readSessionBanner = () =>
  Effect.gen(function* () {
    const flowPhase = yield* readFlowPhaseContext();
    if (flowPhase == null) {
      return null;
    }

    const cache = yield* readRawTrackerCache();
    if (cache == null) {
      return null;
    }
    const epic = cache.epics[flowPhase.issueId];
    if (epic == null) {
      return null;
    }

    const service = yield* HookService;
    const branch = yield* service.spawnGit(['branch', '--show-current']);
    const git = yield* gitContext();
    const isWorktree = git.kind === 'repo' && git.isLinkedWorktree;
    const isStale = Date.now() - cache.timestamp > TRACKER_CACHE_TTL_MS;
    const staleAge = isStale ? formatRelativeAge(cache.timestamp) : null;
    return buildSessionBanner(epic, flowPhase.phase, { branch, isWorktree }, staleAge);
  });

export const sessionStart = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();

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

export const postToolUseLinearWrite = () =>
  Effect.succeed({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        'Linear was updated. Refresh the local tracker cache soon with `cape tracker cache-epic`, `cape tracker cache-tasks`, or `cape tracker cache-status`.',
    },
  });
