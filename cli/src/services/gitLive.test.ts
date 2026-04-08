import { execFileSync } from 'node:child_process';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GitService } from './git';
import { GitServiceLive } from './gitLive';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, GitService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(GitServiceLive)));

const mockExecFileSync = vi.mocked(execFileSync);

afterEach(() => {
  vi.resetAllMocks();
});

const gitRouter = (responses: Record<string, string>) => {
  return (...args: unknown[]) => {
    const gitArgs = args[1] as string[];
    const key = gitArgs.join(' ');
    for (const [pattern, value] of Object.entries(responses)) {
      if (key.includes(pattern)) {
        return value;
      }
    }
    throw new Error(`unmocked git call: ${key}`);
  };
};

describe('GitServiceLive', () => {
  describe('getContext', () => {
    it('assembles context with detected main branch', async () => {
      mockExecFileSync.mockImplementation(
        gitRouter({
          'rev-parse --git-dir': '.git',
          'symbolic-ref refs/remotes/origin/HEAD': 'refs/remotes/origin/main',
          'branch --show-current': 'feat/test',
          'status --porcelain': 'M file.ts',
          'diff --stat': ' 1 file changed',
          'log --oneline': 'abc1234 first\ndef5678 second',
        }) as typeof execFileSync,
      );

      const ctx = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getContext();
        }),
      );

      expect(ctx.mainBranch).toBe('main');
      expect(ctx.currentBranch).toBe('feat/test');
      expect(ctx.status).toEqual(['M file.ts']);
      expect(ctx.recentLog).toHaveLength(2);
    });

    it('falls back to main when origin/HEAD is unavailable', async () => {
      mockExecFileSync.mockImplementation(
        gitRouter({
          'rev-parse --git-dir': '.git',
          'rev-parse --verify main': 'sha',
          'branch --show-current': 'feat/x',
          'status --porcelain': '',
          'diff --stat': '',
          'log --oneline': '',
        }) as typeof execFileSync,
      );

      const ctx = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getContext();
        }),
      );

      expect(ctx.mainBranch).toBe('main');
    });

    it('falls back to master when main does not exist', async () => {
      const responses: Record<string, string> = {
        'rev-parse --git-dir': '.git',
        'rev-parse --verify master': 'sha',
        'branch --show-current': 'feat/x',
        'status --porcelain': '',
        'diff --stat': '',
        'log --oneline': '',
      };
      mockExecFileSync.mockImplementation(
        ((...args: unknown[]) => {
          const gitArgs = args[1] as string[];
          const key = gitArgs.join(' ');
          if (key.includes('symbolic-ref') || key.includes('--verify main')) {
            throw new Error('not found');
          }
          for (const [pattern, value] of Object.entries(responses)) {
            if (key.includes(pattern)) {
              return value;
            }
          }
          throw new Error(`unmocked: ${key}`);
        }) as typeof execFileSync,
      );

      const ctx = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getContext();
        }),
      );

      expect(ctx.mainBranch).toBe('master');
    });

    it('defaults to main when nothing resolves', async () => {
      const responses: Record<string, string> = {
        'rev-parse --git-dir': '.git',
        'branch --show-current': 'feat/x',
        'status --porcelain': '',
        'diff --stat': '',
        'log --oneline': '',
      };
      mockExecFileSync.mockImplementation(
        ((...args: unknown[]) => {
          const gitArgs = args[1] as string[];
          const key = gitArgs.join(' ');
          if (
            key.includes('symbolic-ref') ||
            key.includes('--verify main') ||
            key.includes('--verify master')
          ) {
            throw new Error('not found');
          }
          for (const [pattern, value] of Object.entries(responses)) {
            if (key.includes(pattern)) {
              return value;
            }
          }
          throw new Error(`unmocked: ${key}`);
        }) as typeof execFileSync,
      );

      const ctx = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getContext();
        }),
      );

      expect(ctx.mainBranch).toBe('main');
    });

    it('rejects when not a git repository', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('not a git repo');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* GitService;
            yield* service.getContext();
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('getDiff', () => {
    const baseMock = () => {
      mockExecFileSync.mockImplementation(
        gitRouter({
          'rev-parse --git-dir': '.git',
          'symbolic-ref refs/remotes/origin/HEAD': 'refs/remotes/origin/main',
          'diff --cached': 'staged diff',
          'diff main...HEAD': 'branch diff',
        }) as typeof execFileSync,
      );
    };

    it('returns unstaged diff', async () => {
      mockExecFileSync.mockImplementation(
        ((...args: unknown[]) => {
          const gitArgs = args[1] as string[];
          const key = gitArgs.join(' ');
          if (key === 'diff') {
            return 'unstaged diff';
          }
          if (key.includes('rev-parse --git-dir')) {
            return '.git';
          }
          if (key.includes('symbolic-ref')) {
            return 'refs/remotes/origin/main';
          }
          throw new Error(`unmocked: ${key}`);
        }) as typeof execFileSync,
      );

      const diff = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getDiff('unstaged');
        }),
      );

      expect(diff).toContain('unstaged diff');
    });

    it('returns staged diff with --cached', async () => {
      baseMock();

      const diff = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getDiff('staged');
        }),
      );

      expect(diff).toContain('staged diff');
    });

    it('returns branch diff against main', async () => {
      baseMock();

      const diff = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getDiff('branch');
        }),
      );

      expect(diff).toContain('branch diff');
    });

    it('appends uncommitted changes for pr scope', async () => {
      mockExecFileSync.mockImplementation(
        ((...args: unknown[]) => {
          const gitArgs = args[1] as string[];
          const key = gitArgs.join(' ');
          if (key.includes('rev-parse --git-dir')) {
            return '.git';
          }
          if (key.includes('symbolic-ref')) {
            return 'refs/remotes/origin/main';
          }
          if (key === 'diff main...HEAD') {
            return 'branch part';
          }
          if (key === 'diff') {
            return 'uncommitted part';
          }
          throw new Error(`unmocked: ${key}`);
        }) as typeof execFileSync,
      );

      const diff = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.getDiff('pr');
        }),
      );

      expect(diff).toContain('branch part');
      expect(diff).toContain('uncommitted part');
    });
  });

  describe('validateBranch', () => {
    it('returns valid for a well-formed branch', async () => {
      mockExecFileSync.mockImplementation(
        ((...args: unknown[]) => {
          const gitArgs = args[1] as string[];
          const key = gitArgs.join(' ');
          if (key.includes('rev-parse --git-dir')) {
            return '.git';
          }
          if (key.includes('check-ref-format')) {
            return 'feat/my-branch';
          }
          if (key.includes('rev-parse --verify')) {
            throw new Error('not found');
          }
          throw new Error(`unmocked: ${key}`);
        }) as typeof execFileSync,
      );

      const result = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.validateBranch('feat/my-branch');
        }),
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accumulates multiple validation errors', async () => {
      mockExecFileSync.mockImplementation(
        ((...args: unknown[]) => {
          const gitArgs = args[1] as string[];
          const key = gitArgs.join(' ');
          if (key.includes('rev-parse --git-dir')) {
            return '.git';
          }
          if (key.includes('check-ref-format')) {
            throw new Error('invalid');
          }
          if (key.includes('refs/heads/bad-name')) {
            return 'sha';
          }
          if (key.includes('refs/remotes/origin/bad-name')) {
            return 'sha';
          }
          throw new Error(`unmocked: ${key}`);
        }) as typeof execFileSync,
      );

      const result = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.validateBranch('bad-name');
        }),
      );

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('createBranch', () => {
    it('creates and returns branch info', async () => {
      mockExecFileSync.mockReturnValue('Switched to a new branch');

      const result = await run(
        Effect.gen(function* () {
          const service = yield* GitService;
          return yield* service.createBranch('feat/new');
        }),
      );

      expect(result.created).toBe(true);
      expect(result.branch).toBe('feat/new');
    });

    it('rejects when checkout fails', async () => {
      mockExecFileSync.mockImplementation(() => {
        throw new Error('branch exists');
      });

      await expect(
        run(
          Effect.gen(function* () {
            const service = yield* GitService;
            yield* service.createBranch('feat/existing');
          }),
        ),
      ).rejects.toThrow();
    });
  });
});
