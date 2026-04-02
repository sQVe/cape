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

const makeTestLayers = (fileContent: string | null = null) => {
  const hookLayer = Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) => {
      if (path === '/test/hooks/context/events.jsonl') {
        return Effect.succeed(fileContent);
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

  return Layer.mergeAll(
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
    hookLayer,
  );
};

describe('stats', () => {
  it('outputs "No events recorded yet." when file is missing', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(null))));
    expect(spy).toHaveBeenCalledWith('No events recorded yet.');
    spy.mockRestore();
  });

  it('outputs "No events recorded yet." when file is empty', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(''))));
    expect(spy).toHaveBeenCalledWith('No events recorded yet.');
    spy.mockRestore();
  });

  it('outputs summary with total count and command breakdown', async () => {
    const events = [
      { ts: '2026-03-30T10:00:00.000Z', cmd: 'commit' },
      { ts: '2026-03-30T11:00:00.000Z', cmd: 'check' },
      { ts: '2026-03-30T12:00:00.000Z', cmd: 'commit' },
    ]
      .map((e) => JSON.stringify(e))
      .join('\n');

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(events))));
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Total events: 3');
    expect(output).toContain('commit: 2');
    expect(output).toContain('check: 1');
    spy.mockRestore();
  });

  it('shows last 7 days count', async () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
    const old = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const events = [
      { ts: old, cmd: 'commit' },
      { ts: recent, cmd: 'check' },
      { ts: now.toISOString(), cmd: 'conform' },
    ]
      .map((e) => JSON.stringify(e))
      .join('\n');

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(events))));
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Events in last 7 days: 2');
    spy.mockRestore();
  });

  it('shows 10 most recent entries in reverse chronological order', async () => {
    const entries = Array.from({ length: 15 }, (_, i) => ({
      ts: `2026-03-${String(i + 1).padStart(2, '0')}T10:00:00.000Z`,
      cmd: `cmd${i + 1}`,
    }));
    const events = entries.map((e) => JSON.stringify(e)).join('\n');

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(events))));
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('cmd15');
    expect(output).toContain('cmd6');
    expect(output).not.toContain(' cmd5 ');
    spy.mockRestore();
  });

  it('includes detail in recent entries when present', async () => {
    const events = JSON.stringify({
      ts: '2026-03-30T10:00:00.000Z',
      cmd: 'hook.pre-tool-use',
      detail: 'deny: no tests',
    });

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(events))));
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('deny: no tests');
    spy.mockRestore();
  });

  it('skips malformed JSONL lines gracefully', async () => {
    const events = ['not json', JSON.stringify({ ts: '2026-03-30T10:00:00.000Z', cmd: 'commit' })].join('\n');

    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['stats']).pipe(Effect.provide(makeTestLayers(events))));
    const output = spy.mock.calls.map((c) => c[0]).join('\n');
    expect(output).toContain('Total events: 1');
    spy.mockRestore();
  });
});
