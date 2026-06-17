import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { pluginRoot } from '../pluginRoot';
import { safeParseJson } from '../utils/json';
import type { TrackerCache, TrackerEpic, TrackerTask } from './tracker';
import { TrackerService } from './tracker';

interface LinearState {
  readonly name?: unknown;
  readonly type?: unknown;
}

interface LinearIssue {
  readonly id?: unknown;
  readonly identifier?: unknown;
  readonly title?: unknown;
  readonly state?: LinearState;
  readonly children?: {
    readonly nodes?: readonly LinearIssue[];
  };
}

interface TrackerLiveDependencies {
  readonly now: () => number;
  readonly readCache: () => Effect.Effect<TrackerCache | null, Error>;
  readonly writeCache: (cache: TrackerCache) => Effect.Effect<void, Error>;
  readonly callLinear: (operation: 'getEpic' | 'listReady', issueId: string) => Effect.Effect<unknown, Error>;
}

const trackerCachePath = (root: string) => `${root}/hooks/context/tracker.json`;

const issueId = (issue: LinearIssue) => {
  if (typeof issue.identifier === 'string') {
    return issue.identifier;
  }
  if (typeof issue.id === 'string') {
    return issue.id;
  }
  return null;
};

const issueTitle = (issue: LinearIssue) => (typeof issue.title === 'string' ? issue.title : '');

const issueStatus = (issue: LinearIssue) =>
  typeof issue.state?.name === 'string' ? issue.state.name : '';

const issueStateType = (issue: LinearIssue) =>
  typeof issue.state?.type === 'string' ? issue.state.type : '';

const toTask = (issue: LinearIssue): TrackerTask | null => {
  const id = issueId(issue);
  if (id == null) {
    return null;
  }
  return {
    id,
    title: issueTitle(issue),
    status: issueStatus(issue),
    stateType: issueStateType(issue),
  };
};

const toEpic = (value: unknown): TrackerEpic | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return null;
  }

  const issue = value as LinearIssue;
  const id = issueId(issue);
  if (id == null) {
    return null;
  }

  const nodes = issue.children?.nodes ?? [];
  const tasks = nodes.flatMap((node) => {
    const task = toTask(node);
    return task == null ? [] : [task];
  });

  return {
    id,
    title: issueTitle(issue),
    status: issueStatus(issue),
    tasks,
  };
};

const mergeEpic = (cache: TrackerCache | null, epic: TrackerEpic, timestamp: number): TrackerCache => ({
  version: 1,
  timestamp,
  epics: {
    ...cache?.epics,
    [epic.id]: epic,
  },
});

const unsupportedWrite = () => Effect.fail(new Error('Tracker writes are not implemented yet'));

const isTrackerCache = (value: unknown): value is TrackerCache => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const cache = value as { readonly version?: unknown; readonly timestamp?: unknown; readonly epics?: unknown };
  return cache.version === 1 && typeof cache.timestamp === 'number' && typeof cache.epics === 'object' && cache.epics != null && !Array.isArray(cache.epics);
};

export const makeTrackerServiceLive = (dependencies: TrackerLiveDependencies) =>
  Layer.succeed(TrackerService)({
    createEpic: unsupportedWrite,
    createTasks: unsupportedWrite,
    getEpic: (epicId) =>
      Effect.gen(function* () {
        const raw = yield* dependencies.callLinear('getEpic', epicId);
        const epic = toEpic(raw);
        if (epic == null) {
          return null;
        }

        const cache = yield* dependencies.readCache();
        yield* dependencies.writeCache(mergeEpic(cache, epic, dependencies.now()));
        return epic;
      }),
    listReady: () => Effect.succeed([]),
    updateStatus: unsupportedWrite,
    close: unsupportedWrite,
  });

const readCacheFile = () =>
  Effect.try({
    try: () => {
      const raw = safeParseJson(readFileSync(trackerCachePath(pluginRoot()), 'utf-8'));
      if (!isTrackerCache(raw)) {
        return null;
      }
      return raw;
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to read tracker cache', { cause: error }),
  }).pipe(Effect.orElseSucceed(() => null));

const writeCacheFile = (cache: TrackerCache) =>
  Effect.try({
    try: () => {
      const root = pluginRoot();
      mkdirSync(`${root}/hooks/context`, { recursive: true });
      writeFileSync(trackerCachePath(root), JSON.stringify(cache));
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to write tracker cache', { cause: error }),
  });

const callLinear = () =>
  Effect.fail(new Error('Linear MCP calls must be provided by the interactive session'));

export const TrackerServiceLive = makeTrackerServiceLive({
  now: () => Date.now(),
  readCache: readCacheFile,
  writeCache: writeCacheFile,
  callLinear,
});
