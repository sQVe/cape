import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

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
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

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
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['br', 'validate', 'cape-test']).pipe(Effect.provide(makeCommandLayers())),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ valid: true, errors: [] });
    console_.restore();
  });

  it('returns errors for invalid epic', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('validates from stdin with --type flag', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ valid: true, errors: [] });
    console_.restore();
  });

  it('rejects invalid content from stdin', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('rejects when neither id nor --type provided', async () => {
    const console_ = spyConsole();
    await expect(
      Effect.runPromise(run(['br', 'validate']).pipe(Effect.provide(makeCommandLayers()))),
    ).rejects.toThrow('provide either <id> or --type');
    console_.restore();
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
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['br', 'template', '--type', 'task']).pipe(Effect.provide(makeCommandLayers())),
    );
    expect(console_.output()).toContain('## Goal');
    expect(console_.output()).toContain('## Behaviors');
    expect(console_.output()).toContain('## Success criteria');
    console_.restore();
  });

  it('exits with error for unknown type', async () => {
    const console_ = spyConsole();
    await expect(
      Effect.runPromise(
        run(['br', 'template', '--type', 'unknown']).pipe(Effect.provide(makeCommandLayers())),
      ),
    ).rejects.toThrow();
    console_.restore();
  });
});

describe('br design command', () => {
  it('appends section to existing design', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ updated: true, id: 'cape-test' });
    console_.restore();
  });

  it('creates fresh design when null', async () => {
    const console_ = spyConsole();
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
    console_.restore();
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
      stubValidateLayer,
      stubConformLayer,
      brLayer,
      checkLayer,
    );
  };

  it('returns canClose:true when all subtasks closed and checks pass', async () => {
    const console_ = spyConsole();
    const children: ChildStatus[] = [{ id: 'test.1', title: 'Task 1', status: 'closed' }];
    const checks: CheckResult[] = [{ check: 'vitest', passed: true, output: 'ok' }];
    await Effect.runPromise(
      run(['br', 'close-check', 'test-id']).pipe(
        Effect.provide(makeCloseCheckLayers(children, checks)),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result.canClose).toBe(true);
    expect(result.openSubtasks).toEqual([]);
    expect(result.checksPassed).toBe(true);
    console_.restore();
  });

  it('returns canClose:false when subtasks are open', async () => {
    const console_ = spyConsole();
    const children: ChildStatus[] = [{ id: 'test.1', title: 'Task 1', status: 'open' }];
    await expect(
      Effect.runPromise(
        run(['br', 'close-check', 'test-id']).pipe(
          Effect.provide(makeCloseCheckLayers(children, [])),
        ),
      ),
    ).rejects.toThrow('close-check failed for test-id: 1 open task(s), checks passed');
    const result = JSON.parse(console_.output());
    expect(result.canClose).toBe(false);
    expect(result.openSubtasks).toHaveLength(1);
    console_.restore();
  });

  it('returns canClose:false when checks fail', async () => {
    const console_ = spyConsole();
    const checks: CheckResult[] = [{ check: 'vitest', passed: false, output: 'FAIL' }];
    await expect(
      Effect.runPromise(
        run(['br', 'close-check', 'test-id']).pipe(
          Effect.provide(makeCloseCheckLayers([], checks)),
        ),
      ),
    ).rejects.toThrow('close-check failed for test-id: 0 open task(s), checks failed');
    const result = JSON.parse(console_.output());
    expect(result.canClose).toBe(false);
    expect(result.checksPassed).toBe(false);
    console_.restore();
  });
});

