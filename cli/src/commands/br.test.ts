import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { BrValidateService, validateSections } from '../services/brValidate';
import type { BeadData } from '../services/brValidate';
import { stubCheckLayer, stubCommitLayer, stubDetectLayer, stubGitLayer } from '../testStubs';

const makeBead = (overrides: Partial<BeadData> = {}) => ({
  id: 'cape-test',
  issue_type: 'task',
  description: '## Goal\nDo something\n\n## Behaviors\n- thing\n\n## Success criteria\n- [ ] works',
  design: null,
  ...overrides,
});

const makeStubBrLayer = (bead: BeadData = makeBead()) =>
  Layer.succeed(BrValidateService)({
    show: () => Effect.succeed(bead),
    updateDesign: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed('new content'),
  });

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (brLayer = makeStubBrLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    brLayer,
  );

describe('validateSections', () => {
  describe('epic validation', () => {
    it('returns no errors for valid epic', () => {
      const description = [
        '## Requirements',
        'stuff',
        '## Success criteria',
        '- [ ] works',
        '## Anti-patterns',
        'none',
        '## Approach',
        'do it',
      ].join('\n');
      expect(validateSections('epic', description)).toEqual([]);
    });

    it('accepts Requirements (IMMUTABLE) variant', () => {
      const description = [
        '## Requirements (IMMUTABLE)',
        'stuff',
        '## Success criteria',
        '- [ ] works',
        '## Anti-patterns',
        'none',
        '## Approach',
        'do it',
      ].join('\n');
      expect(validateSections('epic', description)).toEqual([]);
    });

    it('reports missing sections', () => {
      const description = '## Requirements\nstuff';
      const errors = validateSections('epic', description);
      expect(errors).toContain('missing section: Success criteria');
      expect(errors).toContain('missing section: Anti-patterns');
      expect(errors).toContain('missing section: Approach');
    });
  });

  describe('task validation', () => {
    it('returns no errors for valid task', () => {
      const description = [
        '## Goal',
        'do it',
        '## Behaviors',
        '- thing',
        '## Success criteria',
        '- [ ] works',
      ].join('\n');
      expect(validateSections('task', description)).toEqual([]);
    });

    it('reports missing sections', () => {
      const description = '## Goal\ndo it';
      const errors = validateSections('task', description);
      expect(errors).toContain('missing section: Behaviors');
      expect(errors).toContain('missing section: Success criteria');
    });

    it('validates feature type same as task', () => {
      const description = '## Goal\ndo it';
      const errors = validateSections('feature', description);
      expect(errors).toContain('missing section: Behaviors');
      expect(errors).toContain('missing section: Success criteria');
    });
  });

  describe('bug validation', () => {
    it('returns no errors for valid bug', () => {
      const description = [
        '## Observed',
        'broken',
        '## Expected',
        'working',
        '## Steps to reproduce',
        '1. do thing',
      ].join('\n');
      expect(validateSections('bug', description)).toEqual([]);
    });

    it('reports missing sections', () => {
      const description = '## Observed\nbroken';
      const errors = validateSections('bug', description);
      expect(errors).toContain('missing section: Expected');
      expect(errors).toContain('missing section: Steps to reproduce');
    });
  });

  it('returns error for unknown type', () => {
    const errors = validateSections('unknown', 'stuff');
    expect(errors).toEqual(['unknown bead type: unknown']);
  });
});

describe('br validate command', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(
      run(['br', 'validate', '--help']).pipe(Effect.provide(makeCommandLayers())),
    );
  });

  it('returns valid JSON for valid bead', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['br', 'validate', 'cape-test']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, errors: [] });
    consoleSpy.mockRestore();
  });

  it('returns errors for invalid epic', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const bead = makeBead({
      issue_type: 'epic',
      description: '## Requirements\nstuff',
    });
    await expect(
      Effect.runPromise(
        run(['br', 'validate', 'cape-test']).pipe(
          Effect.provide(makeCommandLayers(makeStubBrLayer(bead))),
        ),
      ),
    ).rejects.toThrow();
    consoleSpy.mockRestore();
  });

  it('validates from stdin with --type flag', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const brLayer = Layer.succeed(BrValidateService)({
      show: () => Effect.succeed(makeBead()),
      updateDesign: () => Effect.succeed(undefined),
      readStdin: () =>
        Effect.succeed(
          '## Goal\ndo it\n\n## Behaviors\n- thing\n\n## Success criteria\n- [ ] works',
        ),
    });
    await Effect.runPromise(
      run(['br', 'validate', '--type', 'task']).pipe(Effect.provide(makeCommandLayers(brLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, errors: [] });
    consoleSpy.mockRestore();
  });

  it('rejects invalid content from stdin', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const brLayer = Layer.succeed(BrValidateService)({
      show: () => Effect.succeed(makeBead()),
      updateDesign: () => Effect.succeed(undefined),
      readStdin: () => Effect.succeed('## Requirements\nstuff'),
    });
    await expect(
      Effect.runPromise(
        run(['br', 'validate', '--type', 'epic']).pipe(Effect.provide(makeCommandLayers(brLayer))),
      ),
    ).rejects.toThrow('missing section');
    consoleSpy.mockRestore();
  });

  it('rejects when neither id nor --type provided', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      Effect.runPromise(run(['br', 'validate']).pipe(Effect.provide(makeCommandLayers()))),
    ).rejects.toThrow('provide either <id> or --type');
    stderrSpy.mockRestore();
  });
});

describe('br design command', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(
      run(['br', 'design', '--help']).pipe(Effect.provide(makeCommandLayers())),
    );
  });

  it('appends section to existing design', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let updatedDesign = '';
    const brLayer = Layer.succeed(BrValidateService)({
      show: () => Effect.succeed(makeBead({ design: '## Existing\nold content' })),
      updateDesign: (_, design) => {
        updatedDesign = design;
        return Effect.succeed(undefined);
      },
      readStdin: () => Effect.succeed('new content'),
    });
    await Effect.runPromise(
      run(['br', 'design', 'cape-test', 'New section']).pipe(
        Effect.provide(makeCommandLayers(brLayer)),
      ),
    );
    expect(updatedDesign).toContain('## Existing\nold content');
    expect(updatedDesign).toContain('## New section');
    expect(updatedDesign).toContain('new content');
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ updated: true, id: 'cape-test' });
    consoleSpy.mockRestore();
  });

  it('creates fresh design when null', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let updatedDesign = '';
    const brLayer = Layer.succeed(BrValidateService)({
      show: () => Effect.succeed(makeBead({ design: null })),
      updateDesign: (_, design) => {
        updatedDesign = design;
        return Effect.succeed(undefined);
      },
      readStdin: () => Effect.succeed('fresh content'),
    });
    await Effect.runPromise(
      run(['br', 'design', 'cape-test', 'First section']).pipe(
        Effect.provide(makeCommandLayers(brLayer)),
      ),
    );
    expect(updatedDesign).toBe('## First section\n\nfresh content');
    consoleSpy.mockRestore();
  });

  it('returns JSON result on success', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['br', 'design', 'cape-test', 'Section']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ updated: true, id: 'cape-test' });
    consoleSpy.mockRestore();
  });
});
