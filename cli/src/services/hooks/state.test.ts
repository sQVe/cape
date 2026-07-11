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

  it('isolates worktrees with colliding truncated hashes', async () => {
    const first = await resolveStatePath('/repo/.git/worktrees/$!@!@++', '/repo/.git');
    const second = await resolveStatePath('/repo/.git/worktrees/@)#)#++', '/repo/.git');

    expect(first.path).toMatch(/\/state-{9}bd48f6e5[a-f0-9]{56}\.json$/);
    expect(second.path).toMatch(/\/state-{9}bd48f6e5[a-f0-9]{56}\.json$/);
    expect(first.path).not.toBe(second.path);
  });

  it('bounds the filename for long worktree names while keeping them distinct', async () => {
    const longA = `${'a'.repeat(150)}x`;
    const longB = `${'a'.repeat(150)}y`;
    const first = await resolveStatePath(`/repo/.git/worktrees/${longA}`, '/repo/.git');
    const second = await resolveStatePath(`/repo/.git/worktrees/${longB}`, '/repo/.git');

    const filename = first.path.split('/').pop() ?? '';
    expect(filename.length).toBeLessThanOrEqual(200);
    expect(first.path).not.toBe(second.path);
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
