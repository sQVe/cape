import { globSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { readFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { ValidateService } from './validate';

export const ValidateServiceLive = Layer.succeed(ValidateService)({
  globFiles: (pattern: string) =>
    Effect.try({
      try: () => globSync(pattern),
      catch: () => new Error('glob failed'),
    }).pipe(Effect.orDie),
  readFile: (path: string) =>
    Effect.try({
      try: () => readFileUtf8(path),
      catch: () => new Error('read failed'),
    }).pipe(Effect.orDie),
  gitRoot: () =>
    Effect.try({
      try: gitRoot,
      catch: () => new Error('Not a git repository'),
    }).pipe(Effect.orDie),
});
