import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { HookService, stateFilePath } from '../hook';

const resolveStatePath = (gitDir: string | null, commonDir: string | null) => {
  const gitResponses: Record<string, string | null> = {
    'rev-parse --git-dir': gitDir,
    'rev-parse --git-common-dir': commonDir,
  };
  return Effect.runPromise(
    stateFilePath().pipe(
      Effect.provide(
        Layer.succeed(HookService)({
          pluginRoot: () => '/test',
          readFile: () => Effect.succeed(null),
          writeFile: () => Effect.succeed(undefined),
          removeFile: () => Effect.succeed(undefined),
          ensureDir: () => Effect.succeed(undefined),
          readStdin: () => Effect.succeed(''),
          spawnGit: (args) => Effect.succeed(gitResponses[args.join(' ')] ?? null),
          fileExists: () => Effect.succeed(false),
        }),
      ),
    ),
  );
};

describe('stateFilePath', () => {
  it('isolates repositories with distinct git common directories', async () => {
    const repoA = await resolveStatePath('/repo-a/.git', '/repo-a/.git');
    const repoB = await resolveStatePath('/repo-b/.git', '/repo-b/.git');

    expect(repoA.path).not.toBe(repoB.path);
  });

  it('isolates a linked worktree from its main tree', async () => {
    const main = await resolveStatePath('/repo/.git', '/repo/.git');
    const worktree = await resolveStatePath('/repo/.git/worktrees/feature', '/repo/.git');

    expect(main.dir).toBe(worktree.dir);
    expect(main.path).not.toBe(worktree.path);
  });

  it('isolates worktrees whose sanitized names collide', async () => {
    const plus = await resolveStatePath('/repo/.git/worktrees/a+b', '/repo/.git');
    const dash = await resolveStatePath('/repo/.git/worktrees/a-b', '/repo/.git');

    expect(plus.path).toMatch(/\/state-a-b-[a-f0-9]{8}\.json$/);
    expect(plus.path).not.toBe(dash.path);
  });

  it('returns the same path for the same worktree across invocations', async () => {
    const first = await resolveStatePath('/repo/.git/worktrees/feature', '/repo/.git');
    const second = await resolveStatePath('/repo/.git/worktrees/feature', '/repo/.git');

    expect(first).toEqual(second);
  });

  it('returns a deterministic fallback outside a git repository', async () => {
    const first = await resolveStatePath(null, null);
    const second = await resolveStatePath(null, null);

    expect(first).toEqual(second);
  });
});