describe('br close command', () => {
  const initialState = JSON.stringify({
    flowPhase: { phase: 'executing', issueId: 'bd-test', timestamp: Date.now() },
    workflowActive: { value: true, timestamp: Date.now() },
  });

  const makeCloseLayer = (brCloseOutput: string | null) => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const hookLayer = Layer.succeed(HookService)({
      pluginRoot: () => '/test',
      readFile: (path) => {
        if (path === '/test/hooks/context/state.json') {
          return Effect.succeed(writtenFiles[path] ?? initialState);
        }
        return Effect.succeed(null);
      },
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
      stubValidateLayer,
      stubConformLayer,
      makeStubBrLayer(),
      hookLayer,
    );

  it('closes issue and returns structured JSON', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeCloseLayer('✓ Closed bd-test');
    await Effect.runPromise(
      run(['br', 'close', 'bd-test']).pipe(Effect.provide(makeCloseLayers(hookLayer))),
    );
    const result = JSON.parse(console_.output());
    expect(result.closed).toBe(true);
    expect(result.id).toBe('bd-test');
    expect(result.stopMessage).toContain('STOP');
    console_.restore();
  });

  it('cleans up state files on close', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles, removedFiles } = makeCloseLayer('✓ Closed bd-test');
    await Effect.runPromise(
      run(['br', 'close', 'bd-test']).pipe(Effect.provide(makeCloseLayers(hookLayer))),
    );
    expect(removedFiles).toContain('/test/hooks/context/state.json');
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('');
    console_.restore();
  });

  it('returns error JSON when br close fails', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeCloseLayer(null);
    await expect(
      Effect.runPromise(
        run(['br', 'close', 'bd-test']).pipe(Effect.provide(makeCloseLayers(hookLayer))),
      ),
    ).rejects.toThrow('failed to close bd-test');
    const result = JSON.parse(console_.errorOutput());
    expect(result.error).toContain('failed to close');
    console_.restore();
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
      stubValidateLayer,
      stubConformLayer,
      makeStubBrLayer(),
      hookLayer,
    );

  it('creates issue and returns structured JSON', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result.created).toBe(true);
    expect(result.id).toBe('bd-test');
    console_.restore();
  });

  it('errors when --type is missing', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'create', 'Test', '--priority', 'P1', '--labels', 'hitl']).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('--type is required');
    console_.restore();
  });

  it('errors when --priority is missing', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'create', 'Test', '--type', 'task', '--labels', 'hitl']).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('--priority is required');
    console_.restore();
  });

  it('errors when --labels is missing', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeCreateLayer('bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'create', 'Test', '--type', 'task', '--priority', 'P1']).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('--labels is required');
    console_.restore();
  });

  it('rejects --design flag with redirect message', async () => {
    const console_ = spyConsole();
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
    expect(console_.errorOutput()).toContain('cape br design');
    console_.restore();
  });

  it('validates description headers and rejects invalid', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.errorOutput());
    expect(result.error).toContain('missing section: Behaviors');
    console_.restore();
  });

  it('reads description from stdin when --description not provided', async () => {
    const console_ = spyConsole();
    const { hookLayer, getCapturedArgs } = makeCreateLayer('bd-test');
    await Effect.runPromise(
      run(['br', 'create', 'Test', '--type', 'task', '--priority', 'P1', '--labels', 'hitl']).pipe(
        Effect.provide(makeCreateLayers(hookLayer)),
      ),
    );
    expect(getCapturedArgs()).toContain('--description');
    console_.restore();
  });

  it('passes --parent flag through to br create', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('returns error JSON when br create fails', async () => {
    const console_ = spyConsole();
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
    ).rejects.toThrow('br create failed: task "Test"');
    const result = JSON.parse(console_.errorOutput());
    expect(result.error).toContain('br create failed: task');
    console_.restore();
  });
});

