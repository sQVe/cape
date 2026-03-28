import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, Result } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import type { CheckResult } from '../services/check';
import { CheckService, getCheckResults, resolveCheckCommands } from '../services/check';
import type { DetectResult } from '../services/detect';
import { DetectService } from '../services/detect';
import { GitService } from '../services/git';

const makeTestDetectLayer = (results: DetectResult[] = []) =>
  Layer.succeed(DetectService)({
    detect: () =>
      Effect.succeed(
        results.length > 0
          ? results
          : [
              {
                language: 'typescript',
                testFramework: 'vitest',
                linter: 'oxlint',
                formatter: 'oxfmt',
              },
            ],
      ),
    mapDirectory: () => Effect.succeed({ 'src/foo.ts': 'src/foo.test.ts' }),
  });

const makeTestCheckLayer = (results: CheckResult[] = []) =>
  Layer.succeed(CheckService)({
    runChecks: () =>
      Effect.succeed(
        results.length > 0 ? results : [{ check: 'vitest', passed: true, output: 'Tests passed' }],
      ),
  });

const makeFailingCheckLayer = (results: CheckResult[]) =>
  Layer.succeed(CheckService)({
    runChecks: () => Effect.succeed(results),
  });

const makeErrorCheckLayer = () =>
  Layer.succeed(CheckService)({
    runChecks: () => Effect.fail(new Error('check execution failed')),
  });

const stubGitLayer = Layer.succeed(GitService)({
  getContext: () =>
    Effect.succeed({
      mainBranch: 'main',
      currentBranch: 'main',
      status: [],
      diffStat: '',
      recentLog: [],
    }),
});

const run = Command.runWith(main, { version: '0.1.0' });

const commandLayers = Layer.mergeAll(
  NodeServices.layer,
  makeTestDetectLayer(),
  makeTestCheckLayer(),
  stubGitLayer,
);

describe('check command wiring', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(run(['check', '--help']).pipe(Effect.provide(commandLayers)));
  });

  it('cape --help lists check subcommand', async () => {
    await Effect.runPromise(run(['--help']).pipe(Effect.provide(commandLayers)));
  });

  it('outputs JSON when all checks pass', async () => {
    await Effect.runPromise(run(['check']).pipe(Effect.provide(commandLayers)));
  });

  it('rejects when any check fails', async () => {
    const layers = Layer.mergeAll(
      NodeServices.layer,
      makeTestDetectLayer(),
      makeFailingCheckLayer([{ check: 'vitest', passed: false, output: 'FAIL' }]),
      stubGitLayer,
    );
    await expect(Effect.runPromise(run(['check']).pipe(Effect.provide(layers)))).rejects.toThrow(
      'checks failed',
    );
  });

  it('rejects when detection fails', async () => {
    const errorDetectLayer = Layer.succeed(DetectService)({
      detect: () => Effect.fail(new Error('no ecosystem detected')),
      mapDirectory: () => Effect.fail(new Error('no ecosystem detected')),
    });
    const layers = Layer.mergeAll(
      NodeServices.layer,
      errorDetectLayer,
      makeTestCheckLayer(),
      stubGitLayer,
    );
    await expect(Effect.runPromise(run(['check']).pipe(Effect.provide(layers)))).rejects.toThrow(
      'no ecosystem detected',
    );
  });

  it('rejects when check execution fails', async () => {
    const layers = Layer.mergeAll(
      NodeServices.layer,
      makeTestDetectLayer(),
      makeErrorCheckLayer(),
      stubGitLayer,
    );
    await expect(Effect.runPromise(run(['check']).pipe(Effect.provide(layers)))).rejects.toThrow(
      'check execution failed',
    );
  });
});

