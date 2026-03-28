import { execFileSync } from 'node:child_process';
import { globSync, readFileSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { ValidateService } from './validate';

export const ValidateServiceLive = Layer.succeed(ValidateService)({
  globFiles: (pattern: string) =>
    Effect.try({
      try: () => globSync(pattern),
      catch: () => new Error('glob failed'),
    }).pipe(Effect.orDie),
  readFile: (path: string) =>
    Effect.try({
      try: () => readFileSync(path, 'utf-8'),
      catch: () => new Error('read failed'),
    }).pipe(Effect.orDie),
  gitRoot: () =>
    Effect.try({
      try: () =>
        execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim(),
      catch: () => new Error('Not a git repository'),
    }).pipe(Effect.orDie),
});
