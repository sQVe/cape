import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HookService } from './hook';
import { HookServiceLive } from './hookLive';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  renameSync: vi.fn(),
  statSync: vi.fn(),
  writeFileSync: vi.fn(),
  rmSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('../pluginRoot', () => ({
  pluginRoot: () => '/test/root',
}));

const run = <A>(effect: Effect.Effect<A, never, HookService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(HookServiceLive)));

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockRenameSync = vi.mocked(renameSync);
const mockStatSync = vi.mocked(statSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockRmSync = vi.mocked(rmSync);
const mockMkdirSync = vi.mocked(mkdirSync);

afterEach(() => {
  vi.resetAllMocks();
});

describe('HookServiceLive', () => {
  describe('readFile', () => {
    it('returns content for existing file', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('file content');

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.readFile('/some/path');
        }),
      );

      expect(result).toBe('file content');
    });

    it('returns null for non-existent file', async () => {
      mockReadFileSync.mockImplementation(() => {
        throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.readFile('/missing');
        }),
      );

      expect(result).toBeNull();
    });

    it('returns null on read error via orElseSucceed', async () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockImplementation(() => {
        throw new Error('read error');
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.readFile('/bad');
        }),
      );

      expect(result).toBeNull();
    });
  });

  describe('writeFile', () => {
    it('writes to a temp file before renaming it over the target', async () => {
      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.writeFile('/dir/path', 'data');
        }),
      );

      const tempPath = mockWriteFileSync.mock.calls[0]?.[0];
      expect(tempPath).toMatch(/^\/dir\/path\..+\.tmp$/);
      expect(mockWriteFileSync).toHaveBeenCalledWith(tempPath, 'data', {});
      expect(mockRenameSync).toHaveBeenCalledWith(tempPath, '/dir/path');
      expect(mockWriteFileSync.mock.invocationCallOrder[0]).toBeLessThan(
        mockRenameSync.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it('preserves the existing file mode on the temp file', async () => {
      mockStatSync.mockReturnValue({ mode: 0o600 } as ReturnType<typeof statSync>);

      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.writeFile('/dir/path', 'data');
        }),
      );

      const tempPath = mockWriteFileSync.mock.calls[0]?.[0];
      expect(mockWriteFileSync).toHaveBeenCalledWith(tempPath, 'data', { mode: 0o600 });
    });

    it('removes the temp file when the rename fails', async () => {
      mockRenameSync.mockImplementation(() => {
        throw new Error('rename error');
      });

      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.writeFile('/dir/path', 'data');
        }),
      );

      const tempPath = mockWriteFileSync.mock.calls[0]?.[0];
      expect(mockRmSync).toHaveBeenCalledWith(tempPath, { force: true });
    });

    it('swallows errors via orElseSucceed', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('write error');
      });

      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.writeFile('/bad', 'data');
        }),
      );
    });
  });

  describe('removeFile', () => {
    it('delegates to fs rmSync with force', async () => {
      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.removeFile('/path');
        }),
      );

      expect(mockRmSync).toHaveBeenCalledWith('/path', { force: true });
    });

    it('swallows errors via orElseSucceed', async () => {
      mockRmSync.mockImplementation(() => {
        throw new Error('rm error');
      });

      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.removeFile('/bad');
        }),
      );
    });
  });

  describe('ensureDir', () => {
    it('delegates to fs mkdirSync with recursive', async () => {
      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.ensureDir('/some/dir');
        }),
      );

      expect(mockMkdirSync).toHaveBeenCalledWith('/some/dir', { recursive: true });
    });
  });

  describe('spawnGit', () => {
    it('returns trimmed output', async () => {
      mockExecFileSync.mockReturnValue('  sha123  ');

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.spawnGit(['rev-parse', 'HEAD']);
        }),
      );

      expect(result).toBe('sha123');
    });

    it('returns null for empty output', async () => {
      mockExecFileSync.mockReturnValue('  ');

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.spawnGit(['status']);
        }),
      );

      expect(result).toBeNull();
    });

    it('returns null on error via orElseSucceed', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('git failed');
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.spawnGit(['bad']);
        }),
      );

      expect(result).toBeNull();
    });
  });

  describe('spawnGitChecked', () => {
    it('returns ok with trimmed stdout on success', async () => {
      mockExecFileSync.mockReturnValue('/repo/.git\n/repo/.git\n');

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.spawnGitChecked(['rev-parse', '--git-dir', '--git-common-dir']);
        }),
      );

      expect(result).toEqual({ kind: 'ok', stdout: '/repo/.git\n/repo/.git' });
    });

    it('returns exit-nonzero when git exits with a nonzero status', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw Object.assign(new Error('not a git repository'), { status: 128 });
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.spawnGitChecked(['rev-parse', '--git-dir', '--git-common-dir']);
        }),
      );

      expect(result).toEqual({ kind: 'exit-nonzero' });
    });

    it('returns unavailable when git never answers', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw Object.assign(new Error('spawn timed out'), { status: null, signal: 'SIGTERM' });
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.spawnGitChecked(['rev-parse', '--git-dir', '--git-common-dir']);
        }),
      );

      expect(result).toEqual({ kind: 'unavailable' });
    });
  });

  describe('fileExists', () => {
    it('returns true when file exists', async () => {
      mockExistsSync.mockReturnValue(true);

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.fileExists('/exists');
        }),
      );

      expect(result).toBe(true);
    });

    it('returns false when file is missing', async () => {
      mockExistsSync.mockReturnValue(false);

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.fileExists('/missing');
        }),
      );

      expect(result).toBe(false);
    });
  });

  describe('pluginRoot', () => {
    it('returns the plugin root path', async () => {
      const root = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return service.pluginRoot();
        }),
      );

      expect(root).toBe('/test/root');
    });
  });
});
