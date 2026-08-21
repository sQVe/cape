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
  // hookLive.ts draws this same distinction: a transient failure must never be
  // mistaken for "not a repo", or the cache write lands in the shared file.
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

  // A real repository git refuses to read must never take the shared fallback,
  // which is what every non-repo invocation writes to.
  it('reports unavailable for a real repository git cannot read', () => {
    scratch = mkdtempSync(join(tmpdir(), 'cape-git-'));
    const repo = join(scratch, 'repo');
    execFileSync('git', ['init', '-b', 'main', repo], { stdio: 'ignore' });
    writeFileSync(join(repo, '.git', 'config'), '[core\nbroken\n');

    expect(gitCommonDir(repo)).toEqual({ kind: 'unavailable' });
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
