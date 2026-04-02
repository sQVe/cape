import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { HookService } from '../services/hook';
import {
  extractPrSections,
  extractUncheckedBoxes,
  PrService,
  validatePrBody,
} from '../services/pr';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
  stubConformLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';

const repoTemplate = [
  '#### Summary',
  '',
  'Describe the change.',
  '',
  '#### Test plan',
  '',
  '- [ ] tests pass',
].join('\n');

const makeStubPrLayer = (
  files: Record<string, string> = {},
  ghResult: string | null = null,
) =>
  Layer.succeed(PrService)({
    fileExists: (path) => Effect.succeed(path in files),
    readFile: (path) => {
      const content = files[path];
      return content != null
        ? Effect.succeed(content)
        : Effect.fail(new Error(`file not found: ${path}`));
    },
    readStdin: () => Effect.succeed(''),
    gitRoot: () => Effect.succeed('/repo'),
    spawnGh: () => (ghResult != null ? Effect.succeed(ghResult) : Effect.fail(new Error('gh failed'))),
  });

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (prLayer = makeStubPrLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubHookLayer,
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
    prLayer,
  );

describe('extractPrSections', () => {
  it('extracts h4 headings from content', () => {
    const content = '#### Motivation\nstuff\n#### Changes\nmore\n#### Test plan\n- [ ] works';
    expect(extractPrSections(content)).toEqual(['Motivation', 'Changes', 'Test plan']);
  });

  it('extracts h2 and h3 headings from content', () => {
    const content = '## Summary\nstuff\n### Details\nmore\n## Risk\nchoice';
    expect(extractPrSections(content)).toEqual(['Summary', 'Details', 'Risk']);
  });

  it('extracts headings at all supported levels', () => {
    const content = '## H2\n### H3\n#### H4\ntext';
    expect(extractPrSections(content)).toEqual(['H2', 'H3', 'H4']);
  });

  it('returns empty array for content without headings', () => {
    expect(extractPrSections('plain text\nno headings')).toEqual([]);
  });

  it('ignores h1 headings', () => {
    const content = '# Title\n## Section\ntext';
    expect(extractPrSections(content)).toEqual(['Section']);
  });
});

describe('extractUncheckedBoxes', () => {
  it('extracts unchecked checkbox labels', () => {
    const body = '- [ ] run tests\n- [x] lint passes\n- [ ] build succeeds';
    expect(extractUncheckedBoxes(body)).toEqual(['run tests', 'build succeeds']);
  });

  it('returns empty array when all boxes are checked', () => {
    const body = '- [x] run tests\n- [x] lint passes';
    expect(extractUncheckedBoxes(body)).toEqual([]);
  });

  it('returns empty array when no checkboxes exist', () => {
    expect(extractUncheckedBoxes('plain text\nno boxes')).toEqual([]);
  });
});

describe('validatePrBody', () => {
  it('returns valid when all sections present and all boxes checked', () => {
    const template = ['Motivation', 'Changes', 'Test plan'];
    const body = '#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [x] works';
    expect(validatePrBody(template, body)).toEqual({
      valid: true,
      missing: [],
      extra: [],
      unchecked: [],
    });
  });

  it('returns invalid when checkboxes are unchecked', () => {
    const template = ['Motivation', 'Changes', 'Test plan'];
    const body = '#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [ ] works';
    const result = validatePrBody(template, body);
    expect(result.valid).toBe(false);
    expect(result.unchecked).toEqual(['works']);
  });

  it('reports missing sections', () => {
    const template = ['Motivation', 'Changes', 'Test plan'];
    const body = '#### Motivation\nwhy';
    const result = validatePrBody(template, body);
    expect(result.valid).toBe(false);
    expect(result.missing).toEqual(['Changes', 'Test plan']);
  });

  it('reports extra sections', () => {
    const template = ['Motivation'];
    const body = '#### Motivation\nwhy\n#### Bonus\nextra stuff';
    const result = validatePrBody(template, body);
    expect(result.valid).toBe(true);
    expect(result.extra).toEqual(['Bonus']);
  });
});

