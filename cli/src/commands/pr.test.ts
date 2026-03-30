import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { extractPrSections, PrService, validatePrBody } from '../services/pr';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
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

const makeStubPrLayer = (files: Record<string, string> = {}) =>
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
    prLayer,
  );

describe('extractPrSections', () => {
  it('extracts h4 headings from content', () => {
    const content = '#### Motivation\nstuff\n#### Changes\nmore\n#### Test plan\n- [ ] works';
    expect(extractPrSections(content)).toEqual(['Motivation', 'Changes', 'Test plan']);
  });

  it('returns empty array for content without h4 headings', () => {
    expect(extractPrSections('## Not an h4\nsome text')).toEqual([]);
  });

  it('ignores h2 and h3 headings', () => {
    const content = '## H2\n### H3\n#### H4\ntext';
    expect(extractPrSections(content)).toEqual(['H4']);
  });
});

describe('validatePrBody', () => {
  it('returns valid when all sections present', () => {
    const template = ['Motivation', 'Changes', 'Test plan'];
    const body = '#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [ ] works';
    expect(validatePrBody(template, body)).toEqual({
      valid: true,
      missing: [],
      extra: [],
    });
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

  it('returns valid when all default sections present', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () =>
        Effect.succeed('#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [ ] works'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
    });
    await Effect.runPromise(
      run(['pr', 'validate', '/tmp/pr-body.md']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, missing: [], extra: [] });
    consoleSpy.mockRestore();
  });

  it('detects missing sections', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const prLayer = Layer.succeed(PrService)({
      fileExists: () => Effect.succeed(false),
      readFile: () => Effect.succeed('#### Motivation\njust this'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
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
        Effect.succeed('#### Motivation\nwhy\n#### Changes\nwhat\n#### Test plan\n- [ ] works'),
      gitRoot: () => Effect.succeed('/repo'),
    });
    await Effect.runPromise(
      run(['pr', 'validate', '--stdin']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, missing: [], extra: [] });
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
          : Effect.succeed('#### Summary\nhere\n#### Test plan\n- [ ] works'),
      readStdin: () => Effect.succeed(''),
      gitRoot: () => Effect.succeed('/repo'),
    });
    await Effect.runPromise(
      run(['pr', 'validate', '/tmp/pr-body.md']).pipe(Effect.provide(makeCommandLayers(prLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ valid: true, missing: [], extra: [] });
    consoleSpy.mockRestore();
  });
});
