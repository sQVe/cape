import { Effect } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { TrackerService } from './tracker';
import { makeTrackerServiceLive } from './trackerLive';

describe('TrackerServiceLive', () => {
  describe('createEpic', () => {
    it('creates an epic through Linear MCP, writes it to the tracker cache, and returns it', async () => {
      const now = 1_700_000_000_002;
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const callLinear = vi.fn(() =>
        Effect.succeed({
          id: 'lin-epic-2',
          identifier: 'ABU-34',
          title: 'Tracker write operations',
          state: { name: 'Todo', type: 'unstarted' },
        }),
      );
      const layer = makeTrackerServiceLive({
        now: () => now,
        readCache: () => Effect.succeed(null),
        writeCache,
        callLinear,
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.createEpic('Tracker write operations');
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual({
        id: 'ABU-34',
        title: 'Tracker write operations',
        status: 'Todo',
        tasks: [],
      });
      expect(callLinear).toHaveBeenCalledWith('createEpic', { title: 'Tracker write operations' });
      expect(writeCache).toHaveBeenCalledWith({
        version: 1,
        timestamp: now,
        epics: {
          'ABU-34': {
            id: 'ABU-34',
            title: 'Tracker write operations',
            status: 'Todo',
            tasks: [],
          },
        },
      });
    });

    it('propagates Linear errors without mutating the tracker cache', async () => {
      const readCache = vi.fn(() => Effect.succeed(null));
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_003,
        readCache,
        writeCache,
        callLinear: () => Effect.fail(new Error('linear unavailable')),
      });

      await expect(
        Effect.runPromise(
          Effect.gen(function* () {
            const tracker = yield* TrackerService;
            return yield* tracker.createEpic('Tracker write operations');
          }).pipe(Effect.provide(layer)),
        ),
      ).rejects.toThrow('linear unavailable');
      expect(readCache).not.toHaveBeenCalled();
      expect(writeCache).not.toHaveBeenCalled();
    });

    it('fails descriptively when Linear returns an epic without an id', async () => {
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_004,
        readCache: () => Effect.succeed(null),
        writeCache,
        callLinear: () =>
          Effect.succeed({
            title: 'Tracker write operations',
            state: { name: 'Todo', type: 'unstarted' },
          }),
      });

      await expect(
        Effect.runPromise(
          Effect.gen(function* () {
            const tracker = yield* TrackerService;
            return yield* tracker.createEpic('Tracker write operations');
          }).pipe(Effect.provide(layer)),
        ),
      ).rejects.toThrow('Linear createEpic response did not include an issue id');
      expect(writeCache).not.toHaveBeenCalled();
    });

    it('returns the created epic when writing the tracker cache fails after Linear succeeds', async () => {
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_005,
        readCache: () => Effect.succeed(null),
        writeCache: () => Effect.fail(new Error('cache write failed')),
        callLinear: () =>
          Effect.succeed({
            identifier: 'ABU-34',
            title: 'Tracker write operations',
            state: { name: 'Todo', type: 'unstarted' },
          }),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.createEpic('Tracker write operations');
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual({
        id: 'ABU-34',
        title: 'Tracker write operations',
        status: 'Todo',
        tasks: [],
      });
    });
  });

  describe('createTasks', () => {
    it('creates one Linear sub-issue per task, writes them under the epic, and returns them', async () => {
      const now = 1_700_000_000_006;
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const taskResponses = [
        {
          id: 'lin-task-2',
          identifier: 'ABU-35',
          title: 'Draft write contract',
          state: { name: 'Todo', type: 'unstarted' },
        },
        {
          id: 'lin-task-3',
          identifier: 'ABU-36',
          title: 'Wire status updates',
          state: { name: 'Todo', type: 'unstarted' },
        },
      ];
      let responseIndex = 0;
      const callLinear = vi.fn((_operation: unknown, _argument: unknown) => {
        const response = taskResponses[responseIndex];
        responseIndex += 1;
        return Effect.succeed(response);
      });
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
          }),
        writeCache,
        callLinear,
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.createTasks('ABU-15', [
            { title: 'Draft write contract' },
            { title: 'Wire status updates' },
          ]);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual([
        {
          id: 'ABU-35',
          title: 'Draft write contract',
          status: 'Todo',
          stateType: 'unstarted',
        },
        {
          id: 'ABU-36',
          title: 'Wire status updates',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ]);
      expect(callLinear).toHaveBeenNthCalledWith(1, 'createTask', {
        epicId: 'ABU-15',
        title: 'Draft write contract',
      });
      expect(callLinear).toHaveBeenNthCalledWith(2, 'createTask', {
        epicId: 'ABU-15',
        title: 'Wire status updates',
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
              {
                id: 'ABU-35',
                title: 'Draft write contract',
                status: 'Todo',
                stateType: 'unstarted',
              },
              {
                id: 'ABU-36',
                title: 'Wire status updates',
                status: 'Todo',
                stateType: 'unstarted',
              },
            ],
          },
        },
      });
    });

    it('returns an empty list without calling Linear or mutating the tracker cache when no tasks are requested', async () => {
      const readCache = vi.fn(() => Effect.succeed(null));
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const callLinear = vi.fn(() => Effect.succeed({}));
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_007,
        readCache,
        writeCache,
        callLinear,
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.createTasks('ABU-15', []);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual([]);
      expect(callLinear).not.toHaveBeenCalled();
      expect(readCache).not.toHaveBeenCalled();
      expect(writeCache).not.toHaveBeenCalled();
    });

    it('propagates Linear errors without mutating the tracker cache', async () => {
      const readCache = vi.fn(() => Effect.succeed(null));
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      let callCount = 0;
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_008,
        readCache,
        writeCache,
        callLinear: () => {
          callCount += 1;
          if (callCount === 1) {
            return Effect.succeed({
              identifier: 'ABU-35',
              title: 'Draft write contract',
              state: { name: 'Todo', type: 'unstarted' },
            });
          }
          return Effect.fail(new Error('linear unavailable'));
        },
      });

      await expect(
        Effect.runPromise(
          Effect.gen(function* () {
            const tracker = yield* TrackerService;
            return yield* tracker.createTasks('ABU-15', [
              { title: 'Draft write contract' },
              { title: 'Wire status updates' },
            ]);
          }).pipe(Effect.provide(layer)),
        ),
      ).rejects.toThrow('linear unavailable');
      expect(readCache).not.toHaveBeenCalled();
      expect(writeCache).not.toHaveBeenCalled();
    });

    it('fails descriptively when Linear returns a task without an id', async () => {
      const writeCache = vi.fn(() => Effect.succeed(undefined));
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_009,
        readCache: () => Effect.succeed(null),
        writeCache,
        callLinear: () =>
          Effect.succeed({
            title: 'Draft write contract',
            state: { name: 'Todo', type: 'unstarted' },
          }),
      });

      await expect(
        Effect.runPromise(
          Effect.gen(function* () {
            const tracker = yield* TrackerService;
            return yield* tracker.createTasks('ABU-15', [{ title: 'Draft write contract' }]);
          }).pipe(Effect.provide(layer)),
        ),
      ).rejects.toThrow('Linear createTask response did not include an issue id');
      expect(writeCache).not.toHaveBeenCalled();
    });

    it('returns the created tasks when writing the tracker cache fails after Linear succeeds', async () => {
      const layer = makeTrackerServiceLive({
        now: () => 1_700_000_000_010,
        readCache: () => Effect.succeed(null),
        writeCache: () => Effect.fail(new Error('cache write failed')),
        callLinear: () =>
          Effect.succeed({
            identifier: 'ABU-35',
            title: 'Draft write contract',
            state: { name: 'Todo', type: 'unstarted' },
          }),
      });

      const result = await Effect.runPromise(
        Effect.gen(function* () {
          const tracker = yield* TrackerService;
          return yield* tracker.createTasks('ABU-15', [{ title: 'Draft write contract' }]);
        }).pipe(Effect.provide(layer)),
      );

      expect(result).toEqual([
        {
          id: 'ABU-35',
          title: 'Draft write contract',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ]);
    });
  });

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
