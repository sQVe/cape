import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import type { BranchValidation } from '../services/git';
import { GitService } from '../services/git';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubConformLayer,
  stubDetectLayer,
  stubHookLayer,
  stubPrLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });

const defaultValidation: BranchValidation = { valid: true, errors: [] };

const defaultCreateResult = { created: true, branch: 'feat/test' };

const makeGitLayer = (
  validation = defaultValidation,
  createResult = defaultCreateResult,
) =>
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
    validateBranch: () => Effect.succeed(validation),
    createBranch: () => Effect.succeed(createResult),
  });

const makeCapturingLayer = () => {
  let capturedValidate: string | null = null;
  let capturedCreate: string | null = null;
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
      capturedValidate = name;
      return Effect.succeed({ valid: true, errors: [] });
    },
    createBranch: (name: string) => {
      capturedCreate = name;
      return Effect.succeed({ created: true, branch: name });
    },
  });
  return {
    layer,
    getCapturedValidate: () => capturedValidate,
    getCapturedCreate: () => capturedCreate,
  };
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

describe('git create-branch command', () => {
  it('is wired as a subcommand of cape git', async () => {
    await Effect.runPromise(
      run(['git', 'create-branch', '--help']).pipe(Effect.provide(testLayers(makeGitLayer()))),
    );
  });

  it('passes branch name to validate and create services', async () => {
    const { layer, getCapturedValidate, getCapturedCreate } = makeCapturingLayer();
    await Effect.runPromise(
      run(['git', 'create-branch', 'feat/my-feature']).pipe(Effect.provide(testLayers(layer))),
    );
    expect(getCapturedValidate()).toBe('feat/my-feature');
    expect(getCapturedCreate()).toBe('feat/my-feature');
  });

  it('does not create branch when validation fails', async () => {
    const validation: BranchValidation = {
      valid: false,
      errors: ['branch already exists locally: feat/dup'],
    };
    const result = Effect.runPromise(
      run(['git', 'create-branch', 'feat/dup']).pipe(
        Effect.provide(testLayers(makeGitLayer(validation))),
      ),
    );
    await expect(result).rejects.toThrow();
  });

  it('outputs JSON with created and branch on success', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['git', 'create-branch', 'feat/my-feature']).pipe(Effect.provide(testLayers(makeGitLayer()))),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ created: true, branch: 'feat/test' });
    console_.restore();
  });

  it('outputs JSON error when validation fails', async () => {
    const console_ = spyConsole();
    const validation: BranchValidation = {
      valid: false,
      errors: ['missing prefix', 'too long'],
    };
    await expect(
      Effect.runPromise(
        run(['git', 'create-branch', 'bad-name']).pipe(
          Effect.provide(testLayers(makeGitLayer(validation))),
        ),
      ),
    ).rejects.toThrow();
    const result = JSON.parse(console_.errorOutput());
    expect(result.error).toBe('missing prefix, too long');
    console_.restore();
  });

  it('fails when git create-branch errors', async () => {
    const gitLayer = Layer.succeed(GitService)({
      getContext: () =>
        Effect.succeed({
          mainBranch: 'main',
          currentBranch: 'main',
          status: [],
          diffStat: '',
          recentLog: [],
        }),
      getDiff: () => Effect.succeed(''),
      validateBranch: () => Effect.succeed({ valid: true, errors: [] }),
      createBranch: () => Effect.fail(new Error('git checkout failed')),
    });

    const result = Effect.runPromise(
      run(['git', 'create-branch', 'feat/broken']).pipe(Effect.provide(testLayers(gitLayer))),
    );
    await expect(result).rejects.toThrow();
  });
});
