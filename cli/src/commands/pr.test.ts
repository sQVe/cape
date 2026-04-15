import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

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
  stubValidateLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

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
    const console_ = spyConsole();
    await Effect.runPromise(run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers())));
    const result = JSON.parse(console_.output());
    expect(result.source).toBe('default');
    expect(result.sections).toEqual(['Motivation', 'Changes', 'Test plan']);
    console_.restore();
  });

  it('returns repo template when .github/pull_request_template.md exists', async () => {
    const console_ = spyConsole();
    const prLayer = makeStubPrLayer({
      '/repo/.github/pull_request_template.md': repoTemplate,
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const result = JSON.parse(console_.output());
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Summary', 'Test plan']);
    expect(result.content).toBe(repoTemplate);
    console_.restore();
  });

  it('finds uppercase PULL_REQUEST_TEMPLATE.md', async () => {
    const console_ = spyConsole();
    const prLayer = makeStubPrLayer({
      '/repo/.github/PULL_REQUEST_TEMPLATE.md': repoTemplate,
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const result = JSON.parse(console_.output());
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Summary', 'Test plan']);
    console_.restore();
  });

  it('extracts sections from h2 headings in repo template', async () => {
    const console_ = spyConsole();
    const h2Template = '## Summary\n\nDescribe.\n\n## Risk\n\n- [ ] Low\n';
    const prLayer = makeStubPrLayer({
      '/repo/.github/pull_request_template.md': h2Template,
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const result = JSON.parse(console_.output());
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Summary', 'Risk']);
    console_.restore();
  });

  it('cascades through template paths in order', async () => {
    const console_ = spyConsole();
    const prLayer = makeStubPrLayer({
      '/repo/docs/pull_request_template.md': '#### Custom\nstuff',
    });
    await Effect.runPromise(
      run(['pr', 'template']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const result = JSON.parse(console_.output());
    expect(result.source).toBe('repo');
    expect(result.sections).toEqual(['Custom']);
    console_.restore();
  });
});

describe('pr validate command', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(
      run(['pr', 'validate', '--help']).pipe(Effect.provide(makeCommandLayers())),
    );
  });

  it('returns valid when all default sections present and boxes checked', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ valid: true, missing: [], extra: [], unchecked: [] });
    console_.restore();
  });

  it('rejects unchecked test plan boxes', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result.valid).toBe(false);
    expect(result.unchecked).toEqual(['works']);
    console_.restore();
  });

  it('detects missing sections', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('Changes');
    expect(result.missing).toContain('Test plan');
    console_.restore();
  });

  it('validates from stdin with --stdin flag', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ valid: true, missing: [], extra: [], unchecked: [] });
    console_.restore();
  });

  it('rejects when neither file nor --stdin provided', async () => {
    const console_ = spyConsole();
    await expect(
      Effect.runPromise(run(['pr', 'validate']).pipe(Effect.provide(makeCommandLayers()))),
    ).rejects.toThrow('provide <file> or --stdin');
    console_.restore();
  });

  it('validates against repo template when present', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ valid: true, missing: [], extra: [], unchecked: [] });
    console_.restore();
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
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
        Effect.provide(makeCreateLayers()),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result.created).toBe(true);
    expect(result.url).toBe('https://github.com/owner/repo/pull/1');
    console_.restore();
  });

  it('rejects when on default branch', async () => {
    const console_ = spyConsole();
    const hookLayer = makeCreateHookLayer({ branch: 'main' });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('Cannot create PR from default branch');
    console_.restore();
  });

  it('rejects when uncommitted changes exist', async () => {
    const console_ = spyConsole();
    const hookLayer = makeCreateHookLayer({ status: 'M src/foo.ts' });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('Uncommitted changes detected');
    console_.restore();
  });

  it('rejects when body validation fails', async () => {
    const console_ = spyConsole();
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', '#### Motivation\nonly this']).pipe(
          Effect.provide(makeCreateLayers()),
        ),
      ),
    ).rejects.toThrow('PR body validation failed');
    console_.restore();
  });

  it('skips push when --no-push is set', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('passes --draft flag to gh', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('passes --label flag to gh', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('falls back to main when symbolic-ref returns null', async () => {
    const console_ = spyConsole();
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
    const result = JSON.parse(console_.output());
    expect(result.created).toBe(true);
    console_.restore();
  });

  it('errors on detached HEAD when rev-parse returns null', async () => {
    const console_ = spyConsole();
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
    console_.restore();
  });

  it('errors when gh pr create fails', async () => {
    const console_ = spyConsole();
    const prLayer = makeCreatePrLayer(new Error('HTTP 422: Validation Failed'));
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(undefined, prLayer)),
        ),
      ),
    ).rejects.toThrow('gh pr create failed: HTTP 422: Validation Failed');
    console_.restore();
  });

  it('errors when git push fails', async () => {
    const console_ = spyConsole();
    const hookLayer = makeCreateHookLayer({ pushResult: null });
    await expect(
      Effect.runPromise(
        run(['pr', 'create', '--title', 'My PR', '--body', validBody]).pipe(
          Effect.provide(makeCreateLayers(hookLayer)),
        ),
      ),
    ).rejects.toThrow('git push failed');
    console_.restore();
  });
});
