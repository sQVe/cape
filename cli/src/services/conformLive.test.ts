import { globSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { tryReadFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { ConformService } from './conform';
import { ConformServiceLive } from './conformLive';

vi.mock('node:fs', () => ({
  globSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(),
}));

vi.mock('../utils/fs', () => ({
  tryReadFileUtf8: vi.fn(),
}));

vi.mock('../utils/git', () => ({
  gitRoot: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, ConformService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(ConformServiceLive)));

const mockGlobSync = vi.mocked(globSync);
const mockHomedir = vi.mocked(homedir);
const mockTryReadFileUtf8 = vi.mocked(tryReadFileUtf8);
const mockGitRoot = vi.mocked(gitRoot);

afterEach(() => {
  vi.resetAllMocks();
});

describe('ConformServiceLive', () => {
  describe('discoverRules', () => {
    it('reads home and repository rules and skips missing files', async () => {
      mockHomedir.mockReturnValue('/home/me');
      mockGitRoot.mockReturnValue('/repo');
      mockGlobSync.mockImplementation((pattern) => {
        if (pattern === join('/home/me', '.claude', 'rules', '*.md')) {
          return [
            join('/home/me', '.claude', 'rules', 'style.md'),
            join('/home/me', '.claude', 'rules', 'missing.md'),
          ];
        }
        if (pattern === join('/repo', '.claude', 'rules', '*.md')) {
          return [join('/repo', '.claude', 'rules', 'repo.md')];
        }
        throw new Error(`unmocked glob: ${pattern}`);
      });
      mockTryReadFileUtf8.mockImplementation((path) => {
        if (path === join('/home/me', '.claude', 'CLAUDE.md')) return 'home rule';
        if (path === join('/home/me', '.claude', 'rules', 'style.md')) {
          return ['---', 'globs:', '  - "*.ts"', '---', 'style rule'].join('\n');
        }
        if (path === join('/repo', 'CLAUDE.md')) return null;
        if (path === join('/repo', '.claude', 'rules', 'repo.md')) return 'repo rule';
        return null;
      });

      const rules = await run(
        Effect.gen(function* () {
          const service = yield* ConformService;
          return yield* service.discoverRules();
        }),
      );

      expect(rules).toEqual([
        { source: join('/home/me', '.claude', 'CLAUDE.md'), globs: [], content: 'home rule' },
        {
          source: join('/home/me', '.claude', 'rules', 'style.md'),
          globs: ['*.ts'],
          content: 'style rule',
        },
        { source: join('/repo', '.claude', 'rules', 'repo.md'), globs: [], content: 'repo rule' },
      ]);
      expect(mockGlobSync).toHaveBeenCalledWith(join('/home/me', '.claude', 'rules', '*.md'));
      expect(mockGlobSync).toHaveBeenCalledWith(join('/repo', '.claude', 'rules', '*.md'));
      expect(mockTryReadFileUtf8).toHaveBeenCalledWith(
        join('/home/me', '.claude', 'rules', 'missing.md'),
      );
    });

    it('rejects when discovery fails', async () => {
      mockHomedir.mockReturnValue('/home/me');
      mockGitRoot.mockImplementation(() => {
        throw new Error('git failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* ConformService;
            yield* service.discoverRules();
          }),
        ),
      ).rejects.toThrow('git failed');
    });
  });

  describe('readFiles', () => {
    it('reads changed files relative to the git root and drops missing files', async () => {
      mockGitRoot.mockReturnValue('/repo');
      mockTryReadFileUtf8.mockImplementation((path) => {
        if (path === join('/repo', 'src/app.ts')) return 'source';
        if (path === join('/repo', 'missing.ts')) return null;
        throw new Error(`unmocked read: ${path}`);
      });

      const files = await run(
        Effect.gen(function* () {
          const service = yield* ConformService;
          return yield* service.readFiles(['src/app.ts', 'missing.ts']);
        }),
      );

      expect(files).toEqual([{ path: 'src/app.ts', content: 'source' }]);
      expect(mockTryReadFileUtf8).toHaveBeenCalledWith(join('/repo', 'src/app.ts'));
      expect(mockTryReadFileUtf8).toHaveBeenCalledWith(join('/repo', 'missing.ts'));
    });

    it('rejects when file reading setup fails', async () => {
      mockGitRoot.mockImplementation(() => {
        throw new Error('root failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* ConformService;
            yield* service.readFiles(['src/app.ts']);
          }),
        ),
      ).rejects.toThrow('root failed');
    });
  });
});
