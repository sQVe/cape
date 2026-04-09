import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

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
    it('delegates to fs writeFileSync', async () => {
      await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          yield* service.writeFile('/path', 'data');
        }),
      );

      expect(mockWriteFileSync).toHaveBeenCalledWith('/path', 'data');
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

  describe('brQuery', () => {
    it('returns trimmed output', async () => {
      mockExecFileSync.mockReturnValue('  result  ');

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.brQuery(['list']);
        }),
      );

      expect(result).toBe('result');
    });

    it('returns null on error via orElseSucceed', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('br failed');
      });

      const result = await run(
        Effect.gen(function* () {
          const service = yield* HookService;
          return yield* service.brQuery(['list']);
        }),
      );

      expect(result).toBeNull();
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
