import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import type { BeadData, ChildStatus } from '../services/brValidate';
import { BrValidateService, generateTemplate, validateSections } from '../services/brValidate';
import type { CheckResult } from '../services/check';
import { CheckService } from '../services/check';
import { HookService } from '../services/hook';
import {
  stubCheckLayer,
  stubCommitLayer,
  stubConformLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
  stubPrLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';

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
    listChildren: () => Effect.succeed([]),
  });

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (brLayer = makeStubBrLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubHookLayer,
    stubPrLayer,
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
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

    it('reports missing sections for feature type', () => {
      const description = '## Goal\ndo it';
      expect(validateSections('feature', description)).toEqual(
        validateSections('task', description),
      );
    });
  });

  describe('bug validation', () => {
    it('returns no errors for valid bug', () => {
      const description = [
        '## Reproduction steps',
        'broken',
        '## Expected behavior',
        'working',
        '## Actual behavior',
        '1. do thing',
      ].join('\n');
      expect(validateSections('bug', description)).toEqual([]);
    });

    it('reports missing sections', () => {
      const description = '## Reproduction steps\nbroken';
      const errors = validateSections('bug', description);
      expect(errors).toContain('missing section: Expected behavior');
      expect(errors).toContain('missing section: Actual behavior');
    });
  });

  it('returns error for unknown type', () => {
    const errors = validateSections('unknown', 'stuff');
    expect(errors).toEqual(['unknown bead type: unknown']);
  });
});

describe('br validate command', () => {
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
    ).rejects.toThrow('missing section');
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
      listChildren: () => Effect.succeed([]),
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
      listChildren: () => Effect.succeed([]),
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

describe('generateTemplate', () => {
  it('generates epic template with all required sections', () => {
    const template = generateTemplate('epic');
    expect(template).toContain('## Requirements');
    expect(template).toContain('## Success criteria');
    expect(template).toContain('## Anti-patterns');
    expect(template).toContain('## Approach');
  });

  it('generates task template with all required sections', () => {
    const template = generateTemplate('task');
    expect(template).toContain('## Goal');
    expect(template).toContain('## Behaviors');
    expect(template).toContain('## Success criteria');
  });

  it('generates bug template with all required sections', () => {
    const template = generateTemplate('bug');
    expect(template).toContain('## Reproduction steps');
    expect(template).toContain('## Expected behavior');
    expect(template).toContain('## Actual behavior');
  });

  it('generates feature template same as task', () => {
    expect(generateTemplate('feature')).toBe(generateTemplate('task'));
  });

  it('returns null for unknown type', () => {
    expect(generateTemplate('unknown')).toBeNull();
  });

  it('generated template passes validation', () => {
    for (const type of ['epic', 'task', 'feature', 'bug']) {
      const template = generateTemplate(type)!;
      expect(validateSections(type, template)).toEqual([]);
    }
  });
});

describe('br template command', () => {
  it('outputs template for valid type', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['br', 'template', '--type', 'task']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    expect(output).toContain('## Goal');
    expect(output).toContain('## Behaviors');
    expect(output).toContain('## Success criteria');
    consoleSpy.mockRestore();
  });

  it('exits with error for unknown type', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      Effect.runPromise(
        run(['br', 'template', '--type', 'unknown']).pipe(Effect.provide(makeCommandLayers())),
      ),
    ).rejects.toThrow();
    stderrSpy.mockRestore();
  });
});

describe('br design command', () => {
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
      listChildren: () => Effect.succeed([]),
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
      listChildren: () => Effect.succeed([]),
    });
    await Effect.runPromise(
      run(['br', 'design', 'cape-test', 'First section']).pipe(
        Effect.provide(makeCommandLayers(brLayer)),
      ),
    );
    expect(updatedDesign).toBe('## First section\n\nfresh content');
    consoleSpy.mockRestore();
  });
});

