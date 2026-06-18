import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { Effect } from 'effect';

import { pluginRoot } from '../pluginRoot';
import { safeParseJson } from '../utils/json';
import type { TrackerCache, TrackerEpic, TrackerTask } from './tracker';

interface LinearState {
  readonly name?: unknown;
  readonly type?: unknown;
}

interface LinearIssue {
  readonly id?: unknown;
  readonly identifier?: unknown;
  readonly title?: unknown;
  readonly project?: unknown;
  readonly labels?: readonly ({ readonly name?: unknown } | string)[];
  readonly state?: LinearState;
  readonly children?: {
    readonly nodes?: readonly LinearIssue[];
  };
}

const trackerCachePath = (root: string) => `${root}/hooks/context/tracker.json`;

const linearIssueId = (issue: LinearIssue) => {
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

const issueProject = (issue: LinearIssue) => {
  if (typeof issue.project === 'string') {
    return issue.project;
  }
  if (
    typeof issue.project === 'object' &&
    issue.project != null &&
    !Array.isArray(issue.project) &&
    'name' in issue.project &&
    typeof issue.project.name === 'string'
  ) {
    return issue.project.name;
  }
  return undefined;
};

const labelName = (label: { readonly name?: unknown } | string) => {
  if (typeof label === 'string') {
    return label;
  }
  return typeof label.name === 'string' ? label.name : null;
};

const issueType = (issue: LinearIssue) => {
  const label = issue.labels?.map(labelName).find((name) => name?.startsWith('type:') === true);
  const type = label?.slice('type:'.length);
  return type == null || type.length === 0 ? undefined : type;
};

const toTask = (issue: LinearIssue): TrackerTask | null => {
  const id = linearIssueId(issue);
  if (id == null) {
    return null;
  }
  const project = issueProject(issue);
  const type = issueType(issue);
  return {
    id,
    title: issueTitle(issue),
    ...(project == null ? {} : { project }),
    ...(type == null ? {} : { type }),
    status: issueStatus(issue),
    stateType: issueStateType(issue),
  };
};

export const toEpic = (value: unknown): TrackerEpic | null => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return null;
  }

  const issue = value as LinearIssue;
  const id = linearIssueId(issue);
  if (id == null) {
    return null;
  }

  const nodes = issue.children?.nodes ?? [];
  const tasks = nodes.flatMap((node) => {
    const task = toTask(node);
    return task == null ? [] : [task];
  });
  const project = issueProject(issue);
  const type = issueType(issue);

  return {
    id,
    title: issueTitle(issue),
    ...(project == null ? {} : { project }),
    ...(type == null ? {} : { type }),
    status: issueStatus(issue),
    tasks,
  };
};

export const toTasks = (value: unknown): readonly TrackerTask[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((issue: unknown) => {
    if (typeof issue !== 'object' || issue == null || Array.isArray(issue)) {
      return [];
    }

    const task = toTask(issue);
    return task == null ? [] : [task];
  });
};

export const mergeEpic = (cache: TrackerCache | null, epic: TrackerEpic, timestamp: number): TrackerCache => ({
  version: 1,
  timestamp,
  epics: {
    ...cache?.epics,
    [epic.id]: epic,
  },
});

export const mergeTasks = (
  cache: TrackerCache | null,
  epicId: string,
  tasks: readonly TrackerTask[],
  timestamp: number,
): TrackerCache => {
  const existing = cache?.epics[epicId];
  return {
    version: 1,
    timestamp,
    epics: {
      ...cache?.epics,
      [epicId]: {
        id: epicId,
        title: existing?.title ?? '',
        ...(existing?.project == null ? {} : { project: existing.project }),
        ...(existing?.type == null ? {} : { type: existing.type }),
        status: existing?.status ?? '',
        tasks,
      },
    },
  };
};

interface CachedIssueStatusUpdate {
  readonly cache: TrackerCache | null;
  readonly targetIssueId: string;
  readonly status: string;
  readonly stateType: string | null;
  readonly timestamp: number;
}

export const updateCachedIssueStatus = (update: CachedIssueStatusUpdate): TrackerCache | null => {
  const { cache, targetIssueId, status, stateType, timestamp } = update;
  if (cache == null) {
    return null;
  }

  let changed = false;
  const epics: Record<string, TrackerEpic> = {};

  for (const [epicId, epic] of Object.entries(cache.epics)) {
    if (epic.id === targetIssueId) {
      changed = true;
      epics[epicId] = { ...epic, status };
      continue;
    }

    const tasks: TrackerTask[] = [];
    for (const task of epic.tasks) {
      if (task.id === targetIssueId) {
        tasks.push({
          ...task,
          status,
          stateType: stateType ?? task.stateType,
        });
      } else {
        tasks.push(task);
      }
    }

    if (tasks.some((task, index) => task !== epic.tasks[index])) {
      changed = true;
      epics[epicId] = { ...epic, tasks };
      continue;
    }

    epics[epicId] = epic;
  }

  if (!changed) {
    return null;
  }

  return {
    version: 1,
    timestamp,
    epics,
  };
};

export const isTrackerCache = (value: unknown): value is TrackerCache => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }

  const cache = value as { readonly version?: unknown; readonly timestamp?: unknown; readonly epics?: unknown };
  return cache.version === 1 && typeof cache.timestamp === 'number' && typeof cache.epics === 'object' && cache.epics != null && !Array.isArray(cache.epics);
};

export const readCacheFile = () =>
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

export const writeCacheFile = (cache: TrackerCache) =>
  Effect.try({
    try: () => {
      const root = pluginRoot();
      mkdirSync(`${root}/hooks/context`, { recursive: true });
      writeFileSync(trackerCachePath(root), JSON.stringify(cache));
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to write tracker cache', { cause: error }),
  });
