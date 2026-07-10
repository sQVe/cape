import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { HookService } from '../services/hook';
import {
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubConformLayer,
  stubValidateLayer,
  stubHerdrLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });

const makeHookLayer = (
  stateContent: string | null = null,
  gitResponses: Record<string, string | null> = {},
  removedFiles: string[] = [],
) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) => {
      if (path === '/test/hooks/context/state.json') {
        return Effect.succeed(stateContent);
      }
      return Effect.succeed(null);
    },
    writeFile: () => Effect.succeed(undefined),
    removeFile: (path) => {
      removedFiles.push(path);
      return Effect.succeed(undefined);
    },
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    spawnGit: (args) => Effect.succeed(gitResponses[args.join(' ')] ?? null),
    fileExists: () => Effect.succeed(false),
  });

const makeLayers = (
  stateContent: string | null = null,
  gitResponses: Record<string, string | null> = {},
  removedFiles: string[] = [],
) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubHerdrLayer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubPrLayer,
    stubValidateLayer,
    stubConformLayer,
    makeHookLayer(stateContent, gitResponses, removedFiles),
  );

describe('cape state list', () => {
  it('shows all available keys when state is empty', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(run(['state', 'list']).pipe(Effect.provide(makeLayers(null))));
    const output = console_.output();
    expect(output).toContain('Active state: None');
    expect(output).toContain('Available keys');
    expect(output).toContain('flowPhase');
    expect(output).toContain('workflowActive');
    expect(output).toContain('executing | debugging | planning');
    console_.restore();
  });

  it('shows active key under Active state and inactive keys under Available keys', async () => {
    const state = JSON.stringify({
      flowPhase: { phase: 'executing', issueId: 'bd-1', timestamp: Date.now() },
    });
    const console_ = spyConsole();
    await Effect.runPromise(run(['state', 'list']).pipe(Effect.provide(makeLayers(state))));
    const output = console_.output();
    const activeIdx = output.indexOf('Active state:');
    const availableIdx = output.indexOf('Available keys:');
    const opsIdx = output.indexOf('Common operations:');
    const flowIdx = output.indexOf('flowPhase: ');
    expect(activeIdx).toBeGreaterThanOrEqual(0);
    expect(availableIdx).toBeGreaterThan(activeIdx);
    expect(flowIdx).toBeGreaterThan(activeIdx);
    expect(flowIdx).toBeLessThan(availableIdx);
    const availableSection = output.slice(availableIdx, opsIdx);
    expect(availableSection).toContain('workflowActive');
    expect(availableSection).not.toContain('flowPhase:');
    console_.restore();
  });

  it('shows expired TTL key under Active state with expired label', async () => {
    const state = JSON.stringify({
      flowPhase: { phase: 'executing', issueId: 'bd-1', timestamp: Date.now() - 60 * 60 * 1000 },
    });
    const console_ = spyConsole();
    await Effect.runPromise(run(['state', 'list']).pipe(Effect.provide(makeLayers(state))));
    const output = console_.output();
    const activeSection = output.slice(
      output.indexOf('Active state:'),
      output.indexOf('Available keys:'),
    );
    expect(activeSection).toContain('flowPhase');
    expect(activeSection).toContain('[expired]');
    console_.restore();
  });

  it('shows custom key under Active state with fallback description', async () => {
    const state = JSON.stringify({
      myCustomKey: { value: 'hello', timestamp: Date.now() },
    });
    const console_ = spyConsole();
    await Effect.runPromise(run(['state', 'list']).pipe(Effect.provide(makeLayers(state))));
    const output = console_.output();
    const activeSection = output.slice(
      output.indexOf('Active state:'),
      output.indexOf('Available keys:'),
    );
    expect(activeSection).toContain('myCustomKey');
    expect(activeSection).toContain('Custom state key');
    console_.restore();
  });

  it('shows common operations section with reset recipe', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(run(['state', 'list']).pipe(Effect.provide(makeLayers(null))));
    const output = console_.output();
    expect(output).toContain('Common operations');
    expect(output).toContain('cape state reset');
    console_.restore();
  });
});

describe('cape state reset', () => {
  it('removes the current linked worktree state file', async () => {
    const removedFiles: string[] = [];

    await Effect.runPromise(
      run(['state', 'reset']).pipe(
        Effect.provide(
          makeLayers(
            null,
            {
              'rev-parse --git-dir': '/repo/.git/worktrees/abu-205',
              'rev-parse --git-common-dir': '/repo/.git',
            },
            removedFiles,
          ),
        ),
      ),
    );

    expect(removedFiles).toEqual(['/test/hooks/context/state-abu-205.json']);
  });
});
