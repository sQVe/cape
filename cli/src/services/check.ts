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
  'go-test': { label: 'go-test', command: 'go', args: ['test', './...'] },
  busted: { label: 'busted', command: 'busted', args: [] },
  pytest: { label: 'pytest', command: 'pytest', args: [] },
  'cargo-test': { label: 'cargo-test', command: 'cargo', args: ['test'] },
};

const nodeExecutor = (pm: string | null): { command: string; prefix: readonly string[] } => {
  if (pm === 'pnpm') return { command: 'pnpm', prefix: ['exec'] };
  if (pm === 'yarn') return { command: 'yarn', prefix: ['exec'] };
  if (pm === 'bun') return { command: 'bun', prefix: ['x'] };
  return { command: 'npx', prefix: [] };
};

const nodeTestCommand = (
  framework: 'vitest' | 'jest' | 'vite-plus',
  pm: string | null,
): CheckCommand => {
  const { command, prefix } = nodeExecutor(pm);
  if (framework === 'vite-plus') {
    return { label: 'vitest', command, args: [...prefix, 'vp', 'test'] };
  }
  const extra = framework === 'vitest' ? ['run'] : [];
  return { label: framework, command, args: [...prefix, framework, ...extra] };
};

// vite-plus bundles oxlint and oxfmt and owns their config (oxfmt's lives in vite.config.ts), so run
// them through `vp` instead of the standalone binaries, which can't find that config or match the
// pinned tool versions.
const vpCommand = (label: string, sub: readonly string[], pm: string | null): CheckCommand => {
  const { command, prefix } = nodeExecutor(pm);
  return { label, command, args: [...prefix, 'vp', ...sub] };
};

// Node-based tools are declared with `npx`; route them through the detected package manager so the
// project's pinned binary runs instead of a globally resolved one. Standalone tools are unchanged.
const withNodeExecutor = (cmd: CheckCommand, pm: string | null): CheckCommand => {
  if (cmd.command !== 'npx') {
    return cmd;
  }
  const { command, prefix } = nodeExecutor(pm);
  return { ...cmd, command, args: [...prefix, ...cmd.args] };
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

export const resolveCheckCommands = (ecosystems: DetectResult[], pm: string | null = null) => {
  const commands: CheckCommand[] = [];

  for (const eco of ecosystems) {
    if (eco.testFramework != null) {
      if (
        eco.testFramework === 'vitest' ||
        eco.testFramework === 'jest' ||
        eco.testFramework === 'vite-plus'
      ) {
        commands.push(nodeTestCommand(eco.testFramework, pm));
      } else {
        const cmd = testCommands[eco.testFramework];
        if (cmd != null) commands.push(cmd);
      }
    }

    const isVitePlus = eco.testFramework === 'vite-plus';

    if (isVitePlus && eco.linter === 'oxlint') {
      commands.push(vpCommand('oxlint', ['lint'], pm));
    } else if (eco.linter != null) {
      const lint = lintCommands[eco.linter];
      if (lint != null) commands.push(withNodeExecutor(lint, pm));
    }

    if (isVitePlus && eco.formatter === 'oxfmt') {
      commands.push(vpCommand('oxfmt', ['fmt', '--check'], pm));
    } else if (eco.formatter != null) {
      const format = formatCommands[eco.formatter];
      if (format != null) commands.push(withNodeExecutor(format, pm));
    }
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
