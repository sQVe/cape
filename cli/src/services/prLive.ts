import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { readFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { PrService } from './pr';

const fileExists = (path: string) => Effect.succeed(existsSync(path));

const readFile = (path: string) =>
  Effect.try({
    try: () => readFileUtf8(path),
    catch: (error) => (error instanceof Error ? error : new Error(`failed to read file: ${path}`)),
  });

const readStdin = () =>
  Effect.try({
    try: () => readFileSync('/dev/stdin', 'utf-8').trim(),
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to read stdin', { cause: error }),
  });

const spawnGh = (args: readonly string[]) =>
  Effect.try({
    try: () =>
      execFileSync('gh', [...args], {
        encoding: 'utf-8',
        timeout: 30_000,
      }).trim(),
    catch: (error) => {
      if (error != null && typeof error === 'object' && 'stderr' in error) {
        const stderr = String((error as { stderr: unknown }).stderr).trim();
        if (stderr.length > 0) {
          return new Error(stderr);
        }
      }
      return error instanceof Error ? error : new Error('gh command failed', { cause: error });
    },
  });

export const PrServiceLive = Layer.succeed(PrService)({
  fileExists,
  readFile,
  readStdin,
  gitRoot: () =>
    Effect.try({
      try: gitRoot,
      catch: (error) =>
        error instanceof Error ? error : new Error('not a git repository', { cause: error }),
    }),
  spawnGh,
});
