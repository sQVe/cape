import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CommitService } from './commit';
import { CommitServiceLive } from './commitLive';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, CommitService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(CommitServiceLive)));

const mockExecFileSync = vi.mocked(execFileSync);
const mockExistsSync = vi.mocked(existsSync);

afterEach(() => {
  vi.resetAllMocks();
});

describe('CommitServiceLive', () => {
  describe('stageAndCommit', () => {
    it('stages existing files with git add and deleted files with git rm', async () => {
      mockExistsSync.mockImplementation((f) => f === 'exists.ts');

      await run(
        Effect.gen(function* () {
          const service = yield* CommitService;
          yield* service.stageAndCommit(['exists.ts', 'deleted.ts'], 'test');
        }),
      );

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['add', '--', 'exists.ts'],
        expect.objectContaining({ encoding: 'utf-8' }),
      );
      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['rm', '--quiet', '--cached', '--', 'deleted.ts'],
        expect.objectContaining({ encoding: 'utf-8' }),
      );
    });

    it('skips git add when no existing files', async () => {
      mockExistsSync.mockReturnValue(false);

      await run(
        Effect.gen(function* () {
          const service = yield* CommitService;
          yield* service.stageAndCommit(['deleted.ts'], 'test');
        }),
      );

      const addCalls = mockExecFileSync.mock.calls.filter(
        ([, args]) => Array.isArray(args) && args[0] === 'add',
      );
      expect(addCalls).toHaveLength(0);
    });

    it('skips git rm when no deleted files', async () => {
      mockExistsSync.mockReturnValue(true);

      await run(
        Effect.gen(function* () {
          const service = yield* CommitService;
          yield* service.stageAndCommit(['exists.ts'], 'test');
        }),
      );

      const rmCalls = mockExecFileSync.mock.calls.filter(
        ([, args]) => Array.isArray(args) && args[0] === 'rm',
      );
      expect(rmCalls).toHaveLength(0);
    });

    it('rejects on failure', async () => {
      mockExistsSync.mockReturnValue(true);
      mockExecFileSync.mockImplementation(() => {
        throw new Error('staging failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* CommitService;
            yield* service.stageAndCommit(['f.ts'], 'msg');
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('commitNoEdit', () => {
    it('runs commit with --no-edit flag', async () => {
      await run(
        Effect.gen(function* () {
          const service = yield* CommitService;
          yield* service.commitNoEdit();
        }),
      );

      expect(mockExecFileSync).toHaveBeenCalledWith(
        'git',
        ['commit', '--no-edit'],
        expect.objectContaining({ encoding: 'utf-8' }),
      );
    });

    it('rejects on failure', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* CommitService;
            yield* service.commitNoEdit();
          }),
        ),
      ).rejects.toThrow();
    });
  });
});
