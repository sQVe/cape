import { globSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { readFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { ValidateService } from './validate';

export const ValidateServiceLive = Layer.succeed(ValidateService)({
  globFiles: (pattern: string) =>
    Effect.try({
      try: () => globSync(pattern),
      catch: (error) =>
        error instanceof Error ? error : new Error('glob failed', { cause: error }),
    }),
  readFile: (path: string) =>
    Effect.try({
      try: () => readFileUtf8(path),
      catch: (error) =>
        error instanceof Error ? error : new Error(`read failed: ${path}`, { cause: error }),
    }),
  gitRoot: () =>
    Effect.try({
      try: gitRoot,
      catch: () => new Error('Not a git repository'),
    }),
});
