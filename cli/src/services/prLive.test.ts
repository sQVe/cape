import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { readFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { PrService } from './pr';
import { PrServiceLive } from './prLive';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}));

vi.mock('../utils/fs', () => ({
  readFileUtf8: vi.fn(),
}));

vi.mock('../utils/git', () => ({
  gitRoot: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, PrService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(PrServiceLive)));

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockReadFileUtf8 = vi.mocked(readFileUtf8);
const mockGitRoot = vi.mocked(gitRoot);

afterEach(() => {
  vi.resetAllMocks();
});

describe('PrServiceLive', () => {
  describe('fileExists', () => {
    it('delegates to fs existsSync', async () => {
      mockExistsSync.mockReturnValue(true);

      const exists = await run(
        Effect.gen(function* () {
          const service = yield* PrService;
          return yield* service.fileExists('/repo/.github/pull_request_template.md');
        }),
      );

      expect(exists).toBe(true);
      expect(mockExistsSync).toHaveBeenCalledWith('/repo/.github/pull_request_template.md');
    });
  });

  describe('readFile', () => {
    it('returns utf-8 file content', async () => {
      mockReadFileUtf8.mockReturnValue('template');

      const content = await run(
        Effect.gen(function* () {
          const service = yield* PrService;
          return yield* service.readFile('/repo/template.md');
        }),
      );

      expect(content).toBe('template');
      expect(mockReadFileUtf8).toHaveBeenCalledWith('/repo/template.md');
    });

    it('rejects when reading fails', async () => {
      mockReadFileUtf8.mockImplementation(() => {
        throw new Error('read failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* PrService;
            yield* service.readFile('/repo/missing.md');
          }),
        ),
      ).rejects.toThrow('read failed');
      expect(mockReadFileUtf8).toHaveBeenCalledWith('/repo/missing.md');
    });
  });

  describe('readStdin', () => {
    it('returns trimmed stdin', async () => {
      mockReadFileSync.mockReturnValue(' body \n');

      const body = await run(
        Effect.gen(function* () {
          const service = yield* PrService;
          return yield* service.readStdin();
        }),
      );

      expect(body).toBe('body');
      expect(mockReadFileSync).toHaveBeenCalledWith('/dev/stdin', 'utf-8');
    });

    it('rejects when stdin cannot be read', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error('stdin failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* PrService;
            yield* service.readStdin();
          }),
        ),
      ).rejects.toThrow('stdin failed');
      expect(mockReadFileSync).toHaveBeenCalledWith('/dev/stdin', 'utf-8');
    });
  });

  describe('gitRoot', () => {
    it('returns the git root', async () => {
      mockGitRoot.mockReturnValue('/repo');

      const root = await run(
        Effect.gen(function* () {
          const service = yield* PrService;
          return yield* service.gitRoot();
        }),
      );

      expect(root).toBe('/repo');
      expect(mockGitRoot).toHaveBeenCalledWith();
    });

    it('rejects with not-a-repository error for non-Error throws', async () => {
      mockGitRoot.mockImplementation(() => {
        throw 'no repo';
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* PrService;
            yield* service.gitRoot();
          }),
        ),
      ).rejects.toThrow('not a git repository');
      expect(mockGitRoot).toHaveBeenCalledWith();
    });
  });

  describe('spawnGh', () => {
    it('returns trimmed gh output', async () => {
      mockExecFileSync.mockReturnValue(' https://github.com/org/repo/pull/1 \n');

      const url = await run(
        Effect.gen(function* () {
          const service = yield* PrService;
          return yield* service.spawnGh(['pr', 'create', '--fill']);
        }),
      );

      expect(url).toBe('https://github.com/org/repo/pull/1');
      expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['pr', 'create', '--fill'], {
        encoding: 'utf-8',
        timeout: 30_000,
      });
    });

    it('surfaces gh stderr as the error message', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw { stderr: ' authentication required \n' };
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* PrService;
            yield* service.spawnGh(['pr', 'create']);
          }),
        ),
      ).rejects.toThrow('authentication required');
      expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['pr', 'create'], {
        encoding: 'utf-8',
        timeout: 30_000,
      });
    });

    it('uses the generic fallback for non-Error gh failures', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw 'failed';
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* PrService;
            yield* service.spawnGh(['auth', 'status']);
          }),
        ),
      ).rejects.toThrow('gh command failed');
      expect(mockExecFileSync).toHaveBeenCalledWith('gh', ['auth', 'status'], {
        encoding: 'utf-8',
        timeout: 30_000,
      });
    });
  });
});
