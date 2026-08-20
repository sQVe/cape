import { describe, expect, it } from 'vitest';

import type { TrackerCache, TrackerEpic, TrackerTask } from './tracker';
import { mergeEpic, mergeTasks, stateTypeFromStatus, toEpic } from './trackerLive';

const task = (id: string, stateType: string, overrides?: Partial<TrackerTask>): TrackerTask => ({
  id,
  title: `Task ${id}`,
  status: stateType,
  stateType,
  ...overrides,
});

const epic = (id: string, tasks: readonly TrackerTask[]): TrackerEpic => ({
  id,
  title: `Epic ${id}`,
  status: 'In Progress',
  tasks,
});

const cacheWith = (epicEntry: TrackerEpic): TrackerCache => ({
  version: 1,
  timestamp: 1000,
  epics: { [epicEntry.id]: epicEntry },
});

describe('trackerLive', () => {
  describe('mergeTasks', () => {
    it('keeps a locally completed task when a stale refresh shows it unstarted', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'completed', { status: 'Done' })]));

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', 'unstarted')], 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-2', 'completed', { status: 'Done' }),
      ]);
    });

    it('lets an incoming completed task override a locally started one', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started')]));

      const merged = mergeTasks(
        cache,
        'ABU-1',
        [task('ABU-2', 'completed', { status: 'Done' })],
        2000,
      );

      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-2', 'completed', { status: 'Done' }),
      ]);
    });

    it('lets an incoming canceled task override a locally started one', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started')]));

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', 'canceled')], 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'canceled')]);
    });

    it('treats unknown or empty stateType as least advanced', () => {
      const cache = cacheWith(
        epic('ABU-1', [task('ABU-2', 'started'), task('ABU-3', 'completed')]),
      );

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', ''), task('ABU-3', 'triage')], 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-2', 'started'),
        task('ABU-3', 'completed'),
      ]);
    });

    it('takes incoming metadata while keeping the more advanced cached state', () => {
      const cache = cacheWith(epic('AI-1', [task('AI-2', 'completed', { status: 'Done' })]));

      const merged = mergeTasks(
        cache,
        'AI-1',
        [task('AI-2', 'unstarted', { title: 'New title', humanTicketId: 'ABU-9' })],
        2000,
      );

      expect(merged.epics['AI-1']?.tasks).toEqual([
        task('AI-2', 'completed', { status: 'Done', title: 'New title', humanTicketId: 'ABU-9' }),
      ]);
    });

    it('takes incoming data on equal rank', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started', { title: 'Old title' })]));

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', 'started')], 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'started')]);
    });

    it('keeps tasks only present in the cache and tasks only in the incoming data', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'completed')]));

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-3', 'unstarted')], 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-3', 'unstarted'),
        task('ABU-2', 'completed'),
      ]);
    });

    it('keeps unadvanced cache-only tasks on a partial tasks refresh', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'unstarted')]));

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-3', 'unstarted')], 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-3', 'unstarted'),
        task('ABU-2', 'unstarted'),
      ]);
    });

    it('replaces the timestamp and preserves other epics', () => {
      const other = epic('ABU-9', [task('ABU-10', 'started')]);
      const cache: TrackerCache = {
        version: 1,
        timestamp: 1000,
        epics: { 'ABU-1': epic('ABU-1', []), 'ABU-9': other },
      };

      const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', 'unstarted')], 2000);

      expect(merged.timestamp).toBe(2000);
      expect(merged.epics['ABU-9']).toEqual(other);
    });

    it('preserves the epic humanTicketId across a tasks-only refresh', () => {
      const cache = cacheWith({ ...epic('AI-1', []), humanTicketId: 'ABU-9' });

      const merged = mergeTasks(cache, 'AI-1', [task('AI-2', 'unstarted')], 2000);

      expect(merged.epics['AI-1']?.humanTicketId).toBe('ABU-9');
    });

    it('keeps a cached task humanTicketId when the incoming task has none', () => {
      const cache = cacheWith(epic('AI-1', [task('AI-2', 'started', { humanTicketId: 'ABU-9' })]));

      const merged = mergeTasks(cache, 'AI-1', [task('AI-2', 'started')], 2000);

      expect(merged.epics['AI-1']?.tasks[0]?.humanTicketId).toBe('ABU-9');
    });

    it('lets an incoming task humanTicketId replace the cached one', () => {
      const cache = cacheWith(epic('AI-1', [task('AI-2', 'started', { humanTicketId: 'ABU-9' })]));

      const merged = mergeTasks(
        cache,
        'AI-1',
        [task('AI-2', 'started', { humanTicketId: 'ABU-10' })],
        2000,
      );

      expect(merged.epics['AI-1']?.tasks[0]?.humanTicketId).toBe('ABU-10');
    });
  });

  describe('mergeEpic', () => {
    it('keeps a locally completed task when a stale epic refresh shows it unstarted', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'completed', { status: 'Done' })]));

      const merged = mergeEpic(cache, epic('ABU-1', [task('ABU-2', 'unstarted')]), 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-2', 'completed', { status: 'Done' }),
      ]);
    });

    it('lets an incoming completed task override a locally started one', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started')]));

      const merged = mergeEpic(cache, epic('ABU-1', [task('ABU-2', 'completed')]), 2000);

      expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'completed')]);
    });

    it('keeps cache-only tasks and takes incoming epic-level fields', () => {
      const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'completed')]));
      const incoming: TrackerEpic = {
        ...epic('ABU-1', [task('ABU-3', 'unstarted')]),
        title: 'New title',
        status: 'Done',
      };

      const merged = mergeEpic(cache, incoming, 2000);

      expect(merged.epics['ABU-1']?.title).toBe('New title');
      expect(merged.epics['ABU-1']?.status).toBe('Done');
      expect(merged.epics['ABU-1']?.tasks).toEqual([
        task('ABU-3', 'unstarted'),
        task('ABU-2', 'completed'),
      ]);
    });

    it('drops cache-only tasks that never advanced on a full epic refresh', () => {
      const cache = cacheWith(epic('AI-1', [task('AI-2', 'unstarted'), task('AI-3', 'backlog')]));

      const merged = mergeEpic(cache, epic('AI-1', [task('AI-4', 'unstarted')]), 2000);

      expect(merged.epics['AI-1']?.tasks).toEqual([task('AI-4', 'unstarted')]);
    });

    it('keeps advanced cache-only tasks on a full epic refresh', () => {
      const cache = cacheWith(epic('AI-1', [task('AI-2', 'started'), task('AI-3', 'completed')]));

      const merged = mergeEpic(cache, epic('AI-1', []), 2000);

      expect(merged.epics['AI-1']?.tasks).toEqual([
        task('AI-2', 'started'),
        task('AI-3', 'completed'),
      ]);
    });

    it('creates the epic entry when there is no cache', () => {
      const incoming = epic('ABU-1', [task('ABU-2', 'unstarted')]);

      const merged = mergeEpic(null, incoming, 2000);

      expect(merged).toEqual({ version: 1, timestamp: 2000, epics: { 'ABU-1': incoming } });
    });

    it('keeps the cached humanTicketId when the incoming epic has none', () => {
      const cache = cacheWith({ ...epic('AI-1', []), humanTicketId: 'ABU-9' });

      const merged = mergeEpic(cache, epic('AI-1', []), 2000);

      expect(merged.epics['AI-1']?.humanTicketId).toBe('ABU-9');
    });

    it('lets an incoming humanTicketId replace the cached one', () => {
      const cache = cacheWith({ ...epic('AI-1', []), humanTicketId: 'ABU-9' });

      const merged = mergeEpic(cache, { ...epic('AI-1', []), humanTicketId: 'ABU-10' }, 2000);

      expect(merged.epics['AI-1']?.humanTicketId).toBe('ABU-10');
    });
  });

  describe('toEpic', () => {
    it('reads a task humanTicketId from an explicit field in the child payload', () => {
      const result = toEpic({
        identifier: 'AI-1',
        title: 'Epic',
        children: { nodes: [{ identifier: 'AI-2', title: 'Bug', humanTicketId: 'ABU-9' }] },
      });

      expect(result?.tasks[0]?.humanTicketId).toBe('ABU-9');
    });

    it('reads humanTicketId from an explicit field in the payload', () => {
      const result = toEpic({ identifier: 'AI-1', title: 'Epic', humanTicketId: 'ABU-9' });

      expect(result?.humanTicketId).toBe('ABU-9');
    });

    it('omits humanTicketId when the payload has none', () => {
      const result = toEpic({ identifier: 'AI-1', title: 'Epic' });

      expect(result).not.toBeNull();
      expect(result?.humanTicketId).toBeUndefined();
    });

    it('reads humanTicketId from parentId when the payload has no explicit field', () => {
      const result = toEpic({ identifier: 'AI-3', title: 'Plan', parentId: 'ABU-252' });

      expect(result?.humanTicketId).toBe('ABU-252');
    });

    it('prefers an explicit humanTicketId over parentId', () => {
      const result = toEpic({
        identifier: 'AI-3',
        title: 'Plan',
        humanTicketId: 'ABU-9',
        parentId: 'ABU-252',
      });

      expect(result?.humanTicketId).toBe('ABU-9');
    });

    it('never derives a task humanTicketId from its parent plan issue', () => {
      const result = toEpic({
        identifier: 'AI-3',
        title: 'Plan',
        children: { nodes: [{ identifier: 'AI-4', title: 'Task', parentId: 'AI-3' }] },
      });

      expect(result?.tasks[0]?.humanTicketId).toBeUndefined();
    });
  });

  describe('stateTypeFromStatus', () => {
    it('maps well-known status names to their state type', () => {
      expect(stateTypeFromStatus('Done')).toBe('completed');
      expect(stateTypeFromStatus('closed')).toBe('completed');
      expect(stateTypeFromStatus('Canceled')).toBe('canceled');
      expect(stateTypeFromStatus('In Progress')).toBe('started');
      expect(stateTypeFromStatus('In Review')).toBe('started');
      expect(stateTypeFromStatus('Todo')).toBe('unstarted');
      expect(stateTypeFromStatus('Backlog')).toBe('backlog');
    });

    it('returns null for unknown status names', () => {
      expect(stateTypeFromStatus('Blocked on vendor')).toBeNull();
      expect(stateTypeFromStatus('')).toBeNull();
    });
  });
});
