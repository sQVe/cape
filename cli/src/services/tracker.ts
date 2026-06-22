export const TRACKER_CACHE_TTL_MS = 30 * 60 * 1000;

export interface TrackerTask {
  readonly id: string;
  readonly title: string;
  readonly project?: string;
  readonly type?: string;
  readonly status: string;
  readonly stateType: string;
}

export interface TrackerEpic {
  readonly id: string;
  readonly title: string;
  readonly project?: string;
  readonly type?: string;
  readonly status: string;
  readonly tasks: readonly TrackerTask[];
}

export interface TrackerCache {
  readonly version: 1;
  readonly timestamp: number;
  readonly epics: Record<string, TrackerEpic>;
}

const isTrackerTask = (value: unknown): value is TrackerTask => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }
  const task = value as {
    readonly id?: unknown;
    readonly title?: unknown;
    readonly project?: unknown;
    readonly type?: unknown;
    readonly status?: unknown;
    readonly stateType?: unknown;
  };
  return (
    typeof task.id === 'string' &&
    typeof task.title === 'string' &&
    (task.project == null || typeof task.project === 'string') &&
    (task.type == null || typeof task.type === 'string') &&
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
    readonly project?: unknown;
    readonly type?: unknown;
    readonly status?: unknown;
    readonly tasks?: unknown;
  };
  return (
    typeof epic.id === 'string' &&
    typeof epic.title === 'string' &&
    (epic.project == null || typeof epic.project === 'string') &&
    (epic.type == null || typeof epic.type === 'string') &&
    typeof epic.status === 'string' &&
    Array.isArray(epic.tasks) &&
    epic.tasks.every(isTrackerTask)
  );
};

export const isTrackerCache = (value: unknown): value is TrackerCache => {
  if (typeof value !== 'object' || value == null || Array.isArray(value)) {
    return false;
  }
  const cache = value as { readonly version?: unknown; readonly timestamp?: unknown; readonly epics?: unknown };
  if (cache.version !== 1 || typeof cache.timestamp !== 'number') {
    return false;
  }
  if (typeof cache.epics !== 'object' || cache.epics == null || Array.isArray(cache.epics)) {
    return false;
  }
  return Object.values(cache.epics).every(isTrackerEpic);
};
