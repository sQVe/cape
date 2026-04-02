import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import type { BranchValidation } from '../services/git';
import { GitService, getValidateBranch } from '../services/git';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubHookLayer,
  stubPrLayer,
  stubConformLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';

const run = Command.runWith(main, { version: '0.1.0' });

const defaultValidation: BranchValidation = { valid: true, errors: [] };
const makeGitLayer = (result = defaultValidation) =>
  Layer.succeed(GitService)({
    getContext: () =>
      Effect.succeed({
        mainBranch: 'main',
        currentBranch: 'main',
        status: [],
        diffStat: '',
        recentLog: [],
      }),
    getDiff: () => Effect.succeed(''),
    validateBranch: () => Effect.succeed(result),
    createBranch: () => Effect.succeed({ created: true, branch: 'feat/test' }),
  });

const makeCapturingLayer = () => {
  let captured: string | null = null;
  const layer = Layer.succeed(GitService)({
    getContext: () =>
      Effect.succeed({
        mainBranch: 'main',
        currentBranch: 'main',
        status: [],
        diffStat: '',
        recentLog: [],
      }),
    getDiff: () => Effect.succeed(''),
    validateBranch: (name: string) => {
      captured = name;
      return Effect.succeed({ valid: true, errors: [] });
    },
    createBranch: () => Effect.succeed({ created: true, branch: 'feat/test' }),
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
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
  );

describe('git validate-branch command', () => {
  it('is wired as a subcommand of cape git', async () => {
    await Effect.runPromise(
      run(['git', 'validate-branch', '--help']).pipe(Effect.provide(testLayers(makeGitLayer()))),
    );
  });

  it('passes branch name argument to service', async () => {
    const { layer, getCaptured } = makeCapturingLayer();
    await Effect.runPromise(
      run(['git', 'validate-branch', 'feat/my-feature']).pipe(Effect.provide(testLayers(layer))),
    );
    expect(getCaptured()).toBe('feat/my-feature');
  });
});

describe('getValidateBranch', () => {
  it('returns validation result from service', async () => {
    const result = await Effect.runPromise(
      getValidateBranch('feat/test').pipe(
        Effect.provide(makeGitLayer({ valid: true, errors: [] })),
      ),
    );
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('returns errors for invalid branch', async () => {
    const validation = { valid: false, errors: ['invalid ref format'] };
    const result = await Effect.runPromise(
      getValidateBranch('bad..name').pipe(Effect.provide(makeGitLayer(validation))),
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('invalid ref format');
  });
});
