import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { HookService, sessionStart } from '../services/hook';
import {
  stubCheckLayer,
  stubCommitLayer,
  stubConformLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });
const statePath = '/test/hooks/context/state.json';
const trackerPath = '/test/hooks/context/tracker.json';
const skillPath = '/test/skills/don-cape/SKILL.md';

const trackerCache = () => ({
  version: 1,
  timestamp: Date.now(),
  epics: {
    'ABU-50': {
      id: 'ABU-50',
      title: 'Worktree skill',
      status: 'In Progress',
      tasks: [
        {
          id: 'ABU-51',
          title: 'Stamp command',
          status: 'Done',
          stateType: 'completed',
        },
        {
          id: 'ABU-52',
          title: 'Skill markdown',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ],
    },
  },
});

const makeHookLayer = (
  initialFiles: Record<string, string> = {},
  gitResponses: Record<string, string | null> = {},
) => {
  const files: Record<string, string | undefined> = { ...initialFiles };
  const removedFiles: string[] = [];
  const hookLayer = Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) => Effect.succeed(files[path] ?? null),
    writeFile: (path, content) => {
      files[path] = content;
      return Effect.succeed(undefined);
    },
    removeFile: (path) => {
      removedFiles.push(path);
      files[path] = undefined;
      return Effect.succeed(undefined);
    },
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    spawnGit: (args) => Effect.succeed(gitResponses[args.join(' ')] ?? null),
    fileExists: (path) => Effect.succeed(files[path] != null),
  });
  return {
    hookLayer,
    files,
    removedFiles,
  };
};

const makeLayers = (hookLayer: Layer.Layer<HookService>) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    hookLayer,
    stubPrLayer,
    stubValidateLayer,
    stubConformLayer,
  );

describe('cape worktree start', () => {
  it('writes flowPhase with the epic id and default BUILD phase', async () => {
    const { hookLayer, files } = makeHookLayer({
      [statePath]: JSON.stringify({ workflowActive: { value: true, timestamp: Date.now() } }),
    });
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['worktree', 'start', 'ABU-50']).pipe(Effect.provide(makeLayers(hookLayer))),
    );

    const output = JSON.parse(console_.output());
    const state = JSON.parse(files[statePath] as string);
    expect(output).toEqual({ stamped: true, issueId: 'ABU-50', phase: 'BUILD' });
    expect(state.workflowActive.value).toBe(true);
    expect(state.flowPhase.issueId).toBe('ABU-50');
    expect(state.flowPhase.phase).toBe('BUILD');
    expect(state.flowPhase.timestamp).toBeTypeOf('number');
    console_.restore();
  });

  it('accepts an explicit PLAN/BUILD/SHIP phase', async () => {
    const { hookLayer, files } = makeHookLayer();
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['worktree', 'start', 'ABU-50', '--phase', 'PLAN']).pipe(
        Effect.provide(makeLayers(hookLayer)),
      ),
    );

    const output = JSON.parse(console_.output());
    const state = JSON.parse(files[statePath] as string);
    expect(output.phase).toBe('PLAN');
    expect(state.flowPhase.phase).toBe('PLAN');
    console_.restore();
  });

  it('rejects a blank epic id without writing state', async () => {
    const { hookLayer, files } = makeHookLayer();
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['worktree', 'start', '   ']).pipe(Effect.provide(makeLayers(hookLayer))),
      ),
    ).rejects.toThrow();

    expect(files[statePath]).toBeUndefined();
    expect(JSON.parse(console_.errorOutput()).error).toContain('epic id is required');
    console_.restore();
  });

  it('rejects an invalid phase without writing state', async () => {
    const { hookLayer, files } = makeHookLayer();
    const console_ = spyConsole();

    await expect(
      Effect.runPromise(
        run(['worktree', 'start', 'ABU-50', '--phase', 'debugging']).pipe(
          Effect.provide(makeLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow();

    expect(files[statePath]).toBeUndefined();
    expect(JSON.parse(console_.errorOutput()).error).toContain('phase must be one of');
    console_.restore();
  });

  it('creates state cleanly when state.json is missing', async () => {
    const { hookLayer, files } = makeHookLayer();
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['worktree', 'start', 'ABU-50']).pipe(Effect.provide(makeLayers(hookLayer))),
    );

    const state = JSON.parse(files[statePath] as string);
    expect(Object.keys(state)).toEqual(['flowPhase']);
    expect(state.flowPhase.issueId).toBe('ABU-50');
    console_.restore();
  });

  it('overwrites corrupt state.json cleanly', async () => {
    const { hookLayer, files } = makeHookLayer({ [statePath]: 'not json' });
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['worktree', 'start', 'ABU-50']).pipe(Effect.provide(makeLayers(hookLayer))),
    );

    const state = JSON.parse(files[statePath] as string);
    expect(Object.keys(state)).toEqual(['flowPhase']);
    expect(state.flowPhase.issueId).toBe('ABU-50');
    console_.restore();
  });

  it('overwrites a previous stamped epic id', async () => {
    const { hookLayer, files } = makeHookLayer({
      [statePath]: JSON.stringify({
        flowPhase: { phase: 'PLAN', issueId: 'ABU-49', timestamp: Date.now() },
      }),
    });
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['worktree', 'start', 'ABU-50', '--phase', 'SHIP']).pipe(
        Effect.provide(makeLayers(hookLayer)),
      ),
    );

    const state = JSON.parse(files[statePath] as string);
    expect(state.flowPhase.issueId).toBe('ABU-50');
    expect(state.flowPhase.phase).toBe('SHIP');
    console_.restore();
  });

  it('makes the session-start banner render the stamped epic from tracker cache', async () => {
    const { hookLayer, files } = makeHookLayer(
      {
        [skillPath]: 'don cape',
        [trackerPath]: JSON.stringify(trackerCache()),
      },
      { 'branch --show-current': 'feat/abu-50' },
    );
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['worktree', 'start', 'ABU-50']).pipe(Effect.provide(makeLayers(hookLayer))),
    );
    console_.restore();

    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(hookLayer)));

    expect(files[statePath]).toContain('ABU-50');
    expect(result.additionalContext).toContain('| Epic   ABU-50  Worktree skill');
    expect(result.additionalContext).toContain('| Phase  BUILD  (1/2 tasks done)');
    expect(result.additionalContext).toContain('| Next   ABU-52 - Skill markdown');
    expect(result.additionalContext).toContain('| Branch feat/abu-50 (worktree)');
  });
});

