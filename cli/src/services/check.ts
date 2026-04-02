import { Effect, ServiceMap } from 'effect';

import type { DetectResult } from './detect';

export interface CheckResult {
  readonly check: string;
  readonly passed: boolean;
  readonly output: string;
}

export interface CheckCommand {
  readonly label: string;
  readonly command: string;
  readonly args: readonly string[];
}

const testCommands: Record<string, CheckCommand> = {
  vitest: { label: 'vitest', command: 'npx', args: ['vitest', 'run'] },
  jest: { label: 'jest', command: 'npx', args: ['jest'] },
  'go-test': { label: 'go-test', command: 'go', args: ['test', './...'] },
  busted: { label: 'busted', command: 'busted', args: [] },
  pytest: { label: 'pytest', command: 'pytest', args: [] },
  'cargo-test': { label: 'cargo-test', command: 'cargo', args: ['test'] },
};

const lintCommands: Record<string, CheckCommand> = {
  oxlint: { label: 'oxlint', command: 'npx', args: ['oxlint'] },
  eslint: { label: 'eslint', command: 'npx', args: ['eslint', '.'] },
  'golangci-lint': {
    label: 'golangci-lint',
    command: 'golangci-lint',
    args: ['run'],
  },
  luacheck: { label: 'luacheck', command: 'luacheck', args: ['.'] },
  ruff: { label: 'ruff', command: 'ruff', args: ['check'] },
  clippy: { label: 'clippy', command: 'cargo', args: ['clippy'] },
};

const formatCommands: Record<string, CheckCommand> = {
  oxfmt: { label: 'oxfmt', command: 'npx', args: ['oxfmt', '--check'] },
  prettier: {
    label: 'prettier',
    command: 'npx',
    args: ['prettier', '--check', '.'],
  },
  gofmt: { label: 'gofmt', command: 'gofmt', args: ['-l', '.'] },
  stylua: { label: 'stylua', command: 'stylua', args: ['--check', '.'] },
  ruff: { label: 'ruff format', command: 'ruff', args: ['format', '--check'] },
  rustfmt: { label: 'rustfmt', command: 'cargo', args: ['fmt', '--check'] },
};

export const resolveTestCommand = (ecosystems: DetectResult[]): CheckCommand | undefined => {
  for (const eco of ecosystems) {
    const test = eco.testFramework != null ? testCommands[eco.testFramework] : undefined;
    if (test != null) return test;
  }
  return undefined;
};

export const resolveCheckCommands = (ecosystems: DetectResult[]) => {
  const commands: CheckCommand[] = [];

  for (const eco of ecosystems) {
    const test = eco.testFramework != null ? testCommands[eco.testFramework] : undefined;
    if (test != null) commands.push(test);

    const lint = eco.linter != null ? lintCommands[eco.linter] : undefined;
    if (lint != null) commands.push(lint);

    const format = eco.formatter != null ? formatCommands[eco.formatter] : undefined;
    if (format != null) commands.push(format);
  }

  return commands;
};

export class CheckService extends ServiceMap.Service<
  CheckService,
  {
    readonly runChecks: (ecosystems: DetectResult[]) => Effect.Effect<CheckResult[], Error>;
  }
>()('CheckService') {}

export const getCheckResults = (ecosystems: DetectResult[]) =>
  Effect.gen(function* () {
    const service = yield* CheckService;
    return yield* service.runChecks(ecosystems);
  });