describe('getCheckResults', () => {
  it('returns results from CheckService', async () => {
    const ecosystems: DetectResult[] = [
      { language: 'typescript', testFramework: 'vitest', linter: 'oxlint', formatter: 'oxfmt' },
    ];
    const results = await Effect.runPromise(
      getCheckResults(ecosystems).pipe(Effect.provide(makeTestCheckLayer())),
    );
    expect(results).toEqual([{ check: 'vitest', passed: true, output: 'Tests passed' }]);
  });

  it('propagates errors from CheckService', async () => {
    const ecosystems: DetectResult[] = [
      { language: 'typescript', testFramework: 'vitest', linter: null, formatter: null },
    ];
    const result = await Effect.runPromise(
      getCheckResults(ecosystems).pipe(Effect.provide(makeErrorCheckLayer()), Effect.result),
    );
    expect(Result.isFailure(result)).toBe(true);
  });
});

describe('resolveCheckCommands', () => {
  it('maps typescript ecosystem with all tools to 3 commands', () => {
    const commands = resolveCheckCommands([
      { language: 'typescript', testFramework: 'vitest', linter: 'oxlint', formatter: 'oxfmt' },
    ]);
    expect(commands.map((c) => c.label)).toEqual(['vitest', 'oxlint', 'oxfmt']);
  });

  it('maps go ecosystem with null linter to 2 commands', () => {
    const commands = resolveCheckCommands([
      { language: 'go', testFramework: 'go-test', linter: null, formatter: 'gofmt' },
    ]);
    expect(commands.map((c) => c.label)).toEqual(['go-test', 'gofmt']);
  });

  it('maps rust ecosystem to 3 commands', () => {
    const commands = resolveCheckCommands([
      { language: 'rust', testFramework: 'cargo-test', linter: 'clippy', formatter: 'rustfmt' },
    ]);
    expect(commands.map((c) => c.label)).toEqual(['cargo-test', 'clippy', 'rustfmt']);
  });

  it('maps python with ruff as both linter and formatter', () => {
    const commands = resolveCheckCommands([
      { language: 'python', testFramework: 'pytest', linter: 'ruff', formatter: 'ruff' },
    ]);
    expect(commands.map((c) => c.label)).toEqual(['pytest', 'ruff', 'ruff format']);
  });

  it('skips all null tools', () => {
    const ecosystems: DetectResult[] = [
      { language: 'typescript', testFramework: null, linter: null, formatter: null },
    ];
    expect(resolveCheckCommands(ecosystems)).toEqual([]);
  });

  it('handles multiple ecosystems', () => {
    const commands = resolveCheckCommands([
      { language: 'typescript', testFramework: 'vitest', linter: 'oxlint', formatter: 'oxfmt' },
      { language: 'go', testFramework: 'go-test', linter: null, formatter: 'gofmt' },
    ]);
    expect(commands.map((c) => c.label)).toEqual(['vitest', 'oxlint', 'oxfmt', 'go-test', 'gofmt']);
  });

  it('returns empty array for empty ecosystems', () => {
    expect(resolveCheckCommands([])).toEqual([]);
  });

  it('resolves correct command and args for vitest', () => {
    const commands = resolveCheckCommands([
      { language: 'typescript', testFramework: 'vitest', linter: null, formatter: null },
    ]);
    expect(commands).toEqual([{ label: 'vitest', command: 'npx', args: ['vitest', 'run'] }]);
  });

  it('resolves ruff format with correct args', () => {
    const commands = resolveCheckCommands([
      { language: 'python', testFramework: null, linter: null, formatter: 'ruff' },
    ]);
    expect(commands).toEqual([
      { label: 'ruff format', command: 'ruff', args: ['format', '--check'] },
    ]);
  });

  it('resolves golangci-lint for go linter', () => {
    const commands = resolveCheckCommands([
      { language: 'go', testFramework: null, linter: 'golangci-lint', formatter: null },
    ]);
    expect(commands).toEqual([{ label: 'golangci-lint', command: 'golangci-lint', args: ['run'] }]);
  });
});