describe('cape worktree stop', () => {
  it('removes flowPhase and leaves other state keys intact', async () => {
    const { hookLayer, files } = makeHookLayer({
      [statePath]: JSON.stringify({
        flowPhase: { phase: 'BUILD', issueId: 'ABU-50', timestamp: Date.now() },
        workflowActive: { value: true, timestamp: Date.now() },
      }),
    });
    const console_ = spyConsole();

    await Effect.runPromise(run(['worktree', 'stop']).pipe(Effect.provide(makeLayers(hookLayer))));

    const output = JSON.parse(console_.output());
    const state = JSON.parse(files[statePath] as string);
    expect(output).toEqual({ cleared: true });
    expect(state.flowPhase).toBeUndefined();
    expect(state.workflowActive.value).toBe(true);
    console_.restore();
  });

  it('succeeds as a no-op when no flowPhase exists', async () => {
    const { hookLayer, files, removedFiles } = makeHookLayer();
    const console_ = spyConsole();

    await Effect.runPromise(run(['worktree', 'stop']).pipe(Effect.provide(makeLayers(hookLayer))));

    expect(JSON.parse(console_.output())).toEqual({ cleared: true });
    expect(files[statePath]).toBeUndefined();
    expect(removedFiles).toEqual([]);
    console_.restore();
  });

  it('removes state.json when flowPhase is the only key', async () => {
    const { hookLayer, files, removedFiles } = makeHookLayer({
      [statePath]: JSON.stringify({
        flowPhase: { phase: 'BUILD', issueId: 'ABU-50', timestamp: Date.now() },
      }),
    });
    const console_ = spyConsole();

    await Effect.runPromise(run(['worktree', 'stop']).pipe(Effect.provide(makeLayers(hookLayer))));

    expect(JSON.parse(console_.output())).toEqual({ cleared: true });
    expect(files[statePath]).toBeUndefined();
    expect(removedFiles).toEqual([statePath]);
    console_.restore();
  });
});