describe('br close-check command', () => {
  const makeCloseCheckLayers = (children: ChildStatus[], checks: CheckResult[]) => {
    const brLayer = Layer.succeed(BrValidateService)({
      show: () => Effect.succeed(makeBead()),
      updateDesign: () => Effect.succeed(undefined),
      readStdin: () => Effect.succeed(''),
      listChildren: () => Effect.succeed(children),
    });
    const checkLayer = Layer.succeed(CheckService)({
      runChecks: () => Effect.succeed(checks),
    });
    return Layer.mergeAll(
      NodeServices.layer,
      stubGitLayer,
      stubDetectLayer,
      stubCommitLayer,
      stubHookLayer,
      stubPrLayer,
      stubTestLayer,
      stubValidateLayer,
      stubConformLayer,
      brLayer,
      checkLayer,
    );
  };

  it('returns canClose:true when all subtasks closed and checks pass', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const children: ChildStatus[] = [{ id: 'test.1', title: 'Task 1', status: 'closed' }];
    const checks: CheckResult[] = [{ check: 'vitest', passed: true, output: 'ok' }];
    await Effect.runPromise(
      run(['br', 'close-check', 'test-id']).pipe(
        Effect.provide(makeCloseCheckLayers(children, checks)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.canClose).toBe(true);
    expect(result.openSubtasks).toEqual([]);
    expect(result.checksPassed).toBe(true);
    consoleSpy.mockRestore();
  });

  it('returns canClose:false when subtasks are open', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const children: ChildStatus[] = [{ id: 'test.1', title: 'Task 1', status: 'open' }];
    await expect(
      Effect.runPromise(
        run(['br', 'close-check', 'test-id']).pipe(
          Effect.provide(makeCloseCheckLayers(children, [])),
        ),
      ),
    ).rejects.toThrow();
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.canClose).toBe(false);
    expect(result.openSubtasks).toHaveLength(1);
    consoleSpy.mockRestore();
  });

  it('returns canClose:false when checks fail', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const checks: CheckResult[] = [{ check: 'vitest', passed: false, output: 'FAIL' }];
    await expect(
      Effect.runPromise(
        run(['br', 'close-check', 'test-id']).pipe(
          Effect.provide(makeCloseCheckLayers([], checks)),
        ),
      ),
    ).rejects.toThrow();
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.canClose).toBe(false);
    expect(result.checksPassed).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe('br close command', () => {
  const makeCloseLayer = (brCloseOutput: string | null) => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const hookLayer = Layer.succeed(HookService)({
      pluginRoot: () => '/test',
      readFile: () => Effect.succeed(null),
      writeFile: (path, content) => {
        writtenFiles[path] = content;
        return Effect.succeed(undefined);
      },
      removeFile: (path) => {
        removedFiles.push(path);
        return Effect.succeed(undefined);
      },
      ensureDir: () => Effect.succeed(undefined),
      brQuery: (args) => {
        if (args[0] === 'close') {
          return Effect.succeed(brCloseOutput);
        }
        return Effect.succeed(null);
      },
      readStdin: () => Effect.succeed(''),
      spawnGit: () => Effect.succeed(null),
      fileExists: () => Effect.succeed(false),
    });
    return { hookLayer, writtenFiles, removedFiles };
  };

  const makeCloseLayers = (hookLayer: Layer.Layer<HookService>) =>
    Layer.mergeAll(
      NodeServices.layer,
      stubGitLayer,
      stubDetectLayer,
      stubCheckLayer,
      stubCommitLayer,
      stubPrLayer,
      stubTestLayer,
      stubValidateLayer,
      stubConformLayer,
      makeStubBrLayer(),
      hookLayer,
    );

  it('closes issue and returns structured JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer } = makeCloseLayer('✓ Closed bd-test');
    await Effect.runPromise(
      run(['br', 'close', 'bd-test']).pipe(Effect.provide(makeCloseLayers(hookLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.closed).toBe(true);
    expect(result.id).toBe('bd-test');
    expect(result.stopMessage).toContain('STOP');
    consoleSpy.mockRestore();
  });

  it('cleans up state files on close', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles, removedFiles } = makeCloseLayer('✓ Closed bd-test');
    await Effect.runPromise(
      run(['br', 'close', 'bd-test']).pipe(Effect.provide(makeCloseLayers(hookLayer))),
    );
    expect(removedFiles).toContain('/test/hooks/context/tdd-state.json');
    expect(removedFiles).toContain('/test/hooks/context/flow-phase.json');
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('');
    expect(writtenFiles['/test/hooks/context/workflow-active.txt']).toBe('');
    consoleSpy.mockRestore();
  });

  it('returns error JSON when br close fails', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCloseLayer(null);
    await expect(
      Effect.runPromise(
        run(['br', 'close', 'bd-test']).pipe(Effect.provide(makeCloseLayers(hookLayer))),
      ),
    ).rejects.toThrow('failed to close bd-test');
    const output = stderrSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.error).toContain('failed to close');
    stderrSpy.mockRestore();
  });
});

const validTaskDescription =
  '## Goal\nDo it\n\n## Behaviors\n- thing\n\n## Success criteria\n- [ ] works';

