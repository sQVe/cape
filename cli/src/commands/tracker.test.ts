import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { HookService, readTrackerCache } from '../services/hooks/state';
import { makeTestCommandLayers, spyConsole } from '../testUtils';
import { trackerCachePath } from '../utils/trackerCachePath';

const trackerPath = (root: string) => trackerCachePath(root);

const run = Command.runWith(main, { version: '0.1.0' });
let activeRoot: string | null = null;

const makeRoot = () => {
  const root = mkdtempSync(`${tmpdir()}/cape-tracker-`);
  activeRoot = root;
  vi.stubEnv('CLAUDE_PLUGIN_ROOT', root);
  return root;
};

const readCache = (root: string) => JSON.parse(readFileSync(trackerPath(root), 'utf-8'));

const makeHookLayer = (files: Record<string, string>) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) => Effect.succeed(files[path] ?? null),
    writeFile: () => Effect.succeed(undefined),
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    spawnGitChecked: () => Effect.succeed({ kind: 'exit-nonzero' as const }),
    fileExists: () => Effect.succeed(false),
  });

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
          project: { name: 'Cape' },
          labels: { nodes: [{ name: 'feature' }, { name: 'cape' }] },
          state: { name: 'In Progress', type: 'started' },
          children: {
            nodes: [
              {
                identifier: 'ABU-56',
                title: 'Tracker cache CLI',
                project: 'Cape CLI',
                labels: ['chore', { name: 'cape' }],
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
      project: 'Cape',
      type: 'feature',
      status: 'In Progress',
      tasks: [
        {
          id: 'ABU-56',
          title: 'Tracker cache CLI',
          project: 'Cape CLI',
          type: 'chore',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ],
    });
    console_.restore();
  });

  it('stores the epic gitBranchName for branch matching', async () => {
    const root = makeRoot();
    const console_ = spyConsole();

    await Effect.runPromise(
      run([
        'tracker',
        'cache-epic',
        JSON.stringify({
          identifier: 'ABU-15',
          title: 'Cape V2',
          gitBranchName: 'abu-15-cape-v2',
          state: { name: 'In Progress', type: 'started' },
        }),
        '--no-tasks',
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    expect(readCache(root).epics['ABU-15'].gitBranchName).toBe('abu-15-cape-v2');
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
        '--no-tasks',
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const cache = readCache(root);
    expect(Object.keys(cache.epics)).toEqual(['ABU-16']);
    expect(cache.epics['ABU-16'].title).toBe('Fresh epic');
    console_.restore();
  });

  it('rejects children without issue ids instead of dropping them silently', async () => {
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
          JSON.stringify({
            identifier: 'AI-9',
            title: 'Plan with one malformed child',
            state: { name: 'In Progress', type: 'started' },
            children: {
              nodes: [
                { identifier: 'AI-10', title: 'a', state: { name: 'Todo', type: 'unstarted' } },
                { title: 'orphan with no id' },
              ],
            },
          }),
        ]).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain(
      'given 2 children but only 1 carry an issue id',
    );
    console_.restore();
  });

  it('reports missing child ids rather than no children when every child lacks one', async () => {
    makeRoot();
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run([
          'tracker',
          'cache-epic',
          JSON.stringify({
            identifier: 'AI-9',
            title: 'Plan whose children all lack ids',
            state: { name: 'In Progress', type: 'started' },
            children: { nodes: [{ title: 'orphan with no id' }] },
          }),
        ]).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(JSON.parse(console_.errorOutput()).error).toContain('carry an issue id');
    console_.restore();
  });

  it('rejects a childless epic without overwriting the existing cache', async () => {
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
          JSON.stringify({
            identifier: 'AI-9',
            title: 'Plan cached straight from get_issue',
            state: { name: 'In Progress', type: 'started' },
            children: { nodes: [] },
          }),
        ]).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain('list_issues(parentId: AI-9)');
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
            project: 'Cape',
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
            project: { name: 'Cape CLI' },
            labels: { nodes: [{ name: 'bug' }, 'cape'] },
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
      project: 'Cape',
      status: 'In Progress',
      tasks: [
        {
          id: 'ABU-57',
          title: 'Rewire chains',
          project: 'Cape CLI',
          type: 'bug',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ],
    });
    console_.restore();
  });

  it('reads the issue type from a capitalized ungrouped label', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(
      trackerPath(root),
      JSON.stringify({
        version: 1,
        timestamp: 1,
        epics: {
          'ABU-15': { id: 'ABU-15', title: 'Cape V2', status: 'In Progress', tasks: [] },
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
            labels: { nodes: [{ name: 'Bug' }, { name: 'Frontend' }] },
            state: { name: 'Todo', type: 'unstarted' },
          },
        ]),
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const cache = readCache(root);
    expect(cache.epics['ABU-15'].tasks[0].type).toBe('Bug');
    console_.restore();
  });

  it('preserves the cached epic gitBranchName when replacing tasks', async () => {
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
            gitBranchName: 'abu-15-cape-v2',
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

    expect(readCache(root).epics['ABU-15'].gitBranchName).toBe('abu-15-cape-v2');
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

  it('rejects an empty task array without seeding a stub epic', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    const existing = JSON.stringify({ version: 1, timestamp: 1, epics: {} });
    writeFileSync(trackerPath(root), existing);
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['tracker', 'cache-tasks', 'AI-9', '[]']).pipe(Effect.provide(makeTestCommandLayers())),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe(existing);
    expect(JSON.parse(console_.errorOutput()).error).toContain('no tasks given for AI-9');
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

  it('derives the state type from the status when the argument is omitted', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(
      trackerPath(root),
      JSON.stringify({
        version: 1,
        timestamp: 1,
        epics: {
          'AI-15': {
            id: 'AI-15',
            title: 'Cape V2',
            status: 'In Progress',
            tasks: [
              { id: 'AI-56', title: 'Tracker cache CLI', status: 'Todo', stateType: 'unstarted' },
            ],
          },
        },
      }),
    );
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['tracker', 'cache-status', 'AI-56', 'Done']).pipe(
        Effect.provide(makeTestCommandLayers()),
      ),
    );

    const cache = readCache(root);
    expect(cache.epics['AI-15'].tasks[0]).toEqual({
      id: 'AI-56',
      title: 'Tracker cache CLI',
      status: 'Done',
      stateType: 'completed',
    });
    console_.restore();
  });

  it('fails when the target issue is absent locally without creating a cache', async () => {
    const root = makeRoot();
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['tracker', 'cache-status', 'ABU-99', 'Done', 'completed']).pipe(
          Effect.provide(makeTestCommandLayers()),
        ),
      ),
    ).rejects.toThrow();

    expect(() => readFileSync(trackerPath(root), 'utf-8')).toThrow();
    console_.restore();
  });

  it('fails on a corrupt cache without touching it', async () => {
    const root = makeRoot();
    mkdirSync(`${root}/hooks/context`, { recursive: true });
    writeFileSync(trackerPath(root), 'not json');
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['tracker', 'cache-status', 'ABU-99', 'Done', 'completed']).pipe(
          Effect.provide(makeTestCommandLayers()),
        ),
      ),
    ).rejects.toThrow();

    expect(readFileSync(trackerPath(root), 'utf-8')).toBe('not json');
    console_.restore();
  });
});

