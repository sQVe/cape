import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFileUtf8 } from '../utils/fs';
import { DetectService } from './detect';
import { DetectServiceLive, findWorkspaceRoot } from './detectLive';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock('../utils/fs', () => ({
  readFileUtf8: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, DetectService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(DetectServiceLive)));

const mockExistsSync = vi.mocked(existsSync);
const mockReaddirSync = vi.mocked(readdirSync);
const _mockStatSync = vi.mocked(statSync);
const mockReadFileUtf8 = vi.mocked(readFileUtf8);

const dir = (name: string) => ({
  name,
  isDirectory: () => true,
  isFile: () => false,
});

const file = (name: string) => ({
  name,
  isDirectory: () => false,
  isFile: () => true,
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('DetectServiceLive', () => {
  describe('detect', () => {
    it('detects the current TypeScript ecosystem', async () => {
      const cwd = process.cwd();
      const workspace = dirname(cwd);
      mockExistsSync.mockImplementation(
        (path) => path === join(cwd, 'tsconfig.json') || path === join(workspace, 'pnpm-lock.yaml'),
      );
      mockReadFileUtf8.mockImplementation((path) => {
        if (path === join(cwd, 'package.json')) {
          return JSON.stringify({
            devDependencies: { vitest: '1.0.0', oxlint: '1.0.0', prettier: '1.0.0' },
          });
        }
        if (path === join(workspace, 'package.json')) {
          return JSON.stringify({ devDependencies: { typescript: '1.0.0' } });
        }
        throw new Error(`missing ${path}`);
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* DetectService;
          return yield* service.detect();
        }),
      );

      expect(result).toEqual([
        {
          language: 'typescript',
          testFramework: 'vitest',
          linter: 'oxlint',
          formatter: 'prettier',
        },
      ]);
      expect(mockExistsSync).toHaveBeenCalledWith(join(cwd, 'tsconfig.json'));
      expect(mockExistsSync).toHaveBeenCalledWith(join(workspace, 'pnpm-lock.yaml'));
      expect(mockReadFileUtf8).toHaveBeenCalledWith(join(cwd, 'package.json'));
    });

    it('rejects when no ecosystem is detected', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileUtf8.mockImplementation(() => {
        throw new Error('missing config');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* DetectService;
            yield* service.detect();
          }),
        ),
      ).rejects.toThrow('no ecosystem detected');
    });

    it('wraps non-Error detection failures', async () => {
      mockExistsSync.mockImplementation(() => {
        throw 'boom';
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* DetectService;
            yield* service.detect();
          }),
        ),
      ).rejects.toThrow('detection failed');
    });
  });

  describe('mapDirectory', () => {
    it('maps source files to expected test files', async () => {
      mockExistsSync.mockImplementation((path) => path === join('/project', 'tsconfig.json'));
      mockReadFileUtf8.mockImplementation((path) => {
        if (path === join('/project', 'package.json')) {
          return JSON.stringify({ devDependencies: { vitest: '1.0.0' } });
        }
        throw new Error(`missing ${path}`);
      });
      mockReaddirSync.mockImplementation((path) => {
        if (path === '/project') {
          return [dir('src'), file('README.md')] as unknown as ReturnType<typeof readdirSync>;
        }
        if (path === join('/project', 'src')) {
          return [file('app.ts'), file('app.test.ts')] as unknown as ReturnType<typeof readdirSync>;
        }
        throw new Error(`unmocked readdir: ${path}`);
      });

      const map = await run(
        Effect.gen(function* () {
          const service = yield* DetectService;
          return yield* service.mapDirectory('/project');
        }),
      );

      expect(map).toEqual({
        'src/app.ts': 'src/app.test.ts',
        'README.md': null,
      });
      expect(mockReaddirSync).toHaveBeenCalledWith('/project', { withFileTypes: true });
      expect(mockReaddirSync).toHaveBeenCalledWith(join('/project', 'src'), {
        withFileTypes: true,
      });
    });

    it('rejects when the directory has no detectable ecosystem', async () => {
      mockExistsSync.mockReturnValue(false);
      mockReadFileUtf8.mockImplementation(() => {
        throw new Error('missing config');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* DetectService;
            yield* service.mapDirectory('/empty');
          }),
        ),
      ).rejects.toThrow('no ecosystem detected');
      expect(mockReaddirSync).not.toHaveBeenCalled();
    });

    it('wraps non-Error mapping failures', async () => {
      mockExistsSync.mockImplementation(() => {
        throw 'boom';
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* DetectService;
            yield* service.mapDirectory('/project');
          }),
        ),
      ).rejects.toThrow('mapping failed');
    });
  });
});

describe('findWorkspaceRoot', () => {
  it('walks up to the nearest lockfile', () => {
    mockExistsSync.mockImplementation((path) => path === join('/repo', 'pnpm-lock.yaml'));

    expect(findWorkspaceRoot('/repo/packages/app/src/index.ts')).toBe('/repo');
    expect(mockExistsSync).toHaveBeenCalledWith(join('/repo/packages/app/src', 'pnpm-lock.yaml'));
    expect(mockExistsSync).toHaveBeenCalledWith(join('/repo', 'pnpm-lock.yaml'));
  });

  it('returns null when no lockfile is found', () => {
    mockExistsSync.mockReturnValue(false);

    expect(findWorkspaceRoot('/repo/packages/app/src/index.ts')).toBeNull();
  });
});
