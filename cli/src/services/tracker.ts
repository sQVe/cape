export const TRACKER_CACHE_TTL_MS = 30 * 60 * 1000;

export interface TrackerTask {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly stateType: string;
}

export interface TrackerEpic {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly tasks: readonly TrackerTask[];
}

export interface TrackerCache {
  readonly version: 1;
  readonly timestamp: number;
  readonly epics: Record<string, TrackerEpic>;
}
