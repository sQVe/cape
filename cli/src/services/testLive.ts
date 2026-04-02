import { spawnSync } from 'node:child_process';

import { Effect, Layer } from 'effect';

import { TestService } from './test';

const runTest = (command: string, args: readonly string[]) =>
  Effect.sync(() => {
    const result = spawnSync(command, [...args], {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 120_000,
    });

    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

    return { passed: result.status === 0, output };
  });

export const TestServiceLive = Layer.succeed(TestService)({ runTest });
