import { describe, expect, it } from 'vitest';

import type { TrackerCache, TrackerEpic, TrackerTask } from './tracker';
import { mergeEpic, mergeTasks, toEpic } from './trackerLive';

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

describe('mergeTasks', () => {
  it('keeps a locally completed task when a stale refresh shows it unstarted', () => {
    const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'completed', { status: 'Done' })]));

    const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', 'unstarted')], 2000);

    expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'completed', { status: 'Done' })]);
  });

  it('lets an incoming completed task override a locally started one', () => {
    const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started')]));

    const merged = mergeTasks(
      cache,
      'ABU-1',
      [task('ABU-2', 'completed', { status: 'Done' })],
      2000,
    );

    expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'completed', { status: 'Done' })]);
  });

  it('lets an incoming canceled task override a locally started one', () => {
    const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started')]));

    const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', 'canceled')], 2000);

    expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'canceled')]);
  });

  it('treats unknown or empty stateType as least advanced', () => {
    const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'started'), task('ABU-3', 'completed')]));

    const merged = mergeTasks(cache, 'ABU-1', [task('ABU-2', ''), task('ABU-3', 'triage')], 2000);

    expect(merged.epics['ABU-1']?.tasks).toEqual([
      task('ABU-2', 'started'),
      task('ABU-3', 'completed'),
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
});

describe('mergeEpic', () => {
  it('keeps a locally completed task when a stale epic refresh shows it unstarted', () => {
    const cache = cacheWith(epic('ABU-1', [task('ABU-2', 'completed', { status: 'Done' })]));

    const merged = mergeEpic(cache, epic('ABU-1', [task('ABU-2', 'unstarted')]), 2000);

    expect(merged.epics['ABU-1']?.tasks).toEqual([task('ABU-2', 'completed', { status: 'Done' })]);
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

describe('mergeTasks', () => {
  it('preserves the epic humanTicketId across a tasks-only refresh', () => {
    const cache = cacheWith({ ...epic('AI-1', []), humanTicketId: 'ABU-9' });

    const merged = mergeTasks(cache, 'AI-1', [task('AI-2', 'unstarted')], 2000);

    expect(merged.epics['AI-1']?.humanTicketId).toBe('ABU-9');
  });
});

describe('toEpic', () => {
  it('reads humanTicketId from an explicit field in the payload', () => {
    const result = toEpic({ identifier: 'AI-1', title: 'Epic', humanTicketId: 'ABU-9' });

    expect(result?.humanTicketId).toBe('ABU-9');
  });

  it('omits humanTicketId when the payload has none', () => {
    const result = toEpic({ identifier: 'AI-1', title: 'Epic' });

    expect(result).not.toBeNull();
    expect(result?.humanTicketId).toBeUndefined();
  });
});
