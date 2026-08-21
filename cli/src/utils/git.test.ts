import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
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
  it('treats a nonzero exit as not-a-repo', () => {
    expect(gitFailureKind({ status: 128 })).toBe('no-repo');
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