describe('pr template command', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(
      run(['pr', 'template', '--help']).pipe(Effect.provide(makeCommandLayers())),
    );
  });

  it('returns default template when no repo template exists', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers())));
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.source).toBe('default');
    expect(result.sections).toEqual(['Motivation', 'Changes', 'Test plan']);
    consoleSpy.mockRestore();
  });

  it('returns repo template when .github/pull_request_template.md exists', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = makeStubPrLayer({
      '/repo/.github/pull_request_template.md': repoTemplate,
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Summary', 'Test plan']);
    expect(result.content).toBe(repoTemplate);
    consoleSpy.mockRestore();
  });

  it('finds uppercase PULL_REQUEST_TEMPLATE.md', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = makeStubPrLayer({
      '/repo/.github/PULL_REQUEST_TEMPLATE.md': repoTemplate,
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Summary', 'Test plan']);
    consoleSpy.mockRestore();
  });

  it('extracts sections from h2 headings in repo template', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const h2Template = '## Summary\n\nDescribe.\n\n## Risk\n\n- [ ] Low\n';
    const prLayer = makeStubPrLayer({
      '/repo/.github/pull_request_template.md': h2Template,
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Summary', 'Risk']);
    consoleSpy.mockRestore();
  });

  it('cascades through template paths in order', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = makeStubPrLayer({
      '/repo/docs/pull_request_template.md': '#### Custom\nstuff',
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Custom']);
    consoleSpy.mockRestore();
  });
});

describe('pr validate command', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(
      run(['pr', 'validate', '--help']).pipe(Effect.provide(makeCommandLayers())),
    );
  });

  it('returns valid when all default sections present and boxes checked', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () =>
        Effect.succeed('#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [x] works'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: () => Effect.fail(new Error('no gh')),
    });
    await Effect.runPromise(
      run(['pr', 'validate', '/tmp/pr-body.md']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, missing: [], extra: [], unchecked: [] });
    consoleSpy.mockRestore();
  });

  it('rejects unchecked test plan boxes', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () =>
        Effect.succeed('#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [ ] works'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: () => Effect.fail(new Error('no gh')),
    });
    await expect(
      Effect.runPromise(
        run(['pr', 'validate', '/tmp/pr-body.md']).pipe(Effect.provide(makeCommandLayers(prLayer))),
      ),
    ).rejects.toThrow('unchecked test plan items');
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.valid).toBe(false);
    expect(result.unchecked).toEqual(['works']);
    consoleSpy.mockRestore();
  });

  it('detects missing sections', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () => Effect.succeed('#### Motivation\njust this'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: () => Effect.fail(new Error('no gh')),
    });
    await expect(
      Effect.runPromise(
        run(['pr', 'validate', '/tmp/pr-body.md']).pipe(Effect.provide(makeCommandLayers(prLayer))),
      ),
    ).rejects.toThrow('Changes, Test plan');
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('Changes');
    expect(result.missing).toContain('Test plan');
    consoleSpy.mockRestore();
  });

  it('validates from stdin with --stdin flag', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () => Effect.fail(new Error('should not read file')),
      readStdin: () =>
        Effect.succeed('#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [x] works'),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: () => Effect.fail(new Error('no gh')),
    });
    await Effect.runPromise(
      run(['pr', 'validate', '--stdin']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, missing: [], extra: [], unchecked: [] });
    consoleSpy.mockRestore();
  });

  it('rejects when neither file nor --stdin provided', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      Effect.runPromise(run(['pr', 'validate']).pipe(Effect.provide(makeCommandLayers()))),
    ).rejects.toThrow('provide <file> or --stdin');
    stderrSpy.mockRestore();
  });

  it('validates against repo template when present', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: (path) => Effect.succeed(path === '/repo/.github/pull_request_template.md'),
      readFile: (path) =>
        path === '/repo/.github/pull_request_template.md'
          ? Effect.succeed(repoTemplate)
          : Effect.succeed('#### Summary\nhere\n#### Test plan\n- [x] works'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: () => Effect.fail(new Error('no gh')),
    });
    await Effect.runPromise(
      run(['pr', 'validate', '/tmp/pr-body.md']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, missing: [], extra: [], unchecked: [] });
    consoleSpy.mockRestore();
  });
});