describe('br expanded-check command', () => {
  it('returns hasExpandedPlan false for task with no design field', async () => {
    const console_ = spyConsole();
    const bead = makeBead({ design: null });
    await Effect.runPromise(
      run(['br', 'expanded-check', 'cape-test']).pipe(
        Effect.provide(makeCommandLayers(makeStubBrLayer(bead))),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ hasExpandedPlan: false });
    console_.restore();
  });

  it('returns hasExpandedPlan false when design exists but lacks expanded plan section', async () => {
    const console_ = spyConsole();
    const bead = makeBead({ design: '## Brainstorm (brainstorm)\n\nSome design notes' });
    await Effect.runPromise(
      run(['br', 'expanded-check', 'cape-test']).pipe(
        Effect.provide(makeCommandLayers(makeStubBrLayer(bead))),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ hasExpandedPlan: false });
    console_.restore();
  });

  it('returns hasExpandedPlan true when design contains expanded plan section', async () => {
    const console_ = spyConsole();
    const bead = makeBead({ design: '## Expanded plan (expand-task)\n\n### Steps\n...' });
    await Effect.runPromise(
      run(['br', 'expanded-check', 'cape-test']).pipe(
        Effect.provide(makeCommandLayers(makeStubBrLayer(bead))),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ hasExpandedPlan: true });
    console_.restore();
  });

  it('exits non-zero when task ID does not exist', async () => {
    const console_ = spyConsole();
    const brLayer = Layer.succeed(BrValidateService)({
      show: () => Effect.fail(new Error('bead not found: nonexistent')),
      updateDesign: () => Effect.succeed(undefined),
      readStdin: () => Effect.succeed(''),
      listChildren: () => Effect.succeed([]),
    });
    await expect(
      Effect.runPromise(
        run(['br', 'expanded-check', 'nonexistent']).pipe(
          Effect.provide(makeCommandLayers(brLayer)),
        ),
      ),
    ).rejects.toThrow();
    const result = JSON.parse(console_.errorOutput());
    expect(result.error).toContain('bead not found');
    console_.restore();
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
      stubValidateLayer,
      stubConformLayer,
      makeStubBrLayer(),
      hookLayer,
    );

  it('updates issue and returns structured JSON', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result.updated).toBe(true);
    expect(result.id).toBe('bd-test');
    expect(result.phase).toBe('executing');
    console_.restore();
  });

  it('rejects hyphenated status values', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeUpdateLayer('✓ Updated bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'update', 'bd-test', '--status', 'in-progress']).pipe(
          Effect.provide(makeUpdateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow();
    expect(console_.errorOutput()).toContain('in_progress');
    console_.restore();
  });

  it('rejects done as status', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeUpdateLayer('✓ Updated bd-test');
    await expect(
      Effect.runPromise(
        run(['br', 'update', 'bd-test', '--status', 'done']).pipe(
          Effect.provide(makeUpdateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow();
    expect(console_.errorOutput()).toContain('cape br close');
    console_.restore();
  });

  it('writes flowPhase to state.json with phase and issueId', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const stateContent = writtenFiles['/test/hooks/context/state.json']!;
    const state = JSON.parse(stateContent);
    expect(state.flowPhase.phase).toBe('executing');
    expect(state.flowPhase.issueId).toBe('bd-test');
    expect(state.flowPhase.timestamp).toBeTypeOf('number');
    console_.restore();
  });

  it('derives debugging phase for bug type', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles } = makeUpdateLayer(
      '✓ Updated bd-test',
      '{"id":"bd-test","issue_type":"bug"}',
    );
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json']!);
    expect(state.flowPhase.phase).toBe('debugging');
    console_.restore();
  });

  it('derives planning phase for epic type', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles } = makeUpdateLayer(
      '✓ Updated bd-test',
      '{"id":"bd-test","issue_type":"epic"}',
    );
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json']!);
    expect(state.flowPhase.phase).toBe('planning');
    console_.restore();
  });

  it('delegates all args to br update', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('returns error JSON when br update fails', async () => {
    const console_ = spyConsole();
    const { hookLayer } = makeUpdateLayer(null);
    await expect(
      Effect.runPromise(
        run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
          Effect.provide(makeUpdateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('br update failed for bd-test');
    const result = JSON.parse(console_.errorOutput());
    expect(result.error).toContain('br update failed for bd-test');
    console_.restore();
  });

  it('falls back to executing phase when brQuery show returns malformed JSON', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test', 'not valid json{{{');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json']!);
    expect(state.flowPhase.phase).toBe('executing');
    console_.restore();
  });

  it('falls back to executing phase when brQuery show returns null', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test', null);
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--status', 'in_progress']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/state.json']!);
    expect(state.flowPhase.phase).toBe('executing');
    console_.restore();
  });

  it('skips state write when --status is not provided', async () => {
    const console_ = spyConsole();
    const { hookLayer, writtenFiles } = makeUpdateLayer('✓ Updated bd-test');
    await Effect.runPromise(
      run(['br', 'update', 'bd-test', '--description', 'new desc']).pipe(
        Effect.provide(makeUpdateLayers(hookLayer)),
      ),
    );
    expect(writtenFiles['/test/hooks/context/state.json']).toBeUndefined();
    const result = JSON.parse(console_.output());
    expect(result.updated).toBe(true);
    expect(result.phase).toBeUndefined();
    console_.restore();
  });
});