describe('br create command', () => {
  const makeCreateLayer = (brCreateOutput: string | null, stdinContent = validTaskDescription) => {
    let capturedArgs: readonly string[] = [];
    const hookLayer = Layer.succeed(HookService)({
      pluginRoot: () => '/test',
      readFile: () => Effect.succeed(null),
      writeFile: () => Effect.succeed(undefined),
      removeFile: () => Effect.succeed(undefined),
      ensureDir: () => Effect.succeed(undefined),
      brQuery: (args) => {
        if (args[0] === 'create') {
          capturedArgs = args;
          return Effect.succeed(brCreateOutput);
        }
        return Effect.succeed(null);
      },
      readStdin: () => Effect.succeed(stdinContent),
      spawnGit: () => Effect.succeed(null),
      fileExists: () => Effect.succeed(false),
    });
    return { hookLayer, getCapturedArgs: () => capturedArgs };
  };

  const makeCreateLayers = (hookLayer: Layer.Layer<HookService>) =>
    Layer.mergeAll(
      NodeServices.layer,
      stubGitLayer,
      stubDetectLayer,
      stubCheckLayer,
      stubCommitLayer,
      stubPrLayer,
      stubTestLayer,
      stubValidateLayer,
      stubConformLayer,
      makeStubBrLayer(),
      hookLayer,
    );

  it('creates issue and returns structured JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer('bd-test');
    await Effect.runPromise(
      run([
        'br',
        'create',
        'Test issue',
        '--type',
        'task',
        '--priority',
        'P1',
        '--labels',
        'hitl',
        '--description',
        validTaskDescription,
      ]).pipe(Effect.provide(makeCreateLayers(hookLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.created).toBe(true);
    expect(result.id).toBe('bd-test');
    consoleSpy.mockRestore();
  });

  it('errors when --type is missing', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'create', 'Test', '--priority', 'P1', '--labels', 'hitl']).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('--type is required');
    stderrSpy.mockRestore();
  });

  it('errors when --priority is missing', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'create', 'Test', '--type', 'task', '--labels', 'hitl']).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('--priority is required');
    stderrSpy.mockRestore();
  });

  it('errors when --labels is missing', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'create', 'Test', '--type', 'task', '--priority', 'P1']).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('--labels is required');
    stderrSpy.mockRestore();
  });

  it('rejects --design flag with redirect message', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run([
          'br',
          'create',
          'Test',
          '--type',
          'task',
          '--priority',
          'P1',
          '--labels',
          'hitl',
          '--design',
          'content',
        ]).pipe(Effect.provide(makeCreateLayers(hookLayer))),
      ),
    ).rejects.toThrow();
    const output = stderrSpy.mock.calls.flat().join('');
    expect(output).toContain('cape br design');
    stderrSpy.mockRestore();
  });

  it('validates description headers and rejects invalid', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run([
          'br',
          'create',
          'Test',
          '--type',
          'task',
          '--priority',
          'P1',
          '--labels',
          'hitl',
          '--description',
          '## Goal\nDo it',
        ]).pipe(Effect.provide(makeCreateLayers(hookLayer))),
      ),
    ).rejects.toThrow('missing section');
    const output = stderrSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('missing section: Behaviors');
    stderrSpy.mockRestore();
  });

  it('reads description from stdin when --description not provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, getCapturedArgs } = makeCreateLayer('bd-test');
    await Effect.runPromise(
      run(['br', 'create', 'Test', '--type', 'task', '--priority', 'P1', '--labels', 'hitl']).pipe(
        Effect.provide(makeCreateLayers(hookLayer)),
      ),
    );
    expect(getCapturedArgs()).toContain('--description');
    consoleSpy.mockRestore();
  });

  it('passes --parent flag through to br create', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, getCapturedArgs } = makeCreateLayer('bd-test.1');
    await Effect.runPromise(
      run([
        'br',
        'create',
        'Child',
        '--type',
        'task',
        '--priority',
        'P1',
        '--labels',
        'hitl',
        '--parent',
        'bd-test',
        '--description',
        validTaskDescription,
      ]).pipe(Effect.provide(makeCreateLayers(hookLayer))),
    );
    const args = getCapturedArgs();
    expect(args).toContain('--parent');
    expect(args).toContain('bd-test');
    consoleSpy.mockRestore();
  });

  it('returns error JSON when br create fails', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeCreateLayer(null);
    await expect(
      Effect.runPromise(
        run([
          'br',
          'create',
          'Test',
          '--type',
          'task',
          '--priority',
          'P1',
          '--labels',
          'hitl',
          '--description',
          validTaskDescription,
        ]).pipe(Effect.provide(makeCreateLayers(hookLayer))),
      ),
    ).rejects.toThrow('br create failed');
    const output = stderrSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.error).toContain('br create failed');
    stderrSpy.mockRestore();
  });
});