const validBody = '#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [x] works';

const makeCreateHookLayer = (overrides: {
  branch?: string;
  defaultRef?: string;
  status?: string | null;
  pushResult?: string | null;
} = {}) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: () => Effect.succeed(null),
    writeFile: () => Effect.succeed(undefined),
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    brQuery: () => Effect.succeed(null),
    readStdin: () => Effect.succeed(''),
    spawnGit: (args) => {
      const cmd = args.join(' ');
      if (cmd.includes('rev-parse --abbrev-ref')) {
        return Effect.succeed(overrides.branch ?? 'feat/my-feature');
      }
      if (cmd.includes('symbolic-ref')) {
        return Effect.succeed(overrides.defaultRef ?? 'refs/remotes/origin/main');
      }
      if (cmd.includes('status --porcelain')) {
        return Effect.succeed(overrides.status ?? null);
      }
      if (cmd.includes('push')) {
        return Effect.succeed('pushResult' in overrides ? (overrides.pushResult ?? null) : 'ok');
      }
      return Effect.succeed(null);
    },
    fileExists: () => Effect.succeed(false),
  });

const makeCreatePrLayer = (ghResult: string | Error = 'https://github.com/owner/repo/pull/1') =>
  Layer.succeed(PrService)({
    fileExists: () => Effect.succeed(false),
    readFile: () => Effect.fail(new Error('no file')),
    readStdin: () => Effect.succeed(''),
    gitRoot: () => Effect.succeed('/repo'),
    spawnGh: () => (ghResult instanceof Error ? Effect.fail(ghResult) : Effect.succeed(ghResult)),
  });

const makeCreateLayers = (
  hookLayer = makeCreateHookLayer(),
  prLayer = makeCreatePrLayer(),
) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    hookLayer,
    prLayer,
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
  );

