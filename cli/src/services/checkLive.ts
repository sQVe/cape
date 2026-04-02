import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { CheckService, resolveCheckCommands } from './check';
import type { DetectResult } from './detect';
import { detectPackageManager } from './detect';

const executeCommand = (cmd: { label: string; command: string; args: readonly string[] }) => {
  const result = spawnSync(cmd.command, [...cmd.args], {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();

  return { check: cmd.label, passed: result.status === 0, output };
};

const fileProbe = { fileExists: existsSync, directoryExists: () => false, readConfig: () => null };

const runChecks = (ecosystems: DetectResult[]) =>
  Effect.try({
    try: () => {
      const pm = detectPackageManager(fileProbe);
      const commands = resolveCheckCommands(ecosystems, pm);
      return commands.map(executeCommand);
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('check execution failed', { cause: error }),
  });

export const CheckServiceLive = Layer.succeed(CheckService)({ runChecks });
