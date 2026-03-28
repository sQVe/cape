import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, Result } from 'effect';
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
  });

const makeErrorGitLayer = () =>
  Layer.succeed(GitService)({
    getContext: () => Effect.fail(new Error('not a git repository')),
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
  it('returns mainBranch from GitService', async () => {
    const result = await Effect.runPromise(getGitContext.pipe(Effect.provide(makeTestGitLayer())));
    expect(result.mainBranch).toBe('main');
  });

  it('returns currentBranch from GitService', async () => {
    const result = await Effect.runPromise(getGitContext.pipe(Effect.provide(makeTestGitLayer())));
    expect(result.currentBranch).toBe('feature/test');
  });

  it('returns status lines as array', async () => {
    const result = await Effect.runPromise(getGitContext.pipe(Effect.provide(makeTestGitLayer())));
    expect(result.status).toEqual(['M  file.ts', '?? new.ts']);
  });

  it('returns diffStat summary', async () => {
    const result = await Effect.runPromise(getGitContext.pipe(Effect.provide(makeTestGitLayer())));
    expect(result.diffStat).toBe(' 2 files changed, 10 insertions(+), 3 deletions(-)');
  });

  it('returns recentLog entries', async () => {
    const result = await Effect.runPromise(getGitContext.pipe(Effect.provide(makeTestGitLayer())));
    expect(result.recentLog).toEqual(['abc1234 feat: add thing', 'def5678 fix: broken thing']);
  });

  it('propagates error when not in a git repo', async () => {
    const result = await Effect.runPromise(
      getGitContext.pipe(Effect.provide(makeErrorGitLayer()), Effect.result),
    );
    expect(Result.isFailure(result)).toBe(true);
  });
});
