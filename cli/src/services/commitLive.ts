import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { CommitService } from './commit';

const stageFiles = (files: readonly string[]) => {
  const existing = files.filter((f) => existsSync(f));
  const deleted = files.filter((f) => !existsSync(f));

  if (existing.length > 0) {
    execFileSync('git', ['add', '--', ...existing], { encoding: 'utf-8' });
  }
  if (deleted.length > 0) {
    execFileSync('git', ['rm', '--quiet', '--', ...deleted], { encoding: 'utf-8' });
  }
};

const stageAndCommit = (files: readonly string[], message: string) =>
  Effect.try({
    try: () => {
      stageFiles(files);
      execFileSync('git', ['commit', '-m', message], { encoding: 'utf-8' });
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('commit failed', { cause: error }),
  });

const commitNoEdit = () =>
  Effect.try({
    try: () => {
      execFileSync('git', ['commit', '--no-edit'], { encoding: 'utf-8' });
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('commit failed', { cause: error }),
  });

export const CommitServiceLive = Layer.succeed(CommitService)({
  stageAndCommit,
  commitNoEdit,
});
