import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { resolveTestCommand } from '../services/check';
import type { DetectResult } from '../services/detect';
import { DetectService } from '../services/detect';
import { HookService } from '../services/hook';
import { TestService } from '../services/test';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubConformLayer,
  stubGitLayer,
  stubPrLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });

const makeDetectLayer = (ecosystems: DetectResult[] = []) =>
  Layer.succeed(DetectService)({
    detect: () =>
      Effect.succeed(
        ecosystems.length > 0
          ? ecosystems
          : [{ language: 'typescript', testFramework: 'vitest', linter: null, formatter: null }],
      ),
    mapDirectory: () => Effect.succeed({}),
    packageManager: () => Effect.succeed(null),
  });

const makeTestLayer = (passed: boolean, output = '') =>
  Layer.succeed(TestService)({
    runTest: () => Effect.succeed({ passed, output }),
  });

const makeHookLayer = () => {
  const writtenFiles: Record<string, string> = {};
  const hookLayer = Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: () => Effect.succeed(null),
    writeFile: (path, content) => {
      writtenFiles[path] = content;
      return Effect.succeed(undefined);
    },
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    brQuery: () => Effect.succeed(null),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    fileExists: () => Effect.succeed(false),
  });
  return { hookLayer, writtenFiles };
};

const makeLayers = (
  detectLayer = makeDetectLayer(),
  testLayer = makeTestLayer(true),
  hookLayer?: Layer.Layer<HookService>,
) => {
  const { hookLayer: defaultHookLayer, writtenFiles } = makeHookLayer();
  return {
    layers: Layer.mergeAll(
      NodeServices.layer,
      stubGitLayer,
      detectLayer,
      stubCheckLayer,
      stubCommitLayer,
      stubBrLayer,
      hookLayer ?? defaultHookLayer,
      stubPrLayer,
      testLayer,
      stubValidateLayer,
      stubConformLayer,
    ),
    writtenFiles,
  };
};

describe('test command', () => {
  it('runs tests and returns structured JSON on pass', async () => {
    const console_ = spyConsole();
    const { layers, writtenFiles } = makeLayers();
    await Effect.runPromise(run(['test']).pipe(Effect.provide(layers)));
    const result = JSON.parse(console_.output());
    expect(result.passed).toBe(true);
    expect(result.phase).toBe('green');
    expect(result.runner).toBe('vitest');
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}').tddState;
    expect(state.phase).toBe('green');
    console_.restore();
  });

  it('writes red phase and fails on test failure', async () => {
    const console_ = spyConsole();
    const { layers, writtenFiles } = makeLayers(undefined, makeTestLayer(false, 'FAIL: 1 test'));
    await expect(
      Effect.runPromise(run(['test']).pipe(Effect.provide(layers))),
    ).rejects.toThrow('tests failed (runner: vitest)');
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}').tddState;
    expect(state.phase).toBe('red');
    const result = JSON.parse(console_.output());
    expect(result.passed).toBe(false);
    expect(result.phase).toBe('red');
    console_.restore();
  });

  it('errors when no test runner detected', async () => {
    const console_ = spyConsole();
    const noRunnerDetect = makeDetectLayer([
      { language: 'typescript', testFramework: null, linter: null, formatter: null },
    ]);
    const { layers } = makeLayers(noRunnerDetect);
    await expect(
      Effect.runPromise(run(['test']).pipe(Effect.provide(layers))),
    ).rejects.toThrow('no test runner detected for typescript');
    console_.restore();
  });

  it('passes file argument through to test runner', async () => {
    const console_ = spyConsole();
    let capturedArgs: readonly string[] = [];
    const testLayer = Layer.succeed(TestService)({
      runTest: (_cmd, args) => {
        capturedArgs = args;
        return Effect.succeed({ passed: true, output: '' });
      },
    });
    const { layers } = makeLayers(undefined, testLayer);
    await Effect.runPromise(run(['test', 'src/foo.test.ts']).pipe(Effect.provide(layers)));
    expect(capturedArgs).toContain('src/foo.test.ts');
    const result = JSON.parse(console_.output());
    expect(result.file).toBe('src/foo.test.ts');
    console_.restore();
  });

  it('resolves source file to test file', async () => {
    const console_ = spyConsole();
    let capturedArgs: readonly string[] = [];
    const testLayer = Layer.succeed(TestService)({
      runTest: (_cmd, args) => {
        capturedArgs = args;
        return Effect.succeed({ passed: true, output: '' });
      },
    });
    const { layers } = makeLayers(undefined, testLayer);
    await Effect.runPromise(run(['test', 'src/foo.ts']).pipe(Effect.provide(layers)));
    expect(capturedArgs).toContain('src/foo.test.ts');
    console_.restore();
  });

  it('passes raw source file when resolveTestPath returns null', async () => {
    const console_ = spyConsole();
    let capturedArgs: readonly string[] = [];
    const testLayer = Layer.succeed(TestService)({
      runTest: (_cmd, args) => {
        capturedArgs = args;
        return Effect.succeed({ passed: true, output: '' });
      },
    });
    const detectLayer = makeDetectLayer([
      { language: 'unknown-lang', testFramework: 'vitest', linter: null, formatter: null },
    ]);
    const { layers } = makeLayers(detectLayer, testLayer);
    await Effect.runPromise(run(['test', 'src/foo.unk']).pipe(Effect.provide(layers)));
    expect(capturedArgs).toContain('src/foo.unk');
    console_.restore();
  });

  it('does not resolve test file paths', async () => {
    const console_ = spyConsole();
    let capturedArgs: readonly string[] = [];
    const testLayer = Layer.succeed(TestService)({
      runTest: (_cmd, args) => {
        capturedArgs = args;
        return Effect.succeed({ passed: true, output: '' });
      },
    });
    const { layers } = makeLayers(undefined, testLayer);
    await Effect.runPromise(run(['test', 'src/foo.test.ts']).pipe(Effect.provide(layers)));
    expect(capturedArgs).toContain('src/foo.test.ts');
    console_.restore();
  });

  it('writes TDD state with timestamp', async () => {
    const console_ = spyConsole();
    const { layers, writtenFiles } = makeLayers();
    const before = Date.now();
    await Effect.runPromise(run(['test']).pipe(Effect.provide(layers)));
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}').tddState;
    expect(state.timestamp).toBeGreaterThanOrEqual(before);
    expect(state.timestamp).toBeLessThanOrEqual(Date.now());
    console_.restore();
  });
});

