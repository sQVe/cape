import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import type { ChildStatus } from '../services/brValidate';
import { BrValidateService } from '../services/brValidate';
import { CheckService } from '../services/check';
import type { CheckResult } from '../services/check';
import {
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
  stubPrLayer,
  stubConformLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });

const makeBrLayer = (children: ChildStatus[] = []) =>
  Layer.succeed(BrValidateService)({
    show: () =>
      Effect.succeed({
        id: 'test-epic',
        issue_type: 'epic',
        description: '',
        design: null,
      }),
    updateDesign: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    listChildren: () => Effect.succeed(children),
  });

const makeCheckLayer = (results: CheckResult[] = []) =>
  Layer.succeed(CheckService)({
    runChecks: () => Effect.succeed(results),
  });

const testLayers = (
  brLayer: Layer.Layer<BrValidateService>,
  checkLayer: Layer.Layer<CheckService>,
) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCommitLayer,
    stubHookLayer,
    stubPrLayer,
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
    brLayer,
    checkLayer,
  );

describe('epic verify command', () => {
  it('is wired as a subcommand of cape epic', async () => {
    await Effect.runPromise(
      run(['epic', 'verify', '--help']).pipe(
        Effect.provide(testLayers(makeBrLayer(), makeCheckLayer())),
      ),
    );
  });

  it('returns verified:true when all tasks closed and checks pass', async () => {
    const console_ = spyConsole();
    const children: ChildStatus[] = [
      { id: 'test.1', title: 'Task 1', status: 'closed' },
      { id: 'test.2', title: 'Task 2', status: 'closed' },
    ];
    const checks: CheckResult[] = [{ check: 'vitest', passed: true, output: 'ok' }];
    await Effect.runPromise(
      run(['epic', 'verify', 'test-epic']).pipe(
        Effect.provide(testLayers(makeBrLayer(children), makeCheckLayer(checks))),
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
    const children: ChildStatus[] = [
      { id: 'test.1', title: 'Task 1', status: 'closed' },
      { id: 'test.2', title: 'Task 2', status: 'open' },
    ];
    await expect(
      Effect.runPromise(
        run(['epic', 'verify', 'test-epic']).pipe(
          Effect.provide(testLayers(makeBrLayer(children), makeCheckLayer())),
        ),
      ),
    ).rejects.toThrow('epic verification failed for test-epic: 1 open task(s), checks passed');
    const result = JSON.parse(console_.output());
    expect(result.verified).toBe(false);
    expect(result.openTasks).toEqual([{ id: 'test.2', title: 'Task 2', status: 'open' }]);
    console_.restore();
  });

  it('returns verified:false when checks fail', async () => {
    const console_ = spyConsole();
    const children: ChildStatus[] = [{ id: 'test.1', title: 'Task 1', status: 'closed' }];
    const checks: CheckResult[] = [{ check: 'vitest', passed: false, output: 'FAIL' }];
    await expect(
      Effect.runPromise(
        run(['epic', 'verify', 'test-epic']).pipe(
          Effect.provide(testLayers(makeBrLayer(children), makeCheckLayer(checks))),
        ),
      ),
    ).rejects.toThrow('epic verification failed for test-epic: 0 open task(s), checks failed');
    const result = JSON.parse(console_.output());
    expect(result.verified).toBe(false);
    expect(result.checksPassed).toBe(false);
    console_.restore();
  });
});
