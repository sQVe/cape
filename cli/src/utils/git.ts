import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export const gitRoot = (): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();

export type GitCommonDir =
  | { readonly kind: 'ok'; readonly commonDir: string }
  | { readonly kind: 'no-repo' }
  | { readonly kind: 'unavailable' };

// A nonzero exit means git ran and answered "not a repo". Anything else means
// git never answered, and callers must not treat the two alike: mistaking a
// timeout for not-a-repo sends a repository's cache into the shared fallback
// file. hookLive.ts draws the same distinction for the same reason.
export const gitFailureKind = (error: unknown): 'no-repo' | 'unavailable' => {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && status !== 0 ? 'no-repo' : 'unavailable';
};

// Resolved against cwd because git prints a relative `.git` for the ordinary
// case and an absolute path only from a linked worktree, then realpath'd so a
// symlinked and a physical route to one repository agree on a single cache.
export const gitCommonDir = (cwd?: string): GitCommonDir => {
  let raw: string;
  try {
    raw = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch (error) {
    return { kind: gitFailureKind(error) };
  }

  if (raw === '') {
    return { kind: 'no-repo' };
  }

  const resolved = resolve(cwd ?? '.', raw);
  try {
    return { kind: 'ok', commonDir: realpathSync(resolved) };
  } catch {
    return { kind: 'ok', commonDir: resolved };
  }
};
