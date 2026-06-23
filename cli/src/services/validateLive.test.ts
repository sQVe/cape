import { globSync } from 'node:fs';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { ValidateService } from './validate';
import { ValidateServiceLive } from './validateLive';

vi.mock('node:fs', () => ({
  globSync: vi.fn(),
}));

vi.mock('../utils/fs', () => ({
  readFileUtf8: vi.fn(),
}));

vi.mock('../utils/git', () => ({
  gitRoot: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, ValidateService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(ValidateServiceLive)));

const mockGlobSync = vi.mocked(globSync);
const mockReadFileUtf8 = vi.mocked(readFileUtf8);
const mockGitRoot = vi.mocked(gitRoot);

afterEach(() => {
  vi.resetAllMocks();
});

describe('ValidateServiceLive', () => {
  describe('globFiles', () => {
    it('returns matching files', async () => {
      mockGlobSync.mockReturnValue(['skills/a.md', 'skills/b.md']);

      const files = await run(
        Effect.gen(function* () {
          const service = yield* ValidateService;
          return yield* service.globFiles('skills/*.md');
        }),
      );

      expect(files).toEqual(['skills/a.md', 'skills/b.md']);
      expect(mockGlobSync).toHaveBeenCalledWith('skills/*.md');
    });

    it('rejects when globSync throws', async () => {
      mockGlobSync.mockImplementation(() => {
        throw new Error('glob failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* ValidateService;
            yield* service.globFiles('bad/**/*.md');
          }),
        ),
      ).rejects.toThrow('glob failed');
      expect(mockGlobSync).toHaveBeenCalledWith('bad/**/*.md');
    });
  });

  describe('readFile', () => {
    it('returns file content', async () => {
      mockReadFileUtf8.mockReturnValue('content');

      const content = await run(
        Effect.gen(function* () {
          const service = yield* ValidateService;
          return yield* service.readFile('skills/a.md');
        }),
      );

      expect(content).toBe('content');
      expect(mockReadFileUtf8).toHaveBeenCalledWith('skills/a.md');
    });

    it('rejects when reading throws', async () => {
      mockReadFileUtf8.mockImplementation(() => {
        throw new Error('read failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* ValidateService;
            yield* service.readFile('missing.md');
          }),
        ),
      ).rejects.toThrow('read failed');
      expect(mockReadFileUtf8).toHaveBeenCalledWith('missing.md');
    });
  });

  describe('gitRoot', () => {
    it('returns the git root', async () => {
      mockGitRoot.mockReturnValue('/repo');

      const root = await run(
        Effect.gen(function* () {
          const service = yield* ValidateService;
          return yield* service.gitRoot();
        }),
      );

      expect(root).toBe('/repo');
      expect(mockGitRoot).toHaveBeenCalledWith();
    });

    it('rejects with Not a git repository when gitRoot throws', async () => {
      mockGitRoot.mockImplementation(() => {
        throw new Error('fatal');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* ValidateService;
            yield* service.gitRoot();
          }),
        ),
      ).rejects.toThrow('Not a git repository');
      expect(mockGitRoot).toHaveBeenCalledWith();
    });
  });
});
