import { resolve } from 'node:path';

import { Effect, ServiceMap } from 'effect';

import { safeParseJson } from '../../utils/json';
import { PrService } from '../pr';
import { TRACKER_CACHE_TTL_MS, isTrackerCache } from '../tracker';
import type { TrackerCache, TrackerEpic, TrackerTask } from '../tracker';
import { detectBugReport, detectExecutePlan, detectTrackerSkill } from './parsing';

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

const trackerPath = (root: string) => `${root}/hooks/context/tracker.json`;

type GitContext =
  | { readonly kind: 'repo'; readonly gitDir: string; readonly isLinkedWorktree: boolean }
  | { readonly kind: 'no-repo' }
  | { readonly kind: 'unavailable' };

// One combined rev-parse answers both questions in a single spawn; the
// resolved comparison is the single source of worktree identity for the
// session banner.
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

// Ignores the cache TTL: use when reading data that does not go stale (epic
// titles), not task status.
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

// Canceled counts as done here: banners ask "is this settled?", not "did it ship?".
// The PR closing line answers the second question and excludes canceled children separately.
const isDoneTask = (task: TrackerTask) => {
  const status = task.status.toLowerCase();
  const stateType = task.stateType.toLowerCase();
  return (
    stateType === 'completed' ||
    stateType === 'canceled' ||
    status === 'done' ||
    status === 'closed' ||
    status === 'completed' ||
    status === 'canceled'
  );
};

const isReadyTask = (task: TrackerTask) => {
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

// Linear can render gitBranchName with a slash (user/abu-15-title) that the
// worktree flow sanitizes to kebab-case, so the cached slug is normalized the
// same way before comparing. The branch keeps its own `/` so the
// conventional-commit prefix boundary stays intact; a raw checkout of the
// slashed slug is covered by kebab-casing the whole branch.
const kebabCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const branchMatchesEpic = (branch: string, epic: TrackerEpic) => {
  const slug = kebabCase(epic.gitBranchName ?? '');
  if (slug === '') {
    return false;
  }
  const current = branch.toLowerCase();
  return kebabCase(current) === slug || current.endsWith(`/${slug}`);
};

// Nothing prunes the tracker cache, so a finished epic stays cached forever;
// skipping it here keeps its branch from rendering an actionable banner.
const isDoneEpic = (epic: TrackerEpic) => {
  const status = epic.status.toLowerCase();
  return status === 'done' || status === 'closed' || status === 'completed';
};

const epicForBranch = (cache: TrackerCache, branch: string) =>
  Object.values(cache.epics).find((epic) => !isDoneEpic(epic) && branchMatchesEpic(branch, epic)) ??
  null;

// gh pr view with no argument falls back to the branch's most recent merged or
// closed PR, so only state OPEN counts. Missing gh or a failed lookup means no
// PR — the banner degrades to the ship phase, never to an error. The short
// timeout keeps a slow network from stalling session start.
const hasOpenPr = () =>
  Effect.gen(function* () {
    const pr = yield* PrService;
    const raw = yield* pr.spawnGh(['pr', 'view', '--json', 'state'], 3000);
    const parsed = safeParseJson(raw);
    return (
      typeof parsed === 'object' &&
      parsed != null &&
      !Array.isArray(parsed) &&
      'state' in parsed &&
      parsed.state === 'OPEN'
    );
  }).pipe(Effect.orElseSucceed(() => false));

const readSessionBanner = () =>
  Effect.gen(function* () {
    const cache = yield* readRawTrackerCache();
    if (cache == null) {
      return null;
    }

    const service = yield* HookService;
    const branch = yield* service.spawnGit(['branch', '--show-current']);
    if (branch == null) {
      return null;
    }
    const epic = epicForBranch(cache, branch);
    if (epic == null) {
      return null;
    }

    // An epic cached before its tasks exist is in planning, not shipping.
    const building = epic.tasks.length === 0 || epic.tasks.some(isReadyTask);
    const phase = building ? 'build' : (yield* hasOpenPr()) ? 'pr' : 'ship';
    const git = yield* gitContext();
    const isWorktree = git.kind === 'repo' && git.isLinkedWorktree;
    const isStale = Date.now() - cache.timestamp > TRACKER_CACHE_TTL_MS;
    const staleAge = isStale ? formatRelativeAge(cache.timestamp) : null;
    return buildSessionBanner(epic, phase, { branch, isWorktree }, staleAge);
  });

export const sessionStart = () =>
  Effect.gen(function* () {
    const service = yield* HookService;
    const root = service.pluginRoot();

    const sessionBanner = yield* readSessionBanner();

    const skillPath = `${root}/skills/don-cape/SKILL.md`;
    const skill = yield* service.readFile(skillPath);

    const parts: string[] = [];
    if (sessionBanner != null) {
      parts.push(sessionBanner);
    }
    if (skill != null) {
      parts.push(
        `The content below is cape's workflow system, from skills/don-cape/SKILL.md:\n\n${skill}`,
      );
    } else {
      parts.push('cape plugin loaded.');
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

    if (detectTrackerSkill(prompt)) {
      skills.push('cape:tracker');
    }
    if (detectBugReport(prompt)) {
      skills.push('cape:fix-bug');
    }
    if (detectExecutePlan(prompt)) {
      skills.push('cape:execute-plan');
    }

    if (skills.length === 0) {
      return { decision: 'approve' as const };
    }

    return {
      decision: 'approve' as const,
      additionalContext: `Use the following skill(s): ${skills.join(' ')}`,
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