describe('pr create command', () => {
  it('is wired as a subcommand of cape pr', async () => {
    await Effect.runPromise(
      run(['pr', 'create', '--help']).pipe(Effect.provide(makeCreateLayers())),
    );
  });

  it('creates PR and returns url on success', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
        Effect.provide(makeCreateLayers()),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.created).toBe(true);
    expect(result.url).toBe('https://github.com/owner/repo/pull/1');
    consoleSpy.mockRestore();
  });

  it('rejects when on default branch', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hookLayer = makeCreateHookLayer({ branch: 'main' });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('Cannot create PR from default branch');
    stderrSpy.mockRestore();
  });

  it('rejects when uncommitted changes exist', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hookLayer = makeCreateHookLayer({ status: 'M src/foo.ts' });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('Uncommitted changes detected');
    stderrSpy.mockRestore();
  });

  it('rejects when body validation fails', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', '#### Motivation\nonly this']).pipe(
          Effect.provide(makeCreateLayers()),
        ),
      ),
    ).rejects.toThrow('PR body validation failed');
    stderrSpy.mockRestore();
  });

  it('skips push when --no-push is set', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let pushCalled = false;
    const hookLayer = Layer.succeed(HookService)({
      pluginRoot: () => '/test',
      readFile: () => Effect.succeed(null),
      writeFile: () => Effect.succeed(undefined),
      removeFile: () => Effect.succeed(undefined),
      ensureDir: () => Effect.succeed(undefined),
      brQuery: () => Effect.succeed(null),
      readStdin: () => Effect.succeed(''),
      spawnGit: (args) => {
        const cmd = args.join(' ');
        if (cmd.includes('push')) {
          pushCalled = true;
        }
        if (cmd.includes('rev-parse --abbrev-ref')) {
          return Effect.succeed('feat/my-feature');
        }
        if (cmd.includes('symbolic-ref')) {
          return Effect.succeed('refs/remotes/origin/main');
        }
        if (cmd.includes('status --porcelain')) {
          return Effect.succeed(null);
        }
        return Effect.succeed(null);
      },
      fileExists: () => Effect.succeed(false),
    });
    await Effect.runPromise(
      run(['pr', 'create', '--title', 'My PR', '--body', validBody, '--no-push']).pipe(
        Effect.provide(makeCreateLayers(hookLayer)),
      ),
    );
    expect(pushCalled).toBe(false);
    consoleSpy.mockRestore();
  });

  it('passes --draft flag to gh', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let capturedGhArgs: readonly string[] = [];
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () => Effect.fail(new Error('no file')),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: (args) => {
        capturedGhArgs = args;
        return Effect.succeed('https://github.com/owner/repo/pull/2');
      },
    });
    await Effect.runPromise(
      run(['pr', 'create', '--title', 'Draft PR', '--body', validBody, '--draft']).pipe(
        Effect.provide(makeCreateLayers(undefined, prLayer)),
      ),
    );
    expect(capturedGhArgs).toContain('--draft');
    consoleSpy.mockRestore();
  });

  it('passes --label flag to gh', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    let capturedGhArgs: readonly string[] = [];
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () => Effect.fail(new Error('no file')),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
      spawnGh: (args) => {
        capturedGhArgs = args;
        return Effect.succeed('https://github.com/owner/repo/pull/3');
      },
    });
    await Effect.runPromise(
      run(['pr', 'create', '--title', 'Labeled PR', '--body', validBody, '--label', 'enhancement']).pipe(
        Effect.provide(makeCreateLayers(undefined, prLayer)),
      ),
    );
    expect(capturedGhArgs).toContain('--label');
    expect(capturedGhArgs).toContain('enhancement');
    consoleSpy.mockRestore();
  });

  it('falls back to main when symbolic-ref returns null', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const hookLayer = Layer.succeed(HookService)({
      pluginRoot: () => '/test',
      readFile: () => Effect.succeed(null),
      writeFile: () => Effect.succeed(undefined),
      removeFile: () => Effect.succeed(undefined),
      ensureDir: () => Effect.succeed(undefined),
      brQuery: () => Effect.succeed(null),
      readStdin: () => Effect.succeed(''),
      spawnGit: (args) => {
        const cmd = args.join(' ');
        if (cmd.includes('rev-parse --abbrev-ref')) {
          return Effect.succeed('feat/my-feature');
        }
        if (cmd.includes('symbolic-ref')) {
          return Effect.succeed(null);
        }
        if (cmd.includes('status --porcelain')) {
          return Effect.succeed(null);
        }
        if (cmd.includes('push')) {
          return Effect.succeed('ok');
        }
        return Effect.succeed(null);
      },
      fileExists: () => Effect.succeed(false),
    });
    await Effect.runPromise(
      run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
        Effect.provide(makeCreateLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.created).toBe(true);
    consoleSpy.mockRestore();
  });

  it('errors on detached HEAD when rev-parse returns null', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hookLayer = Layer.succeed(HookService)({
      pluginRoot: () => '/test',
      readFile: () => Effect.succeed(null),
      writeFile: () => Effect.succeed(undefined),
      removeFile: () => Effect.succeed(undefined),
      ensureDir: () => Effect.succeed(undefined),
      brQuery: () => Effect.succeed(null),
      readStdin: () => Effect.succeed(''),
      spawnGit: (args) => {
        const cmd = args.join(' ');
        if (cmd.includes('rev-parse --abbrev-ref')) {
          return Effect.succeed(null);
        }
        return Effect.succeed(null);
      },
      fileExists: () => Effect.succeed(false),
    });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('failed to determine current branch');
    stderrSpy.mockRestore();
  });

  it('errors when gh pr create fails', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const prLayer = makeCreatePrLayer(new Error('HTTP 422: Validation Failed'));
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(undefined, prLayer)),
        ),
      ),
    ).rejects.toThrow('gh pr create failed: HTTP 422: Validation Failed');
    stderrSpy.mockRestore();
  });

  it('errors when git push fails', async () => {
    const stderrSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const hookLayer = makeCreateHookLayer({ pushResult: null });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('git push failed');
    stderrSpy.mockRestore();
  });
});
