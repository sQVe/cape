import type { Effect} from 'effect';
import { ServiceMap } from 'effect';

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

export class TrackerService extends ServiceMap.Service<
  TrackerService,
  {
    readonly createEpic: (title: string) => Effect.Effect<TrackerEpic, Error>;
    readonly createTasks: (
      epicId: string,
      tasks: readonly { readonly title: string }[],
    ) => Effect.Effect<readonly TrackerTask[], Error>;
    readonly getEpic: (epicId: string) => Effect.Effect<TrackerEpic | null, Error>;
    readonly listReady: (epicId: string) => Effect.Effect<readonly TrackerTask[], Error>;
    readonly updateStatus: (issueId: string, status: string) => Effect.Effect<void, Error>;
    readonly close: (issueId: string) => Effect.Effect<void, Error>;
  }
>()('TrackerService') {}
