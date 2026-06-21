import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { CheckService } from '../services/check';
import type { CheckResult } from '../services/check';
import { HookService } from '../services/hook';
import {
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubConformLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });

const makeTrackerCache = (
  tasks: readonly {
    readonly id: string;
    readonly title: string;
    readonly status: string;
    readonly stateType: string;
  }[] = [],
) =>
  JSON.stringify({
    version: 1,
    timestamp: Date.now(),
    epics: {
      'test-epic': {
        id: 'test-epic',
        title: 'Test epic',
        status: 'In Progress',
        tasks,
      },
    },
  });

const makeHookLayer = (trackerCache = makeTrackerCache()) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) =>
      Effect.succeed(path === '/test/hooks/context/tracker.json' ? trackerCache : null),
    writeFile: () => Effect.succeed(undefined),
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    fileExists: () => Effect.succeed(false),
  });

const makeCheckLayer = (results: CheckResult[] = []) =>
  Layer.succeed(CheckService)({
    runChecks: () => Effect.succeed(results),
  });

const testLayers = (hookLayer: Layer.Layer<HookService>, checkLayer: Layer.Layer<CheckService>) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCommitLayer,
    hookLayer,
    stubPrLayer,
    stubValidateLayer,
    stubConformLayer,
    checkLayer,
  );

describe('epic verify command', () => {
  it('is wired as a subcommand of cape epic', async () => {
    await Effect.runPromise(
      run(['epic', 'verify', '--help']).pipe(
        Effect.provide(testLayers(makeHookLayer(), makeCheckLayer())),
      ),
    );
  });

  it('returns verified:true when all tasks closed and checks pass', async () => {
    const console_ = spyConsole();
    const tasks = [
      { id: 'test.1', title: 'Task 1', status: 'Done', stateType: 'completed' },
      { id: 'test.2', title: 'Task 2', status: 'Closed', stateType: 'completed' },
    ];
    const checks: CheckResult[] = [{ check: 'vitest', passed: true, output: 'ok' }];
    await Effect.runPromise(
      run(['epic', 'verify', 'test-epic']).pipe(
        Effect.provide(testLayers(makeHookLayer(makeTrackerCache(tasks)), makeCheckLayer(checks))),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result.verified).toBe(true);
    expect(result.openTasks).toEqual([]);
    expect(result.checksPassed).toBe(true);
    console_.restore();
  });

  it('returns verified:false when tasks are still open', async () => {
    const console_ = spyConsole();
    const tasks = [
      { id: 'test.1', title: 'Task 1', status: 'Done', stateType: 'completed' },
      { id: 'test.2', title: 'Task 2', status: 'Todo', stateType: 'unstarted' },
    ];
    await expect(
      Effect.runPromise(
        run(['epic', 'verify', 'test-epic']).pipe(
          Effect.provide(testLayers(makeHookLayer(makeTrackerCache(tasks)), makeCheckLayer())),
        ),
      ),
    ).rejects.toThrow('epic verification failed for test-epic: 1 open task(s), checks passed');
    const result = JSON.parse(console_.output());
    expect(result.verified).toBe(false);
    expect(result.openTasks).toEqual([{ id: 'test.2', title: 'Task 2', status: 'Todo' }]);
    console_.restore();
  });

  it('returns verified:false when checks fail', async () => {
    const console_ = spyConsole();
    const tasks = [{ id: 'test.1', title: 'Task 1', status: 'Done', stateType: 'completed' }];
    const checks: CheckResult[] = [{ check: 'vitest', passed: false, output: 'FAIL' }];
    await expect(
      Effect.runPromise(
        run(['epic', 'verify', 'test-epic']).pipe(
          Effect.provide(
            testLayers(makeHookLayer(makeTrackerCache(tasks)), makeCheckLayer(checks)),
          ),
        ),
      ),
    ).rejects.toThrow('epic verification failed for test-epic: 0 open task(s), checks failed');
    const result = JSON.parse(console_.output());
    expect(result.verified).toBe(false);
    expect(result.checksPassed).toBe(false);
    console_.restore();
  });
});
