import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { PrService } from './pr';

const fileExists = (path: string) => Effect.succeed(existsSync(path));

const readFile = (path: string) =>
  Effect.try({
    try: () => readFileSync(path, 'utf-8'),
    catch: (error) => (error instanceof Error ? error : new Error(`failed to read file: ${path}`)),
  });

const readStdin = () =>
  Effect.try({
    try: () => readFileSync('/dev/stdin', 'utf-8').trim(),
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to read stdin', { cause: error }),
  });

const gitRoot = () =>
  Effect.try({
    try: () => execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim(),
    catch: (error) =>
      error instanceof Error ? error : new Error('not a git repository', { cause: error }),
  });

export const PrServiceLive = Layer.succeed(PrService)({
  fileExists,
  readFile,
  readStdin,
  gitRoot,
});
