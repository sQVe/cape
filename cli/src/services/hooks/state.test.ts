import { Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';

import { HookService, stateFileName, stateFilePath, stateResetPaths } from '../hook';
import type { GitSpawnResult } from '../hook';

const makeLayer = (gitResult: GitSpawnResult) =>
  Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: () => Effect.succeed(null),
    writeFile: () => Effect.succeed(undefined),
    removeFile: () => Effect.succeed(undefined),
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    spawnGitChecked: () => Effect.succeed(gitResult),
    fileExists: () => Effect.succeed(false),
  });

const resolveStatePath = (gitDir: string | null, commonDir: string | null) => {
  const gitResult: GitSpawnResult =
    gitDir == null || commonDir == null
      ? { kind: 'exit-nonzero' }
      : { kind: 'ok', stdout: `${gitDir}\n${commonDir}` };
  return Effect.runPromise(stateFilePath().pipe(Effect.provide(makeLayer(gitResult))));
};

describe('stateFilePath', () => {
  it('isolates repositories with distinct git dirs', async () => {
    const repoA = await resolveStatePath('/repo-a/.git', '/repo-a/.git');
    const repoB = await resolveStatePath('/repo-b/.git', '/repo-b/.git');

    expect(repoA?.path).not.toBe(repoB?.path);
  });

  it('isolates a linked worktree from its main tree', async () => {
    const main = await resolveStatePath('/repo/.git', '/repo/.git');
    const worktree = await resolveStatePath('/repo/.git/worktrees/feature', '/repo/.git');

    expect(main?.path).not.toBe(worktree?.path);
  });

  it('derives the filename from stateFileName so tests and production share the scheme', async () => {
    const worktree = await resolveStatePath('/repo/.git/worktrees/feature', '/repo/.git');

    expect(worktree?.path).toBe(
      `/test/hooks/context/${stateFileName('/repo/.git/worktrees/feature')}`,
    );
    expect(worktree?.path).toMatch(/\/state-[a-f0-9]{64}\.json$/);
  });

  it('normalizes relative git dirs before hashing', async () => {
    const absolute = await resolveStatePath('/repo/.git', '/repo/.git');
    const viaParent = await resolveStatePath('/repo/sub/../.git', '/repo/.git');

    expect(absolute?.path).toBe(viaParent?.path);
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
    expect(first?.path).toBe('/test/hooks/context/state-no-repo.json');
  });

  it('returns null when git is unavailable instead of misdirecting to the fallback', async () => {
    const path = await Effect.runPromise(
      stateFilePath().pipe(Effect.provide(makeLayer({ kind: 'unavailable' }))),
    );

    expect(path).toBeNull();
  });
});

describe('stateResetPaths', () => {
  it('includes the current path, the legacy fallback, and the legacy worktree file', async () => {
    const paths = await Effect.runPromise(
      stateResetPaths().pipe(
        Effect.provide(
          makeLayer({ kind: 'ok', stdout: '/repo/.git/worktrees/feat+x\n/repo/.git' }),
        ),
      ),
    );

    expect(paths).toContain(`/test/hooks/context/${stateFileName('/repo/.git/worktrees/feat+x')}`);
    expect(paths).toContain('/test/hooks/context/state.json');
    expect(paths).toContain('/test/hooks/context/state-feat-x.json');
  });

  it('covers the fallback files outside a git repository', async () => {
    const paths = await Effect.runPromise(
      stateResetPaths().pipe(Effect.provide(makeLayer({ kind: 'exit-nonzero' }))),
    );

    expect(paths).toContain('/test/hooks/context/state-no-repo.json');
    expect(paths).toContain('/test/hooks/context/state.json');
  });

  it('returns nothing when git is unavailable', async () => {
    const paths = await Effect.runPromise(
      stateResetPaths().pipe(Effect.provide(makeLayer({ kind: 'unavailable' }))),
    );

    expect(paths).toEqual([]);
  });
});
