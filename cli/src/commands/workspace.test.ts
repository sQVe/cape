import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { HerdrService, composeLabels, phaseIcon } from '../services/herdr';
import { HookService } from '../services/hook';
import { PrService } from '../services/pr';
import {
  makeStubGitLayer,
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

const makePrLayer = (ghResult: string | Error) => {
  const calls: string[][] = [];
  const layer = Layer.succeed(PrService)({
    fileExists: () => Effect.succeed(false),
    readFile: () => Effect.fail(new Error('no file')),
    readStdin: () => Effect.succeed(''),
    gitRoot: () => Effect.succeed('/repo'),
    spawnGh: (args) => {
      calls.push([...args]);
      return ghResult instanceof Error ? Effect.fail(ghResult) : Effect.succeed(ghResult);
    },
  });
  return { layer, calls };
};

const makeLayers = (
  hookLayer: Layer.Layer<HookService>,
  herdrLayer: Layer.Layer<HerdrService>,
  gitLayer = stubGitLayer,
  prLayer = stubPrLayer,
) =>
  Layer.mergeAll(
    NodeServices.layer,
    gitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    hookLayer,
    herdrLayer,
    prLayer,
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
  it('leads the workspace label with the repo and puts icon + lowercased id on the tab', () => {
    expect(composeLabels('build', 'ABU-134', 'Rework cape workspace labels', 'cape')).toEqual({
      workspace: 'cape: 🔨 rework cape workspace labels',
      tab: '🔨 abu-134',
    });
  });

  it('truncates the description on a word boundary to the 32 character herdr sidebar budget', () => {
    expect(
      composeLabels('build', 'ABU-134', 'Surface cape workflow phase in labels', 'cape'),
    ).toEqual({
      workspace: 'cape: 🔨 surface cape workflow phase in',
      tab: '🔨 abu-134',
    });
  });

  it('counts the budget in code points so a non-BMP character is never split', () => {
    expect(composeLabels('build', 'ABU-134', `${'a'.repeat(31)}\u{1F600}suffix`, 'cape')).toEqual({
      workspace: `cape: 🔨 ${'a'.repeat(31)}\u{1F600}`,
      tab: '🔨 abu-134',
    });
  });

  it('falls back to the issue id as the description when the title is missing', () => {
    expect(composeLabels('review', 'ABU-134', null, 'cape')).toEqual({
      workspace: 'cape: 🔍 abu-134',
      tab: '🔍 abu-134',
    });
    expect(composeLabels('review', 'ABU-134', '   ', 'cape')).toEqual({
      workspace: 'cape: 🔍 abu-134',
      tab: '🔍 abu-134',
    });
  });

  it('falls back to the id-led shape when the repo is missing', () => {
    expect(composeLabels('build', 'ABU-134', 'Rework cape workspace labels', null)).toEqual({
      workspace: '🔨 abu-134 rework cape workspace labels',
      tab: '🔨 abu-134',
    });
    expect(composeLabels('build', 'ABU-134', null, '')).toEqual({
      workspace: '🔨 abu-134',
      tab: '🔨 abu-134',
    });
  });

  it('prefers the pr number over the issue id on the tab once a pr is open', () => {
    expect(composeLabels('pr', 'ABU-134', 'Rework cape workspace labels', 'cape', 123)).toEqual({
      workspace: 'cape: 🚀 rework cape workspace labels',
      tab: '🚀 #123',
    });
  });

  it('leaves the workspace label untouched whether or not a pr is open', () => {
    const title = 'Rework cape workspace labels';
    expect(composeLabels('pr', 'ABU-134', title, 'cape', 123)?.workspace).toBe(
      composeLabels('pr', 'ABU-134', title, 'cape', null)?.workspace,
    );
  });

  it('keeps the issue id on the tab when there is no pr', () => {
    expect(composeLabels('pr', 'ABU-134', 'Rework cape workspace labels', 'cape', null)).toEqual({
      workspace: 'cape: 🚀 rework cape workspace labels',
      tab: '🚀 abu-134',
    });
  });

  it('returns null for an unknown phase', () => {
    expect(composeLabels('deploy', 'ABU-134', 'x', 'cape')).toBeNull();
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
      workspace: 'cape: 🔨 surface cape workflow phase in',
      tab: '🔨 abu-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🔨 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🔨 abu-134' },
    ]);
    console_.restore();
  });

  it('falls back to the id-led label when the repo name is unresolvable', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(
        Effect.provide(makeLayers(hookLayer, herdrLayer, makeStubGitLayer(null))),
      ),
    );
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: '🔨 abu-134 surface cape workflow phase in',
      tab: '🔨 abu-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: '🔨 abu-134 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🔨 abu-134' },
    ]);
    console_.restore();
  });

  it('labels the tab with the pr number when gh reports an open pr', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const { layer: prLayer, calls } = makePrLayer('{"number":123}');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'pr']).pipe(
        Effect.provide(makeLayers(hookLayer, herdrLayer, stubGitLayer, prLayer)),
      ),
    );
    expect(calls).toEqual([['pr', 'view', '--json', 'number']]);
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: 'cape: 🚀 surface cape workflow phase in',
      tab: '🚀 #123',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🚀 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🚀 #123' },
    ]);
    console_.restore();
  });

  it('still looks the pr number up when the phase name is not already normalized', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer } = makeHerdrLayer('ws1', 'tab1');
    const { layer: prLayer, calls } = makePrLayer('{"number":123}');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', ' PR ']).pipe(
        Effect.provide(makeLayers(hookLayer, herdrLayer, stubGitLayer, prLayer)),
      ),
    );
    expect(calls).toEqual([['pr', 'view', '--json', 'number']]);
    expect(JSON.parse(console_.output())).toMatchObject({ tab: '🚀 #123' });
    console_.restore();
  });

  it('keeps the issue id and never calls gh outside the pr phase', async () => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const { layer: prLayer, calls } = makePrLayer('{"number":123}');
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(
        Effect.provide(makeLayers(hookLayer, herdrLayer, stubGitLayer, prLayer)),
      ),
    );
    expect(calls).toEqual([]);
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: 'cape: 🔨 surface cape workflow phase in',
      tab: '🔨 abu-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🔨 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🔨 abu-134' },
    ]);
    console_.restore();
  });

  it.each([
    ['a gh failure', new Error('gh: command not found')],
    ['no pr for the branch', ''],
    ['output that is not json', 'no pull requests found'],
    ['a payload without a usable number', '{"number":"123"}'],
    ['a number past the safe integer range', '{"number":9007199254740993}'],
  ])('degrades to the issue id on %s', async (_case, ghResult) => {
    const hookLayer = makeHookLayer({
      [statePath]: stateFile('ABU-134'),
      [trackerPath]: trackerFile('ABU-134', 'Surface cape workflow phase in labels'),
    });
    const { layer: herdrLayer, renames } = makeHerdrLayer('ws1', 'tab1');
    const { layer: prLayer } = makePrLayer(ghResult);
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['workspace', 'phase', 'pr']).pipe(
        Effect.provide(makeLayers(hookLayer, herdrLayer, stubGitLayer, prLayer)),
      ),
    );
    expect(JSON.parse(console_.output())).toEqual({
      renamed: true,
      workspace: 'cape: 🚀 surface cape workflow phase in',
      tab: '🚀 abu-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🚀 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🚀 abu-134' },
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
      workspace: 'cape: 🔨 surface cape workflow phase in',
      tab: '🔨 abu-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🔨 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🔨 abu-134' },
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
      workspace: 'cape: 🔨 surface cape workflow phase in',
      tab: '🔨 abu-134',
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🔨 surface cape workflow phase in' },
      { kind: 'tab', id: 'tab1', label: '🔨 abu-134' },
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
      workspace: 'cape: 🚀 surface cape workflow phase in',
      tab: null,
    });
    expect(renames).toEqual([
      { kind: 'workspace', id: 'ws1', label: 'cape: 🚀 surface cape workflow phase in' },
    ]);
    console_.restore();
  });
});
