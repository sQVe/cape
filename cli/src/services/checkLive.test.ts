import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CheckService } from './check';
import { CheckServiceLive } from './checkLive';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, CheckService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(CheckServiceLive)));

const mockSpawnSync = vi.mocked(spawnSync);
const mockExistsSync = vi.mocked(existsSync);

afterEach(() => {
  vi.resetAllMocks();
});

describe('CheckServiceLive', () => {
  describe('runChecks', () => {
    it('returns passed checks for status zero', async () => {
      mockExistsSync.mockImplementation((path) => path === 'pnpm-lock.yaml');
      mockSpawnSync.mockReturnValue({
        status: 0,
        stdout: 'ok',
        stderr: '',
      } as ReturnType<typeof spawnSync>);

      const results = await run(
        Effect.gen(function* () {
          const service = yield* CheckService;
          return yield* service.runChecks([
            {
              language: 'typescript',
              testFramework: 'vitest',
              linter: null,
              formatter: null,
            },
          ]);
        }),
      );

      expect(results).toEqual([{ check: 'vitest', passed: true, output: 'ok' }]);
      expect(mockExistsSync).toHaveBeenCalledWith('pnpm-lock.yaml');
      expect(mockSpawnSync).toHaveBeenCalledWith('pnpm', ['exec', 'vitest', 'run'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('captures stdout and stderr for failing commands', async () => {
      mockExistsSync.mockReturnValue(false);
      mockSpawnSync.mockReturnValue({
        status: 1,
        stdout: 'stdout',
        stderr: 'stderr',
      } as ReturnType<typeof spawnSync>);

      const results = await run(
        Effect.gen(function* () {
          const service = yield* CheckService;
          return yield* service.runChecks([
            {
              language: 'python',
              testFramework: 'pytest',
              linter: null,
              formatter: null,
            },
          ]);
        }),
      );

      expect(results).toEqual([{ check: 'pytest', passed: false, output: 'stdout\nstderr' }]);
      expect(mockSpawnSync).toHaveBeenCalledWith('pytest', [], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('rejects when command execution throws', async () => {
      mockExistsSync.mockReturnValue(false);
      mockSpawnSync.mockImplementation(() => {
        throw new Error('spawn failed');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* CheckService;
            yield* service.runChecks([
              {
                language: 'go',
                testFramework: 'go-test',
                linter: null,
                formatter: null,
              },
            ]);
          }),
        ),
      ).rejects.toThrow('spawn failed');
      expect(mockSpawnSync).toHaveBeenCalledWith('go', ['test', './...'], {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });
  });
});
