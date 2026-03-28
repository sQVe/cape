import { execFileSync } from 'node:child_process';

import { Effect, Layer } from 'effect';

import { CommitService } from './commit';

const stageAndCommit = (files: readonly string[], message: string) =>
  Effect.try({
    try: () => {
      execFileSync('git', ['add', '--', ...files], { encoding: 'utf-8' });
      execFileSync('git', ['commit', '-m', message], { encoding: 'utf-8' });
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('commit failed', { cause: error }),
  });

export const CommitServiceLive = Layer.succeed(CommitService)({
  stageAndCommit,
});