describe('tracker cache validation', () => {
  it('accepts and round-trips a cache that omits optional project and type fields', async () => {
    const cache = {
      version: 1,
      timestamp: Date.now(),
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
    };

    const result = await Effect.runPromise(
      readTrackerCache().pipe(
        Effect.provide(makeHookLayer({ [trackerCachePath('/test')]: JSON.stringify(cache) })),
      ),
    );

    expect(result).toEqual(cache);
  });

  it('rejects optional project and type fields when present but not strings', async () => {
    const cache = {
      version: 1,
      timestamp: Date.now(),
      epics: {
        'ABU-15': {
          id: 'ABU-15',
          title: 'Cape V2',
          project: { name: 'Cape' },
          type: 7,
          status: 'In Progress',
          tasks: [
            {
              id: 'ABU-56',
              title: 'Tracker cache CLI',
              project: ['Cape CLI'],
              type: false,
              status: 'Todo',
              stateType: 'unstarted',
            },
          ],
        },
      },
    };

    const result = await Effect.runPromise(
      readTrackerCache().pipe(
        Effect.provide(makeHookLayer({ [trackerCachePath('/test')]: JSON.stringify(cache) })),
      ),
    );

    expect(result).toBeNull();
  });
});

describe('cape tracker path', () => {
  it('prints the resolved cache file for this repository', async () => {
    const root = makeRoot();
    const console_ = spyConsole();

    await Effect.runPromise(run(['tracker', 'path']).pipe(Effect.provide(makeTestCommandLayers())));

    expect(console_.output()).toBe(trackerPath(root));
    console_.restore();
  });
});

describe('cape tracker show', () => {
  it('prints an empty cache when none has been written yet', async () => {
    makeRoot();
    const console_ = spyConsole();

    await Effect.runPromise(run(['tracker', 'show']).pipe(Effect.provide(makeTestCommandLayers())));
    const printed = JSON.parse(console_.output());
    console_.restore();

    expect(printed).toEqual({ version: 1, timestamp: 0, epics: {} });
  });

  it('prints the cache that cache-epic wrote', async () => {
    makeRoot();
    await Effect.runPromise(
      run([
        'tracker',
        'cache-epic',
        JSON.stringify({
          identifier: 'ABU-15',
          title: 'Cape V2',
          state: { name: 'Todo', type: 'unstarted' },
          children: { nodes: [] },
        }),
        '--no-tasks',
      ]).pipe(Effect.provide(makeTestCommandLayers())),
    );

    const console_ = spyConsole();
    await Effect.runPromise(run(['tracker', 'show']).pipe(Effect.provide(makeTestCommandLayers())));
    const printed = JSON.parse(console_.output());
    console_.restore();

    expect(printed.epics['ABU-15'].title).toBe('Cape V2');
  });
});
