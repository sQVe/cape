import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NodeServices } from '@effect/platform-node';
import { Effect, Layer, Result } from 'effect';
import { Command } from 'effect/unstable/cli';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main } from '../main';
import type { DetectResult, DirectoryProbe } from '../services/detect';
import {
  DetectService,
  buildSourceTestMap,
  detectEcosystems,
  getDetectResult,
  isTestFile,
  detectPackageManager,
  isTrivialFile,
  resolveTestPath,
} from '../services/detect';
import { findWorkspaceRoot } from '../services/detectLive';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubGitLayer,
  stubHookLayer,
  stubPrLayer,
  stubConformLayer,
  stubValidateLayer,
} from '../testStubs';

const makeTestDetectLayer = (results: DetectResult[] = []) =>
  Layer.succeed(DetectService)({
    detect: () =>
      Effect.succeed(
        results.length > 0
          ? results
          : [
              {
                language: 'typescript',
                testFramework: 'vitest',
                linter: 'oxlint',
                formatter: 'oxfmt',
              },
            ],
      ),
    mapDirectory: () => Effect.succeed({ 'src/foo.ts': 'src/foo.test.ts' }),
    packageManager: () => Effect.succeed(null),
  });

const makeErrorDetectLayer = () =>
  Layer.succeed(DetectService)({
    detect: () => Effect.fail(new Error('no ecosystem detected')),
    mapDirectory: () => Effect.fail(new Error('no ecosystem detected')),
    packageManager: () => Effect.succeed(null),
  });

const makeProbe = (
  files: string[] = [],
  jsonFiles: Record<string, Record<string, unknown>> = {},
  dirs: string[] = [],
): DirectoryProbe => ({
  fileExists: (name) => files.includes(name),
  directoryExists: (name) => dirs.includes(name),
  readConfig: (name) => jsonFiles[name] ?? null,
});

const findByLanguage = (results: DetectResult[], language: string) =>
  results.find((r) => r.language === language);

const run = Command.runWith(main, { version: '0.1.0' });

const commandLayers = Layer.mergeAll(
  NodeServices.layer,
  makeTestDetectLayer(),
  stubGitLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubBrLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
  stubConformLayer,
);

const errorCommandLayers = Layer.mergeAll(
  NodeServices.layer,
  makeErrorDetectLayer(),
  stubGitLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubBrLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
  stubConformLayer,
);

describe('detect command wiring', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(run(['detect', '--help']).pipe(Effect.provide(commandLayers)));
  });

  it('outputs error JSON when detection fails', async () => {
    await expect(
      Effect.runPromise(run(['detect']).pipe(Effect.provide(errorCommandLayers))),
    ).rejects.toThrow('no ecosystem detected');
  });

  it('accepts --map flag with directory argument', async () => {
    await Effect.runPromise(run(['detect', '--map', '/tmp']).pipe(Effect.provide(commandLayers)));
  });

  it('outputs error JSON when --map fails', async () => {
    await expect(
      Effect.runPromise(run(['detect', '--map', '/tmp']).pipe(Effect.provide(errorCommandLayers))),
    ).rejects.toThrow('no ecosystem detected');
  });
});

describe('getDetectResult', () => {
  it('returns detection results from DetectService', async () => {
    const results = await Effect.runPromise(
      getDetectResult.pipe(Effect.provide(makeTestDetectLayer())),
    );
    expect(results).toEqual([
      { language: 'typescript', testFramework: 'vitest', linter: 'oxlint', formatter: 'oxfmt' },
    ]);
  });

  it('propagates error when no ecosystem detected', async () => {
    const result = await Effect.runPromise(
      getDetectResult.pipe(Effect.provide(makeErrorDetectLayer()), Effect.result),
    );
    expect(Result.isFailure(result)).toBe(true);
  });
});