describe('resolveTestCommand', () => {
  it('returns vitest for typescript ecosystem', () => {
    const cmd = resolveTestCommand([
      { language: 'typescript', testFramework: 'vitest', linter: null, formatter: null },
    ]);
    expect(cmd).toEqual({ label: 'vitest', command: 'npx', args: ['vitest', 'run'] });
  });

  it('uses pnpm exec for pnpm package manager', () => {
    const cmd = resolveTestCommand(
      [{ language: 'typescript', testFramework: 'vitest', linter: null, formatter: null }],
      'pnpm',
    );
    expect(cmd).toEqual({ label: 'vitest', command: 'pnpm', args: ['exec', 'vitest', 'run'] });
  });

  it('uses yarn exec for yarn package manager', () => {
    const cmd = resolveTestCommand(
      [{ language: 'typescript', testFramework: 'vitest', linter: null, formatter: null }],
      'yarn',
    );
    expect(cmd).toEqual({ label: 'vitest', command: 'yarn', args: ['exec', 'vitest', 'run'] });
  });

  it('uses bun x for bun package manager', () => {
    const cmd = resolveTestCommand(
      [{ language: 'typescript', testFramework: 'vitest', linter: null, formatter: null }],
      'bun',
    );
    expect(cmd).toEqual({ label: 'vitest', command: 'bun', args: ['x', 'vitest', 'run'] });
  });

  it('uses pnpm exec for jest with pnpm', () => {
    const cmd = resolveTestCommand(
      [{ language: 'typescript', testFramework: 'jest', linter: null, formatter: null }],
      'pnpm',
    );
    expect(cmd).toEqual({ label: 'jest', command: 'pnpm', args: ['exec', 'jest'] });
  });

  it('returns go test for go ecosystem', () => {
    const cmd = resolveTestCommand([
      { language: 'go', testFramework: 'go-test', linter: null, formatter: null },
    ]);
    expect(cmd).toEqual({ label: 'go-test', command: 'go', args: ['test', './...'] });
  });

  it('returns undefined when no test framework', () => {
    const cmd = resolveTestCommand([
      { language: 'typescript', testFramework: null, linter: null, formatter: null },
    ]);
    expect(cmd).toBeUndefined();
  });

  it('returns first match from multiple ecosystems', () => {
    const cmd = resolveTestCommand([
      { language: 'typescript', testFramework: null, linter: null, formatter: null },
      { language: 'go', testFramework: 'go-test', linter: null, formatter: null },
    ]);
    expect(cmd?.label).toBe('go-test');
  });
});