describe('br update command', () => {
  const makeUpdateLayer = (
    brUpdateOutput: string | null,
    brShowOutput: string | null = '{"id":"bd-test","issue_type":"task"}',
  ) => {
    let capturedArgs: readonly string[] = [];
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
      brQuery: (args) => {
        if (args[0] === 'update') {
          capturedArgs = args;
          return Effect.succeed(brUpdateOutput);
        }
        if (args[0] === 'show') {
          return Effect.succeed(brShowOutput);
        }
        return Effect.succeed(null);
      },
      readStdin: () => Effect.succeed(''),
      spawnGit: () => Effect.succeed(null),
      fileExists: () => Effect.succeed(false),
    });
    return { hookLayer, getCapturedArgs: () => capturedArgs, writtenFiles };
  };

  const makeUpdateLayers = (hookLayer: Layer.Layer<HookService>) =>
    Layer.mergeAll(
      NodeServices.layer,
      stubGitLayer,
      stubDetectLayer,
      stubCheckLayer,
      stubCommitLayer,
      stubPrLayer,
      stubTestLayer,
      stubValidateLayer,
      stubConformLayer,
      makeStubBrLayer(),
      hookLayer,
    );

  it('updates issue and returns structured JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.updated).toBe(true);
    expect(result.id).toBe('bd-test');
    expect(result.phase).toBe('executing');
    consoleSpy.mockRestore();
  });

  it('rejects hyphenated status values', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeUpdateLayer('✓ Updated bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'update', 'bd-test', '--status', 'in-progress']).pipe(
          Effect.provide(makeUpdateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow();
    const output = stderrSpy.mock.calls.flat().join('');
    expect(output).toContain('in_progress');
    stderrSpy.mockRestore();
  });

  it('rejects done as status', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeUpdateLayer('✓ Updated bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'update', 'bd-test', '--status', 'done']).pipe(
          Effect.provide(makeUpdateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow();
    const output = stderrSpy.mock.calls.flat().join('');
    expect(output).toContain('cape br close');
    stderrSpy.mockRestore();
  });

  it('writes flow-phase.json with phase and issueId', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const stateContent = writtenFiles['/test/hooks/context/flow-phase.json']!;
    const state = JSON.parse(stateContent);
    expect(state.phase).toBe('executing');
    expect(state.issueId).toBe('bd-test');
    expect(state.timestamp).toBeTypeOf('number');
    consoleSpy.mockRestore();
  });

  it('derives debugging phase for bug type', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles } = makeUpdateLayer(
      '✓ Updated bd-test',
      '{"id":"bd-test","issue_type":"bug"}',
    );
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/flow-phase.json']!);
    expect(state.phase).toBe('debugging');
    consoleSpy.mockRestore();
  });

  it('derives planning phase for epic type', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles } = makeUpdateLayer(
      '✓ Updated bd-test',
      '{"id":"bd-test","issue_type":"epic"}',
    );
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/flow-phase.json']!);
    expect(state.phase).toBe('planning');
    consoleSpy.mockRestore();
  });

  it('delegates all args to br update', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, getCapturedArgs } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const args = getCapturedArgs();
    expect(args[0]).toBe('update');
    expect(args).toContain('bd-test');
    expect(args).toContain('--status');
    expect(args).toContain('in_progress');
    consoleSpy.mockRestore();
  });

  it('returns error JSON when br update fails', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { hookLayer } = makeUpdateLayer(null);
    await expect(
      Effect.runPromise(
        run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
          Effect.provide(makeUpdateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('br update failed');
    const output = stderrSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.error).toContain('br update failed');
    stderrSpy.mockRestore();
  });

  it('falls back to executing phase when brQuery show returns malformed JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test', 'not valid json{{{');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/flow-phase.json']!);
    expect(state.phase).toBe('executing');
    consoleSpy.mockRestore();
  });

  it('falls back to executing phase when brQuery show returns null', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test', null);
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/flow-phase.json']!);
    expect(state.phase).toBe('executing');
    consoleSpy.mockRestore();
  });

  it('skips flow-phase.json when --status is not provided', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--description', 'new desc']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    expect(writtenFiles['/test/hooks/context/flow-phase.json']).toBeUndefined();
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.updated).toBe(true);
    expect(result.phase).toBeUndefined();
    consoleSpy.mockRestore();
  });
});
