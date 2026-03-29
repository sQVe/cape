import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { GitService, getGitDiff } from '../services/git';
import type { DiffScope, GitContext } from '../services/git';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
} from '../testStubs';

const run = Command.runWith(main, { version: '0.1.0' });

const makeTestGitLayer = (diffResult = 'diff --git a/file.ts b/file.ts') =>
  Layer.succeed(GitService)({
    getContext: () =>
      Effect.succeed({
        mainBranch: 'main',
        currentBranch: 'feature/test',
        status: [],
        diffStat: '',
        recentLog: [],
      }),
    getDiff: (_scope: DiffScope) => Effect.succeed(diffResult),
    validateBranch: () => Effect.succeed({ valid: true, errors: [] }),
  });

const makeErrorGitLayer = () =>
  Layer.succeed(GitService)({
    getContext: () => Effect.fail(new Error('not a git repository')),
    getDiff: () => Effect.fail(new Error('not a git repository')),
    validateBranch: () => Effect.fail(new Error('not a git repository')),
  });

const makeScopeCapturingLayer = () => {
  let captured: DiffScope | null = null;
  const layer = Layer.succeed(GitService)({
    getContext: () =>
      Effect.succeed({
        mainBranch: 'main',
        currentBranch: 'feature/test',
        status: [],
        diffStat: '',
        recentLog: [],
      } satisfies GitContext),
    getDiff: (scope: DiffScope) => {
      captured = scope;
      return Effect.succeed(`diff for ${scope}`);
    },
    validateBranch: () => Effect.succeed({ valid: true, errors: [] }),
  });
  return { layer, getCaptured: () => captured };
};

const testLayers = (gitLayer: Layer.Layer<GitService>) =>
  Layer.mergeAll(
    NodeServices.layer,
    gitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubHookLayer,
    stubPrLayer,
    stubValidateLayer,
  );

describe('git diff command', () => {
  it('is wired as a subcommand of cape git', async () => {
    await Effect.runPromise(
      run(['git', 'diff', '--help']).pipe(Effect.provide(testLayers(makeTestGitLayer()))),
    );
  });

  it('cape git --help lists diff subcommand', async () => {
    const layers = testLayers(makeTestGitLayer());
    await Effect.runPromise(run(['git', '--help']).pipe(Effect.provide(layers)));
  });

  it('defaults to unstaged scope when no argument given', async () => {
    const { layer, getCaptured } = makeScopeCapturingLayer();
    await Effect.runPromise(run(['git', 'diff']).pipe(Effect.provide(testLayers(layer))));
    expect(getCaptured()).toBe('unstaged');
  });

  it('passes staged scope to service', async () => {
    const { layer, getCaptured } = makeScopeCapturingLayer();
    await Effect.runPromise(run(['git', 'diff', 'staged']).pipe(Effect.provide(testLayers(layer))));
    expect(getCaptured()).toBe('staged');
  });

  it('passes branch scope to service', async () => {
    const { layer, getCaptured } = makeScopeCapturingLayer();
    await Effect.runPromise(
      run(['git', 'diff', 'branch']).pipe(Effect.provide(testLayers(layer))),
    );
    expect(getCaptured()).toBe('branch');
  });

  it('passes pr scope to service', async () => {
    const { layer, getCaptured } = makeScopeCapturingLayer();
    await Effect.runPromise(run(['git', 'diff', 'pr']).pipe(Effect.provide(testLayers(layer))));
    expect(getCaptured()).toBe('pr');
  });
});

describe('getGitDiff', () => {
  it('returns diff content from service', async () => {
    const result = await Effect.runPromise(
      getGitDiff('unstaged').pipe(Effect.provide(makeTestGitLayer('fake diff output'))),
    );
    expect(result).toBe('fake diff output');
  });

  it('propagates error when not in a git repo', async () => {
    await expect(
      Effect.runPromise(getGitDiff('unstaged').pipe(Effect.provide(makeErrorGitLayer()))),
    ).rejects.toThrow('not a git repository');
  });
});
