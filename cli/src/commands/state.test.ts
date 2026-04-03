import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { HookService } from '../services/hook';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubConformLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';

const run = Command.runWith(main, { version: '0.1.0' });

const makeHookLayer = (stateContent: string | null = null) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) => {
      if (path === '/test/hooks/context/state.json') {
        return Effect.succeed(stateContent);
      }
      return Effect.succeed(null);
    },
    writeFile: () => Effect.succeed(undefined),
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    brQuery: () => Effect.succeed(null),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    fileExists: () => Effect.succeed(false),
  });

const makeLayers = (stateContent: string | null = null) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubPrLayer,
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
    makeHookLayer(stateContent),
  );

describe('cape state list', () => {
  it('shows all available keys when state is empty', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['state', 'list']).pipe(Effect.provide(makeLayers(null))),
    );
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Active state: None');
    expect(output).toContain('Available keys');
    expect(output).toContain('flowPhase');
    expect(output).toContain('tddState');
    expect(output).toContain('workflowActive');
    expect(output).toContain('executing | debugging | planning');
    expect(output).toContain('red | green | writing-test');
    spy.mockRestore();
  });

  it('shows active key under Active state and inactive keys under Available keys', async () => {
    const state = JSON.stringify({
      tddState: { phase: 'green', timestamp: Date.now() },
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await Effect.runPromise(
        run(['state', 'list']).pipe(Effect.provide(makeLayers(state))),
      );
      const output = spy.mock.calls.map((c) => c[0]).join('\n');
      const activeIdx = output.indexOf('Active state:');
      const availableIdx = output.indexOf('Available keys:');
      const opsIdx = output.indexOf('Common operations:');
      const tddIdx = output.indexOf('tddState: {"phase":"green"}');
      expect(activeIdx).toBeGreaterThanOrEqual(0);
      expect(availableIdx).toBeGreaterThan(activeIdx);
      expect(tddIdx).toBeGreaterThan(activeIdx);
      expect(tddIdx).toBeLessThan(availableIdx);
      const availableSection = output.slice(availableIdx, opsIdx);
      expect(availableSection).toContain('flowPhase');
      expect(availableSection).toContain('workflowActive');
      expect(availableSection).not.toContain('tddState');
    } finally {
      spy.mockRestore();
    }
  });

  it('shows expired TTL key under Active state with expired label', async () => {
    const state = JSON.stringify({
      tddState: { phase: 'red', timestamp: Date.now() - 20 * 60 * 1000 },
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await Effect.runPromise(
        run(['state', 'list']).pipe(Effect.provide(makeLayers(state))),
      );
      const output = spy.mock.calls.map((c) => c[0]).join('\n');
      const activeSection = output.slice(
        output.indexOf('Active state:'),
        output.indexOf('Available keys:'),
      );
      expect(activeSection).toContain('tddState');
      expect(activeSection).toContain('[expired]');
    } finally {
      spy.mockRestore();
    }
  });

  it('shows custom key under Active state with fallback description', async () => {
    const state = JSON.stringify({
      myCustomKey: { value: 'hello', timestamp: Date.now() },
    });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await Effect.runPromise(
        run(['state', 'list']).pipe(Effect.provide(makeLayers(state))),
      );
      const output = spy.mock.calls.map((c) => c[0]).join('\n');
      const activeSection = output.slice(
        output.indexOf('Active state:'),
        output.indexOf('Available keys:'),
      );
      expect(activeSection).toContain('myCustomKey');
      expect(activeSection).toContain('Custom state key');
    } finally {
      spy.mockRestore();
    }
  });

  it('shows common operations section with TDD opt-out recipe', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['state', 'list']).pipe(Effect.provide(makeLayers(null))),
    );
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Common operations');
    expect(output).toContain('cape state clear tddState');
    expect(output).toContain('cape state clear flowPhase');
    expect(output).toContain('cape state reset');
    spy.mockRestore();
  });
});
