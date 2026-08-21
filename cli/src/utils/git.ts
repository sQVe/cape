import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

export const gitRoot = (): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();

// Resolved against cwd because git prints a relative `.git` for the ordinary
// case and an absolute path only from a linked worktree. Returns null when git
// is missing or cwd sits outside a repository; callers fall back rather than
// fail, since a cache path must always resolve.
export const gitCommonDir = (cwd?: string): string | null => {
  try {
    const raw = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return raw === '' ? null : resolve(cwd ?? '.', raw);
  } catch {
    return null;
  }
};
