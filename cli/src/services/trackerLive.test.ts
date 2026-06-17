import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { TrackerService } from './tracker';
import { makeTrackerServiceLive } from './trackerLive';

describe('TrackerServiceLive', () => {
  describe('getEpic', () => {
    it('reads an epic through Linear MCP and writes it to the tracker cache', async () => {
      const now = 1_700_000_000_000;
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const layer = makeTrackerServiceLive({
        now: () => now,
        readCache: () => Effect.succeed(null),
        writeCache,
        callLinear: () =>
          Effect.succeed({
            id: 'lin-epic-1',
            identifier: 'ABU-15',
            title: 'Cape V2',
            state: { name: 'In Progress', type: 'started' },
            children: {
              nodes: [
                {
                  id: 'lin-task-1',
                  identifier: 'ABU-16',
                  title: 'Tracker seam',
                  state: { name: 'Done', type: 'completed' },
                },
              ],
            },
          }),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.getEpic('ABU-15');
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual({
        id: 'ABU-15',
        title: 'Cape V2',
        status: 'In Progress',
        tasks: [
          {
            id: 'ABU-16',
            title: 'Tracker seam',
            status: 'Done',
            stateType: 'completed',
          },
        ],
      });
      expect(writeCache).toHaveBeenCalledWith({
        version: 1,
        timestamp: now,
        epics: {
          'ABU-15': {
            id: 'ABU-15',
            title: 'Cape V2',
            status: 'In Progress',
            tasks: [
              {
                id: 'ABU-16',
                title: 'Tracker seam',
                status: 'Done',
                stateType: 'completed',
              },
            ],
          },
        },
      });
    });
  });

  describe('listReady', () => {
    it('reads ready tasks through Linear MCP and writes them to the tracker cache', async () => {
      const now = 1_700_000_000_001;
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const layer = makeTrackerServiceLive({
        now: () => now,
        readCache: () =>
          Effect.succeed({
            version: 1,
            timestamp: now - 1,
            epics: {
              'ABU-15': {
                id: 'ABU-15',
                title: 'Cape V2',
                status: 'In Progress',
                tasks: [],
              },
            },
          }),
        writeCache,
        callLinear: () =>
          Effect.succeed([
            {
              id: 'lin-task-1',
              identifier: 'ABU-16',
              title: 'Tracker seam',
              state: { name: 'Todo', type: 'unstarted' },
            },
          ]),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.listReady('ABU-15');
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual([
        {
          id: 'ABU-16',
          title: 'Tracker seam',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ]);
      expect(writeCache).toHaveBeenCalledWith({
        version: 1,
        timestamp: now,
        epics: {
          'ABU-15': {
            id: 'ABU-15',
            title: 'Cape V2',
            status: 'In Progress',
            tasks: [
              {
                id: 'ABU-16',
                title: 'Tracker seam',
                status: 'Todo',
                stateType: 'unstarted',
              },
            ],
          },
        },
      });
    });
  });
});
