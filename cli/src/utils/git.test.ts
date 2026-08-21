import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitCommonDir, gitFailureKind, gitRoot } from './git';

describe('gitRoot', () => {
  it('returns the git repository root when invoked inside one', () => {
    const root = gitRoot();
    expect(root.length).toBeGreaterThan(0);
    expect(root.includes('\n')).toBe(false);
  });
});

describe('gitFailureKind', () => {
  // Only no-repo may take the shared fallback cache file, so anything that is
  // not a positive not-a-repository answer has to fail closed.
  it('treats an explicit not-a-repository answer as no-repo', () => {
    expect(
      gitFailureKind({
        status: 128,
        stderr: 'fatal: not a git repository (or any parent up to mount point /)',
      }),
    ).toBe('no-repo');
  });

  // git exits 128 for many reasons besides "not a repository" — a broken
  // config and a dubious-ownership refusal both do. Those are real
  // repositories, so falling back would put them in the shared cache.
  it('treats a broken config inside a real repository as unavailable', () => {
    expect(
      gitFailureKind({ status: 128, stderr: 'fatal: bad config line 1 in file .git/config' }),
    ).toBe('unavailable');
  });

  it('treats a dubious-ownership refusal as unavailable', () => {
    expect(
      gitFailureKind({
        status: 128,
        stderr: 'fatal: detected dubious ownership in repository at ...',
      }),
    ).toBe('unavailable');
  });

  it('accepts the parent-directories phrasing of not-a-repository', () => {
    expect(
      gitFailureKind({
        status: 128,
        stderr: 'fatal: not a git repository (or any of the parent directories): .git',
      }),
    ).toBe('no-repo');
  });

  // A worktree whose .git pointer is broken says "not a git repository: <path>",
  // naming a gitdir instead of reporting a failed parent search. It is a real
  // repository, so it must not reach the shared fallback.
  it('treats a broken gitdir pointer as unavailable', () => {
    expect(gitFailureKind({ status: 128, stderr: 'fatal: not a git repository: (null)' })).toBe(
      'unavailable',
    );
  });

  it('treats a nonzero exit with no stderr as unavailable', () => {
    expect(gitFailureKind({ status: 128 })).toBe('unavailable');
  });

  it('treats a missing binary as unavailable', () => {
    expect(gitFailureKind({ code: 'ENOENT' })).toBe('unavailable');
  });

  it('treats a timeout as unavailable', () => {
    expect(gitFailureKind({ signal: 'SIGTERM' })).toBe('unavailable');
  });
});

describe('gitCommonDir', () => {
  let scratch: string | null = null;

  afterEach(() => {
    if (scratch != null) {
      rmSync(scratch, { recursive: true, force: true });
      scratch = null;
    }
  });

  it('reports ok with an absolute path inside a repository', () => {
    const result = gitCommonDir();
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') {
      return;
    }
    expect(result.commonDir.startsWith('/')).toBe(true);
    expect(result.commonDir.includes('\n')).toBe(false);
  });

  it('reports no-repo outside a repository', () => {
    expect(gitCommonDir('/')).toEqual({ kind: 'no-repo' });
  });

  // git translates its fatal messages, so the classifier only works if the
  // spawn pins the locale. Without that, a Swedish shell gets "inte ett
  // git-arkiv" and every non-repo invocation fails closed instead.
  it('reports no-repo outside a repository under a translated locale', () => {
    const previous = process.env.LC_ALL;
    process.env.LC_ALL = 'sv_SE.utf8';
    try {
      expect(gitCommonDir('/tmp')).toEqual({ kind: 'no-repo' });
    } finally {
      if (previous == null) {
        delete process.env.LC_ALL;
      } else {
        process.env.LC_ALL = previous;
      }
    }
  });

  // A real repository git refuses to read must never take the shared fallback,
  // which is what every non-repo invocation writes to.
  it('reports unavailable for a real repository git cannot read', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cape-git-'));
    const repo = join(scratch, 'repo');
    execFileSync('git', ['init', '-b', 'main', repo], { stdio: 'ignore' });
    writeFileSync(join(repo, '.git', 'config'), '[core\nbroken\n');

    expect(gitCommonDir(repo)).toEqual({ kind: 'unavailable' });
  });

  it('reports unavailable for a worktree whose gitdir pointer is broken', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cape-git-'));
    const main = join(scratch, 'main');
    execFileSync('git', ['init', '-b', 'main', main], { stdio: 'ignore' });
    execFileSync(
      'git',
      ['-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'init'],
      {
        cwd: main,
        stdio: 'ignore',
        env: {
          ...process.env,
          GIT_AUTHOR_NAME: 't',
          GIT_AUTHOR_EMAIL: 't@t',
          GIT_COMMITTER_NAME: 't',
          GIT_COMMITTER_EMAIL: 't@t',
        }, // eslint-disable-line node/no-process-env
      },
    );
    const worktree = join(scratch, 'wt');
    execFileSync('git', ['worktree', 'add', '-q', worktree, '-b', 'wt'], {
      cwd: main,
      stdio: 'ignore',
    });
    writeFileSync(join(worktree, '.git'), `gitdir: ${join(scratch, 'gone')}/.git/worktrees/wt\n`);

    expect(gitCommonDir(worktree)).toEqual({ kind: 'unavailable' });
  });

  it('resolves a symlinked path to the same common dir as the real one', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cape-git-'));
    const real = join(scratch, 'real');
    mkdirSync(real);
    execFileSync('git', ['init', '-b', 'main', real], { stdio: 'ignore' });
    const link = join(scratch, 'link');
    symlinkSync(real, link);

    expect(gitCommonDir(link)).toEqual(gitCommonDir(real));
  });
});
