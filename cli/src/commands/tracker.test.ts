import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { Effect } from 'effect';
import { Command } from 'effect/unstable/cli';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { makeTestCommandLayers, spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });
let activeRoot: string | null = null;

const makeRoot = () => {
  const root = mkdtempSync(`${tmpdir()}/cape-tracker-`);
  activeRoot = root;
  vi.stubEnv('CLAUDE_PLUGIN_ROOT', root);
  return root;
};

const trackerPath = (root: string) => `${root}/hooks/context/tracker.json`;

const readCache = (root: string) => JSON.parse(readFileSync(trackerPath(root), 'utf-8'));

afterEach(() => {
  if (activeRoot != null) {
    rmSync(activeRoot, { recursive: true, force: true });
  }
  activeRoot = null;
  vi.unstubAllEnvs();
});

describe('cape tracker cache-epic', () => {
  it('writes a Linear epic issue with child sub-issues into an empty cache', async () => {
    const root = makeRoot();
    const console_ = spyConsole();

    await Effect.runPromise(
      run([
        'tracker',
        'cache-epic',
        JSON.stringify({
          identifier: 'ABU-15',
          title: 'Cape V2',
          state: { name: 'In Progress', type: 'started' },
          children: {
            nodes: [
              {
                identifier: 'ABU-56',
                title: 'Tracker cache CLI',
                state: { name: 'Todo', type: 'unstarted' },
              },
            ],
          },
        }),
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const output = JSON.parse(console_.output());
    const cache = readCache(root);
    expect(output).toEqual({ cached: true, epicId: 'ABU-15', taskCount: 1 });
    expect(cache.version).toBe(1);
    expect(cache.timestamp).toBeTypeOf('number');
    expect(cache.epics['ABU-15']).toEqual({
      id: 'ABU-15',
      title: 'Cape V2',
      status: 'In Progress',
      tasks: [
        {
          id: 'ABU-56',
          title: 'Tracker cache CLI',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ],
    });
    console_.restore();
  });

  it('treats a corrupt cache as empty before writing the epic', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(trackerPath(root), 'not json');
    const console_ = spyConsole();

    await Effect.runPromise(
      run([
        'tracker',
        'cache-epic',
        JSON.stringify({
          identifier: 'ABU-16',
          title: 'Fresh epic',
          state: { name: 'Todo', type: 'unstarted' },
        }),
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const cache = readCache(root);
    expect(Object.keys(cache.epics)).toEqual(['ABU-16']);
    expect(cache.epics['ABU-16'].title).toBe('Fresh epic');
    console_.restore();
  });

  it('rejects invalid JSON without overwriting the existing cache', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    const existing = JSON.stringify({ version: 1, timestamp: 1, epics: {} });
    writeFileSync(trackerPath(root), existing);
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['tracker', 'cache-epic', '{']).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain('invalid Linear issue JSON');
    console_.restore();
  });

  it('rejects a Linear issue without an id without overwriting the existing cache', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    const existing = JSON.stringify({ version: 1, timestamp: 1, epics: {} });
    writeFileSync(trackerPath(root), existing);
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run([
          'tracker',
          'cache-epic',
          JSON.stringify({ title: 'Missing id', state: { name: 'Todo', type: 'unstarted' } }),
        ]).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain(
      'Linear epic JSON must include an issue id',
    );
    console_.restore();
  });
});

describe('cape tracker cache-tasks', () => {
  it('treats a missing cache as empty before writing tasks under the epic', async () => {
    const root = makeRoot();
    const console_ = spyConsole();

    await Effect.runPromise(
      run([
        'tracker',
        'cache-tasks',
        'ABU-15',
        JSON.stringify([
          {
            identifier: 'ABU-57',
            title: 'Rewire chains',
            state: { name: 'Todo', type: 'unstarted' },
          },
        ]),
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const output = JSON.parse(console_.output());
    const cache = readCache(root);
    expect(output).toEqual({ cached: true, epicId: 'ABU-15', taskCount: 1 });
    expect(cache.version).toBe(1);
    expect(cache.timestamp).toBeTypeOf('number');
    expect(cache.epics).toEqual({
      'ABU-15': {
        id: 'ABU-15',
        title: '',
        status: '',
        tasks: [
          {
            id: 'ABU-57',
            title: 'Rewire chains',
            status: 'Todo',
            stateType: 'unstarted',
          },
        ],
      },
    });
    console_.restore();
  });

  it('treats a corrupt cache as empty before writing tasks under the epic', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(trackerPath(root), 'not json');
    const console_ = spyConsole();

    await Effect.runPromise(
      run([
        'tracker',
        'cache-tasks',
        'ABU-15',
        JSON.stringify([
          {
            identifier: 'ABU-58',
            title: 'Refresh routing',
            state: { name: 'Todo', type: 'unstarted' },
          },
        ]),
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const output = JSON.parse(console_.output());
    const cache = readCache(root);
    expect(output).toEqual({ cached: true, epicId: 'ABU-15', taskCount: 1 });
    expect(cache.epics).toEqual({
      'ABU-15': {
        id: 'ABU-15',
        title: '',
        status: '',
        tasks: [
          {
            id: 'ABU-58',
            title: 'Refresh routing',
            status: 'Todo',
            stateType: 'unstarted',
          },
        ],
      },
    });
    console_.restore();
  });

  it('writes Linear task issues under the target epic', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(
      trackerPath(root),
      JSON.stringify({
        version: 1,
        timestamp: 1,
        epics: {
          'ABU-15': {
            id: 'ABU-15',
            title: 'Cape V2',
            status: 'In Progress',
            tasks: [],
          },
        },
      }),
    );
    const console_ = spyConsole();

    await Effect.runPromise(
      run([
        'tracker',
        'cache-tasks',
        'ABU-15',
        JSON.stringify([
          {
            identifier: 'ABU-57',
            title: 'Rewire chains',
            state: { name: 'Todo', type: 'unstarted' },
          },
        ]),
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const output = JSON.parse(console_.output());
    const cache = readCache(root);
    expect(output).toEqual({ cached: true, epicId: 'ABU-15', taskCount: 1 });
    expect(cache.epics['ABU-15']).toEqual({
      id: 'ABU-15',
      title: 'Cape V2',
      status: 'In Progress',
      tasks: [
        {
          id: 'ABU-57',
          title: 'Rewire chains',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ],
    });
    console_.restore();
  });

  it('rejects invalid JSON without overwriting the existing cache', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    const existing = JSON.stringify({
      version: 1,
      timestamp: 1,
      epics: {
        'ABU-15': {
          id: 'ABU-15',
          title: 'Cape V2',
          status: 'In Progress',
          tasks: [],
        },
      },
    });
    writeFileSync(trackerPath(root), existing);
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['tracker', 'cache-tasks', 'ABU-15', '{']).pipe(
          Effect.provide(makeTestCommandLayers()),
        ),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain('invalid Linear tasks JSON');
    console_.restore();
  });

  it('rejects any task issue without an id without overwriting the existing cache', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    const existing = JSON.stringify({
      version: 1,
      timestamp: 1,
      epics: {
        'ABU-15': {
          id: 'ABU-15',
          title: 'Cape V2',
          status: 'In Progress',
          tasks: [],
        },
      },
    });
    writeFileSync(trackerPath(root), existing);
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run([
          'tracker',
          'cache-tasks',
          'ABU-15',
          JSON.stringify([
            {
              identifier: 'ABU-57',
              title: 'Rewire chains',
              state: { name: 'Todo', type: 'unstarted' },
            },
            {
              title: 'Missing id',
              state: { name: 'Todo', type: 'unstarted' },
            },
          ]),
        ]).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain(
      'Linear task JSON must include issue ids',
    );
    console_.restore();
  });
});

describe('cape tracker cache-status', () => {
  it('updates a cached task status and state type', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(
      trackerPath(root),
      JSON.stringify({
        version: 1,
        timestamp: 1,
        epics: {
          'ABU-15': {
            id: 'ABU-15',
            title: 'Cape V2',
            status: 'In Progress',
            tasks: [
              {
                id: 'ABU-56',
                title: 'Tracker cache CLI',
                status: 'Todo',
                stateType: 'unstarted',
              },
            ],
          },
        },
      }),
    );
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['tracker', 'cache-status', 'ABU-56', 'In Progress', 'started']).pipe(
        Effect.provide(makeTestCommandLayers()),
      ),
    );

    const output = JSON.parse(console_.output());
    const cache = readCache(root);
    expect(output).toEqual({ cached: true, issueId: 'ABU-56', changed: true });
    expect(cache.epics['ABU-15'].tasks[0]).toEqual({
      id: 'ABU-56',
      title: 'Tracker cache CLI',
      status: 'In Progress',
      stateType: 'started',
    });
    console_.restore();
  });

  it('does not create a cache when the target issue is absent locally', async () => {
    const root = makeRoot();
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['tracker', 'cache-status', 'ABU-99', 'Done', 'completed']).pipe(
        Effect.provide(makeTestCommandLayers()),
      ),
    );

    expect(console_.output()).toBe(
      JSON.stringify({ cached: false, issueId: 'ABU-99', changed: false }),
    );
    expect(() => readFileSync(trackerPath(root), 'utf-8')).toThrow();
    console_.restore();
  });

  it('leaves a corrupt cache untouched when the target issue is absent locally', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(trackerPath(root), 'not json');
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['tracker', 'cache-status', 'ABU-99', 'Done', 'completed']).pipe(
        Effect.provide(makeTestCommandLayers()),
      ),
    );

    expect(console_.output()).toBe(
      JSON.stringify({ cached: false, issueId: 'ABU-99', changed: false }),
    );
    expect(readFileSync(trackerPath(root), 'utf-8')).toBe('not json');
    console_.restore();
  });
});
