import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { GitService, getGitContext } from '../services/git';
import type { GitContext } from '../services/git';
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

const makeTestGitLayer = (overrides: Partial<GitContext> = {}) =>
  Layer.succeed(GitService)({
    getContext: () =>
      Effect.succeed({
        mainBranch: 'main',
        currentBranch: 'feature/test',
        status: ['M  file.ts', '?? new.ts'],
        diffStat: ' 2 files changed, 10 insertions(+), 3 deletions(-)',
        recentLog: ['abc1234 feat: add thing', 'def5678 fix: broken thing'],
        ...overrides,
      }),
    getDiff: () => Effect.succeed(''),
  });

const makeErrorGitLayer = () =>
  Layer.succeed(GitService)({
    getContext: () => Effect.fail(new Error('not a git repository')),
    getDiff: () => Effect.fail(new Error('not a git repository')),
  });

const testLayers = Layer.mergeAll(
  NodeServices.layer,
  makeTestGitLayer(),
  stubDetectLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubBrLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
);

describe('git context command', () => {
  it('is wired as a subcommand of cape git', async () => {
    await Effect.runPromise(run(['git', 'context', '--help']).pipe(Effect.provide(testLayers)));
  });

  it('cape --help lists git subcommand', async () => {
    await Effect.runPromise(run(['--help']).pipe(Effect.provide(testLayers)));
  });

  it('cape git --help lists context subcommand', async () => {
    await Effect.runPromise(run(['git', '--help']).pipe(Effect.provide(testLayers)));
  });
});

describe('getGitContext', () => {
  it('propagates error when not in a git repo', async () => {
    await expect(
      Effect.runPromise(getGitContext.pipe(Effect.provide(makeErrorGitLayer()))),
    ).rejects.toThrow('not a git repository');
  });
});
