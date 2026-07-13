import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { HerdrService, composeLabels, phaseIcon } from '../services/herdr';
import { HookService } from '../services/hook';
import {
  stubCheckLayer,
  stubCommitLayer,
  stubConformLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });
const statePath = '/test/hooks/context/state-no-repo.json';
const trackerPath = '/test/hooks/context/tracker.json';

const stateFile = (issueId: string) =>
  JSON.stringify({ flowPhase: { phase: 'BUILD', issueId, timestamp: Date.now() } });

const trackerFile = (issueId: string, title: string, timestamp = Date.now()) =>
  JSON.stringify({
    version: 1,
    timestamp,
    epics: { [issueId]: { id: issueId, title, status: 'In Progress', tasks: [] } },
  });

const makeHookLayer = (files: Record<string, string> = {}) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: (path) => Effect.succeed(files[path] ?? null),
    writeFile: () => Effect.succeed(undefined),
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    spawnGitChecked: () => Effect.succeed({ kind: 'exit-nonzero' as const }),
    fileExists: (path) => Effect.succeed(files[path] != null),
  });

const makeHerdrLayer = (workspaceId: string | null, tabId: string | null, renameResult = true) => {
  const renames: { kind: string; id: string; label: string }[] = [];
  const layer = Layer.succeed(HerdrService)({
    workspaceId: () => workspaceId,
    tabId: () => tabId,
    rename: (kind, id, label) => {
      renames.push({ kind, id, label });
      return Effect.succeed(renameResult);
    },
  });
  return { layer, renames };
};

const makeLayers = (hookLayer: Layer.Layer<HookService>, herdrLayer: Layer.Layer<HerdrService>) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    hookLayer,
    herdrLayer,
    stubPrLayer,
    stubValidateLayer,
    stubConformLayer,
  );

describe('phaseIcon', () => {
  it('maps every known phase to its icon', () => {
    expect(phaseIcon('plan')).toBe('📋');
    expect(phaseIcon('build')).toBe('🔨');
    expect(phaseIcon('review')).toBe('🔍');
    expect(phaseIcon('pr')).toBe('🚀');
    expect(phaseIcon('blocked')).toBe('⛔');
    expect(phaseIcon('done')).toBe('✅');
  });

  it('is case-insensitive', () => {
    expect(phaseIcon('BUILD')).toBe('🔨');
  });

  it('returns null for an unknown phase', () => {
    expect(phaseIcon('deploy')).toBeNull();
  });
});

describe('composeLabels', () => {
  it('puts the short title on the workspace label and icon + id on the tab', () => {
    expect(composeLabels('build', 'ABU-134', 'Surface cape workflow phase in labels')).toEqual({
      workspace: '🔨 ABU-134 Surface cape workflow',
      tab: '🔨 ABU-134',
    });
  });

  it('omits the title when none is available', () => {
    expect(composeLabels('review', 'ABU-134', null)).toEqual({
      workspace: '🔍 ABU-134',
      tab: '🔍 ABU-134',
    });
  });

  it('returns null for an unknown phase', () => {
    expect(composeLabels('deploy', 'ABU-134', 'x')).toBeNull();
  });
});

describe('cape workspace phase', () => {
  it('renames the workspace and tab when in herdr with a stamped epic', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: '🔨 ABU-134 Surface cape workflow',
      tab: '🔨 ABU-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: '🔨 ABU-134 Surface cape workflow' },
      { kind: 'tab', id: 'tab1', label: '🔨 ABU-134' },
    ]);
    console_.restore();
  });

  it('keeps the epic title when the tracker cache is stale', async () => {
    const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000;
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile(
        'ABU-134',
        'Surface cape workflow phase in labels',
        staleTimestamp,
      ),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: '🔨 ABU-134 Surface cape workflow',
      tab: '🔨 ABU-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: '🔨 ABU-134 Surface cape workflow' },
      { kind: 'tab', id: 'tab1', label: '🔨 ABU-134' },
    ]);
    console_.restore();
  });

  it('skips and does not rename outside a herdr workspace', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer(null, null);
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({
      skipped: true,
      reason: 'not in a herdr workspace',
    });
    expect(renames).toEqual([]);
    console_.restore();
  });

  it('skips when no epic is stamped', async () => {
    const hookLayer = makeHookLayer({});
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({ skipped: true, reason: 'no epic stamped' });
    expect(renames).toEqual([]);
    console_.restore();
  });

  it('skips on an unknown phase', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'deploy']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({
      skipped: true,
      reason: 'unknown phase: deploy',
    });
    expect(renames).toEqual([]);
    console_.restore();
  });

  it('reports renamed false when the herdr rename fails', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1', false);
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({
      renamed: false,
      workspace: '🔨 ABU-134 Surface cape workflow',
      tab: '🔨 ABU-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: '🔨 ABU-134 Surface cape workflow' },
      { kind: 'tab', id: 'tab1', label: '🔨 ABU-134' },
    ]);
    console_.restore();
  });

  it('renames only the workspace when there is no tab id', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', null);
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'pr']).pipe(Effect.provide(makeLayers(hookLayer, herdrLayer))),
    );
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: '🚀 ABU-134 Surface cape workflow',
      tab: null,
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: '🚀 ABU-134 Surface cape workflow' },
    ]);
    console_.restore();
  });
});
