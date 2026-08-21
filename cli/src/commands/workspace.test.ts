import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { HerdrService, normalizePhase } from '../services/herdr';
import type { WorkspacePhase } from '../services/herdr';
import {
  stubCommitLayer,
  stubGitLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

const run = Command.runWith(main, { version: '0.1.0' });

const makeHerdrLayer = (workspaceId: string | null, reportResult = true) => {
  const reports: { id: string; phase: WorkspacePhase }[] = [];
  const layer = Layer.succeed(HerdrService)({
    workspaceId: () => workspaceId,
    reportPhase: (id, phase) => {
      reports.push({ id, phase });
      return Effect.succeed(reportResult);
    },
  });
  return { layer, reports };
};

const makeLayers = (herdrLayer: Layer.Layer<HerdrService>) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubCommitLayer,
    stubHookLayer,
    herdrLayer,
    stubPrLayer,
    stubValidateLayer,
  );

describe('normalizePhase', () => {
  it('accepts every phase herdr cannot observe for itself', () => {
    expect(normalizePhase('plan')).toBe('plan');
    expect(normalizePhase('build')).toBe('build');
    expect(normalizePhase('review')).toBe('review');
    expect(normalizePhase('pr')).toBe('pr');
  });

  it('ignores case and surrounding whitespace', () => {
    expect(normalizePhase(' PR ')).toBe('pr');
    expect(normalizePhase('BUILD')).toBe('build');
  });

  it('rejects blocked and done, which herdr tracks natively as agent_status', () => {
    expect(normalizePhase('blocked')).toBeNull();
    expect(normalizePhase('done')).toBeNull();
  });

  it('returns null for an unknown phase', () => {
    expect(normalizePhase('deploy')).toBeNull();
  });
});

describe('cape workspace phase', () => {
  it('reports the phase to the current workspace', async () => {
    const { layer, reports } = makeHerdrLayer('ws1');
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({ reported: true, phase: 'build' });
    expect(reports).toEqual([{ id: 'ws1', phase: 'build' }]);
    console_.restore();
  });

  it('normalizes the phase before reporting it', async () => {
    const { layer, reports } = makeHerdrLayer('ws1');
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', ' PR ']).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({ reported: true, phase: 'pr' });
    expect(reports).toEqual([{ id: 'ws1', phase: 'pr' }]);
    console_.restore();
  });

  // The label problem this replaced: reporting depended on a cached epic whose
  // gitBranchName was almost never present, so the command skipped in nearly every
  // workspace. Nothing about the branch, the tracker cache or an open PR can stop a
  // report now, and this pins that down -- every stub layer here is inert.
  it('reports without a tracker cache, a matching epic or a resolvable repo', async () => {
    const { layer, reports } = makeHerdrLayer('ws1');
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', 'plan']).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({ reported: true, phase: 'plan' });
    expect(reports).toEqual([{ id: 'ws1', phase: 'plan' }]);
    console_.restore();
  });

  it('skips outside a herdr workspace', async () => {
    const { layer, reports } = makeHerdrLayer(null);
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', 'build']).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({
      skipped: true,
      reason: 'not in a herdr workspace',
    });
    expect(reports).toEqual([]);
    console_.restore();
  });

  it.each(['deploy', 'blocked', 'done'])('skips on the unknown phase %s', async (phase) => {
    const { layer, reports } = makeHerdrLayer('ws1');
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', phase]).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({
      skipped: true,
      reason: `unknown phase: ${phase}`,
    });
    expect(reports).toEqual([]);
    console_.restore();
  });

  // Argument validity does not depend on the environment. An agent running an older
  // copy of a skill still calls `done`, and hearing about herdr instead of the phase
  // hides the vocabulary change behind an environment message.
  it('names the invalid phase rather than the environment when both are wrong', async () => {
    const { layer, reports } = makeHerdrLayer(null);
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', 'done']).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({
      skipped: true,
      reason: 'unknown phase: done',
    });
    expect(reports).toEqual([]);
    console_.restore();
  });

  it('reports reported false when the herdr call fails', async () => {
    const { layer, reports } = makeHerdrLayer('ws1', false);
    const console_ = spyConsole();

    await Effect.runPromise(
      run(['workspace', 'phase', 'review']).pipe(Effect.provide(makeLayers(layer))),
    );

    expect(JSON.parse(console_.output())).toEqual({ reported: false, phase: 'review' });
    expect(reports).toEqual([{ id: 'ws1', phase: 'review' }]);
    console_.restore();
  });
});