describe('detectEcosystems', () => {
  it('returns empty array when no ecosystem detected', () => {
    expect(detectEcosystems(makeProbe())).toEqual([]);
  });

  it('detects multiple ecosystems in a monorepo', () => {
    const probe = makeProbe(['tsconfig.json', 'package.json', 'go.mod', '.golangci.yml'], {
      'package.json': {
        devDependencies: { typescript: '^5', vitest: '^2', oxlint: '^0.16' },
      },
    });
    const results = detectEcosystems(probe);
    expect(results).toHaveLength(2);
    expect(findByLanguage(results, 'typescript')).toBeDefined();
    expect(findByLanguage(results, 'go')).toBeDefined();
    expect(findByLanguage(results, 'go')?.linter).toBe('golangci-lint');
  });

  describe('typescript', () => {
    it('detects from tsconfig.json', () => {
      const results = detectEcosystems(makeProbe(['tsconfig.json']));
      expect(results).toEqual([
        {
          language: 'typescript',
          testFramework: null,
          linter: null,
          formatter: null,
        },
      ]);
    });

    it('detects from package.json with typescript dep', () => {
      const results = detectEcosystems(
        makeProbe(['package.json'], {
          'package.json': { devDependencies: { typescript: '^5.0.0' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')).toBeDefined();
    });

    it('detects vite-plus from devDependencies and prefers it over vitest', () => {
      const results = detectEcosystems(
        makeProbe(['tsconfig.json', 'package.json'], {
          'package.json': { devDependencies: { 'vite-plus': '^0.1.0', vitest: '^4.0.0' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')?.testFramework).toBe('vite-plus');
    });

    it('detects vitest from devDependencies', () => {
      const results = detectEcosystems(
        makeProbe(['tsconfig.json', 'package.json'], {
          'package.json': { devDependencies: { vitest: '^2.0.0' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')?.testFramework).toBe('vitest');
    });

    it('detects jest from devDependencies', () => {
      const results = detectEcosystems(
        makeProbe(['tsconfig.json', 'package.json'], {
          'package.json': { devDependencies: { jest: '^29.0.0' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')?.testFramework).toBe('jest');
    });

    it('detects oxlint from .oxlintrc.json', () => {
      const results = detectEcosystems(makeProbe(['tsconfig.json', '.oxlintrc.json']));
      expect(findByLanguage(results, 'typescript')?.linter).toBe('oxlint');
    });

    it('detects oxlint from devDependencies', () => {
      const results = detectEcosystems(
        makeProbe(['tsconfig.json', 'package.json'], {
          'package.json': { devDependencies: { oxlint: '^0.16' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')?.linter).toBe('oxlint');
    });

    it('detects eslint from devDependencies', () => {
      const results = detectEcosystems(
        makeProbe(['tsconfig.json', 'package.json'], {
          'package.json': { devDependencies: { eslint: '^8.0.0' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')?.linter).toBe('eslint');
    });

    it('detects oxfmt from .oxfmtrc.json', () => {
      const results = detectEcosystems(makeProbe(['tsconfig.json', '.oxfmtrc.json']));
      expect(findByLanguage(results, 'typescript')?.formatter).toBe('oxfmt');
    });

    it('detects prettier from devDependencies', () => {
      const results = detectEcosystems(
        makeProbe(['tsconfig.json', 'package.json'], {
          'package.json': { devDependencies: { prettier: '^3.0.0' } },
        }),
      );
      expect(findByLanguage(results, 'typescript')?.formatter).toBe('prettier');
    });
  });

  describe('workspace root fallback', () => {
    it('finds vitest from fallback probe when local package.json lacks it', () => {
      const local = makeProbe(['tsconfig.json', 'package.json'], {
        'package.json': { devDependencies: { typescript: '^5' } },
      });
      const fallback = makeProbe(['package.json'], {
        'package.json': { devDependencies: { vitest: '^2.0.0' } },
      });
      const ts = findByLanguage(detectEcosystems(local, fallback), 'typescript');
      expect(ts?.testFramework).toBe('vitest');
    });

    it('prefers higher-priority dep from fallback over lower-priority local dep', () => {
      const local = makeProbe(['tsconfig.json', 'package.json'], {
        'package.json': { devDependencies: { jest: '^29' } },
      });
      const fallback = makeProbe(['package.json'], {
        'package.json': { devDependencies: { vitest: '^2' } },
      });
      const ts = findByLanguage(detectEcosystems(local, fallback), 'typescript');
      expect(ts?.testFramework).toBe('vitest');
    });

    it('uses local dep when fallback has no matching dep', () => {
      const local = makeProbe(['tsconfig.json', 'package.json'], {
        'package.json': { devDependencies: { jest: '^29' } },
      });
      const fallback = makeProbe(['package.json'], {
        'package.json': { devDependencies: { prettier: '^3' } },
      });
      const ts = findByLanguage(detectEcosystems(local, fallback), 'typescript');
      expect(ts?.testFramework).toBe('jest');
    });

    it('does not apply fallback to non-Node ecosystems', () => {
      const local = makeProbe(['go.mod']);
      const fallback = makeProbe(['tsconfig.json', 'package.json'], {
        'package.json': { devDependencies: { typescript: '^5', vitest: '^2' } },
      });
      const results = detectEcosystems(local, fallback);
      expect(findByLanguage(results, 'go')).toBeDefined();
      expect(findByLanguage(results, 'typescript')).toBeUndefined();
    });

    it('detects typescript via fallback when local has tsconfig but no deps', () => {
      const local = makeProbe(['tsconfig.json']);
      const fallback = makeProbe(['package.json'], {
        'package.json': { devDependencies: { eslint: '^8', prettier: '^3' } },
      });
      const ts = findByLanguage(detectEcosystems(local, fallback), 'typescript');
      expect(ts?.linter).toBe('eslint');
      expect(ts?.formatter).toBe('prettier');
    });
  });

  describe('lua', () => {
    it('detects from .stylua.toml', () => {
      expect(detectEcosystems(makeProbe(['.stylua.toml']))).toEqual([
        {
          language: 'lua',
          testFramework: null,
          linter: null,
          formatter: 'stylua',
        },
      ]);
    });

    it('detects from .luacheckrc', () => {
      const lua = findByLanguage(detectEcosystems(makeProbe(['.luacheckrc'])), 'lua');
      expect(lua?.linter).toBe('luacheck');
    });

    it('detects from init.lua', () => {
      expect(findByLanguage(detectEcosystems(makeProbe(['init.lua'])), 'lua')).toBeDefined();
    });

    it('detects busted from .busted file', () => {
      const lua = findByLanguage(detectEcosystems(makeProbe(['.stylua.toml', '.busted'])), 'lua');
      expect(lua?.testFramework).toBe('busted');
    });

    it('detects busted from spec/ directory', () => {
      const lua = findByLanguage(
        detectEcosystems(makeProbe(['.stylua.toml'], {}, ['spec'])),
        'lua',
      );
      expect(lua?.testFramework).toBe('busted');
    });
  });

  describe('python', () => {
    it('detects from pyproject.toml', () => {
      expect(
        findByLanguage(detectEcosystems(makeProbe(['pyproject.toml'])), 'python'),
      ).toBeDefined();
    });

    it('detects from setup.py', () => {
      expect(findByLanguage(detectEcosystems(makeProbe(['setup.py'])), 'python')).toBeDefined();
    });

    it('detects from requirements.txt', () => {
      expect(
        findByLanguage(detectEcosystems(makeProbe(['requirements.txt'])), 'python'),
      ).toBeDefined();
    });

    it('detects ruff from ruff.toml', () => {
      const py = findByLanguage(
        detectEcosystems(makeProbe(['pyproject.toml', 'ruff.toml'])),
        'python',
      );
      expect(py?.linter).toBe('ruff');
      expect(py?.formatter).toBe('ruff');
    });

    it('detects ruff from pyproject.toml tool section', () => {
      const py = findByLanguage(
        detectEcosystems(
          makeProbe(['pyproject.toml'], {
            'pyproject.toml': { tool: { ruff: {} } },
          }),
        ),
        'python',
      );
      expect(py?.linter).toBe('ruff');
      expect(py?.formatter).toBe('ruff');
    });

    it('detects pytest from pyproject.toml dependencies', () => {
      const py = findByLanguage(
        detectEcosystems(
          makeProbe(['pyproject.toml'], {
            'pyproject.toml': { project: { dependencies: ['pytest>=7.0'] } },
          }),
        ),
        'python',
      );
      expect(py?.testFramework).toBe('pytest');
    });

    it('detects pytest from optional-dependencies', () => {
      const py = findByLanguage(
        detectEcosystems(
          makeProbe(['pyproject.toml'], {
            'pyproject.toml': {
              project: {
                'optional-dependencies': { dev: ['pytest>=7.0', 'ruff'] },
              },
            },
          }),
        ),
        'python',
      );
      expect(py?.testFramework).toBe('pytest');
    });
  });

  describe('go', () => {
    it('detects from go.mod with built-in test and formatter', () => {
      expect(detectEcosystems(makeProbe(['go.mod']))).toEqual([
        {
          language: 'go',
          testFramework: 'go-test',
          linter: null,
          formatter: 'gofmt',
        },
      ]);
    });

    it('detects golangci-lint from .golangci.yml', () => {
      const go = findByLanguage(detectEcosystems(makeProbe(['go.mod', '.golangci.yml'])), 'go');
      expect(go?.linter).toBe('golangci-lint');
    });

    it('detects golangci-lint from .golangci.yaml', () => {
      const go = findByLanguage(detectEcosystems(makeProbe(['go.mod', '.golangci.yaml'])), 'go');
      expect(go?.linter).toBe('golangci-lint');
    });
  });

  describe('rust', () => {
    it('detects from Cargo.toml with built-in tools', () => {
      expect(detectEcosystems(makeProbe(['Cargo.toml']))).toEqual([
        {
          language: 'rust',
          testFramework: 'cargo-test',
          linter: 'clippy',
          formatter: 'rustfmt',
        },
      ]);
    });
  });
});

describe('detectPackageManager', () => {
  it('detects pnpm from pnpm-lock.yaml', () => {
    expect(detectPackageManager(makeProbe(['pnpm-lock.yaml']))).toBe('pnpm');
  });

  it('detects yarn from yarn.lock', () => {
    expect(detectPackageManager(makeProbe(['yarn.lock']))).toBe('yarn');
  });

  it('detects bun from bun.lockb', () => {
    expect(detectPackageManager(makeProbe(['bun.lockb']))).toBe('bun');
  });

  it('detects npm from package-lock.json', () => {
    expect(detectPackageManager(makeProbe(['package-lock.json']))).toBe('npm');
  });

  it('returns null when no lock file', () => {
    expect(detectPackageManager(makeProbe())).toBeNull();
  });

  it('prefers pnpm over yarn when both lock files exist', () => {
    expect(detectPackageManager(makeProbe(['pnpm-lock.yaml', 'yarn.lock']))).toBe('pnpm');
  });

  it('falls back to workspace root probe when local has no lockfile', () => {
    const local = makeProbe();
    const fallback = makeProbe(['pnpm-lock.yaml']);
    expect(detectPackageManager(local, fallback)).toBe('pnpm');
  });

  it('prefers local lockfile over fallback', () => {
    const local = makeProbe(['yarn.lock']);
    const fallback = makeProbe(['pnpm-lock.yaml']);
    expect(detectPackageManager(local, fallback)).toBe('yarn');
  });

  it('returns null when neither local nor fallback has lockfile', () => {
    expect(detectPackageManager(makeProbe(), makeProbe())).toBeNull();
  });
});

describe('isTestFile', () => {
  it('identifies .test.ts as a typescript test file', () => {
    expect(isTestFile('typescript', 'src/foo.test.ts')).toBe(true);
  });

  it('identifies _test.go as a go test file', () => {
    expect(isTestFile('go', 'pkg/foo_test.go')).toBe(true);
  });

  it('identifies _spec.lua as a lua test file', () => {
    expect(isTestFile('lua', 'tests/foo_spec.lua')).toBe(true);
  });

  it('identifies test_ prefixed python files', () => {
    expect(isTestFile('python', 'tests/test_foo.py')).toBe(true);
  });

  it('identifies _test.py suffixed python files', () => {
    expect(isTestFile('python', 'tests/foo_test.py')).toBe(true);
  });

  it('returns false for rust files', () => {
    expect(isTestFile('rust', 'src/main.rs')).toBe(false);
  });

  it('rejects regular source files', () => {
    expect(isTestFile('typescript', 'src/foo.ts')).toBe(false);
    expect(isTestFile('go', 'pkg/foo.go')).toBe(false);
    expect(isTestFile('lua', 'lua/foo.lua')).toBe(false);
    expect(isTestFile('python', 'src/foo.py')).toBe(false);
  });
});

describe('resolveTestPath', () => {
  it('maps .ts to co-located .test.ts', () => {
    expect(resolveTestPath('typescript', 'src/foo.ts')).toBe('src/foo.test.ts');
  });

  it('maps .go to _test.go in same directory', () => {
    expect(resolveTestPath('go', 'pkg/foo.go')).toBe('pkg/foo_test.go');
  });

  it('maps lua/ to tests/ with _spec suffix', () => {
    expect(resolveTestPath('lua', 'lua/foo.lua')).toBe('tests/foo_spec.lua');
  });

  it('keeps non-lua/ prefix and adds _spec suffix', () => {
    expect(resolveTestPath('lua', 'plugin/foo.lua')).toBe('plugin/foo_spec.lua');
  });

  it('maps src/ python to tests/ with test_ prefix', () => {
    expect(resolveTestPath('python', 'src/foo.py')).toBe('tests/test_foo.py');
  });

  it('maps rust to same file', () => {
    expect(resolveTestPath('rust', 'src/main.rs')).toBe('src/main.rs');
  });

  it('returns null for unknown languages', () => {
    expect(resolveTestPath('unknown', 'foo.txt')).toBeNull();
  });
});

describe('buildSourceTestMap', () => {
  it('maps typescript source files and excludes test files from source side', () => {
    const ecosystems: DetectResult[] = [
      {
        language: 'typescript',
        testFramework: 'vitest',
        linter: null,
        formatter: null,
      },
    ];
    const files = ['src/foo.ts', 'src/foo.test.ts', 'src/bar.ts'];
    expect(buildSourceTestMap(ecosystems, files)).toEqual({
      'src/foo.ts': 'src/foo.test.ts',
      'src/bar.ts': 'src/bar.test.ts',
    });
  });

  it('sets null for files not matching any ecosystem', () => {
    const ecosystems: DetectResult[] = [
      {
        language: 'typescript',
        testFramework: 'vitest',
        linter: null,
        formatter: null,
      },
    ];
    expect(buildSourceTestMap(ecosystems, ['README.md'])).toEqual({
      'README.md': null,
    });
  });

  it('handles multiple ecosystems', () => {
    const ecosystems: DetectResult[] = [
      {
        language: 'typescript',
        testFramework: 'vitest',
        linter: null,
        formatter: null,
      },
      {
        language: 'go',
        testFramework: 'go-test',
        linter: null,
        formatter: null,
      },
    ];
    expect(buildSourceTestMap(ecosystems, ['src/foo.ts', 'pkg/bar.go'])).toEqual({
      'src/foo.ts': 'src/foo.test.ts',
      'pkg/bar.go': 'pkg/bar_test.go',
    });
  });
});

describe('isTrivialFile', () => {
  it('detects type-only files', () => {
    const content = `export interface User {\n  id: string;\n}\n\nexport type Role = 'admin' | 'user';\n`;
    expect(isTrivialFile('src/types.ts', content)).toBe(true);
  });

  it('detects barrel exports', () => {
    const content = `export { foo } from './foo';\nexport { bar } from './bar';\n`;
    expect(isTrivialFile('src/index.ts', content)).toBe(true);
  });

  it('detects re-export barrels with export *', () => {
    const content = `export * from './foo';\nexport * from './bar';\n`;
    expect(isTrivialFile('src/index.ts', content)).toBe(true);
  });

  it('detects config files by name', () => {
    expect(isTrivialFile('vite.config.ts', 'export default {}')).toBe(true);
    expect(isTrivialFile('tsconfig.json', '{}')).toBe(true);
    expect(isTrivialFile('.eslintrc.json', '{}')).toBe(true);
    expect(isTrivialFile('jest.config.ts', 'export default {}')).toBe(true);
  });

  it('returns false for files with real logic', () => {
    const content = `export const add = (a: number, b: number) => a + b;\n`;
    expect(isTrivialFile('src/math.ts', content)).toBe(false);
  });

  it('returns false for files with mixed types and logic', () => {
    const content = `export interface User { id: string; }\nexport const createUser = () => ({});\n`;
    expect(isTrivialFile('src/user.ts', content)).toBe(false);
  });

  it('returns false for test files', () => {
    const content = `import { describe, it } from 'vitest';\ndescribe('test', () => {});\n`;
    expect(isTrivialFile('src/math.test.ts', content)).toBe(false);
  });
});

describe('findWorkspaceRoot', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cape-detect-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds workspace root with pnpm-lock.yaml in parent', () => {
    const subDir = join(tempDir, 'packages', 'app');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    expect(findWorkspaceRoot(subDir)).toBe(tempDir);
  });

  it('finds workspace root with yarn.lock in parent', () => {
    const subDir = join(tempDir, 'packages', 'app');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(tempDir, 'yarn.lock'), '');
    expect(findWorkspaceRoot(subDir)).toBe(tempDir);
  });

  it('returns null when no lockfile found', () => {
    const subDir = join(tempDir, 'packages', 'app');
    mkdirSync(subDir, { recursive: true });
    expect(findWorkspaceRoot(subDir)).toBeNull();
  });

  it('does not find lockfile in the start directory itself', () => {
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    expect(findWorkspaceRoot(tempDir)).toBeNull();
  });

  it('finds nearest lockfile when multiple exist', () => {
    const mid = join(tempDir, 'workspace');
    const subDir = join(mid, 'packages', 'app');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(join(tempDir, 'pnpm-lock.yaml'), '');
    writeFileSync(join(mid, 'yarn.lock'), '');
    expect(findWorkspaceRoot(subDir)).toBe(mid);
  });
});
