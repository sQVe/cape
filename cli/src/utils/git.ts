import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import { resolve } from 'node:path';

export const gitRoot = (): string =>
  execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();

export type GitCommonDir =
  | { readonly kind: 'ok'; readonly commonDir: string }
  | { readonly kind: 'no-repo' }
  | { readonly kind: 'unavailable' };

// Only git saying "not a repository" means not a repository. It exits 128 for
// plenty of other reasons — a bad config line, a dubious-ownership refusal —
// and those are real repositories whose cache must never land in the shared
// fallback file. Anything we cannot positively identify fails closed.
export const gitFailureKind = (error: unknown): 'no-repo' | 'unavailable' => {
  const { status, stderr } = error as { status?: unknown; stderr?: unknown };
  if (typeof status !== 'number' || status === 0) {
    return 'unavailable';
  }
  const text = typeof stderr === 'string' ? stderr : String(stderr ?? '');
  return /not a git repository/i.test(text) ? 'no-repo' : 'unavailable';
};

const readCommonDir = (cwd?: string): GitCommonDir => {
  let raw: string;
  try {
    raw = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd,
      encoding: 'utf-8',
      // gitFailureKind reads git's message to tell "not a repository" from a
      // failure we must not act on, and git translates that message. LC_ALL=C
      // pins it to English; glibc ignores LANGUAGE under the C locale.
      env: { ...process.env, LC_ALL: 'C' }, // eslint-disable-line node/no-process-env
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 3000,
    }).trim();
  } catch (error) {
    return { kind: gitFailureKind(error) };
  }

  if (raw === '') {
    return { kind: 'unavailable' };
  }

  const resolved = resolve(cwd ?? '.', raw);
  try {
    return { kind: 'ok', commonDir: realpathSync(resolved) };
  } catch {
    return { kind: 'ok', commonDir: resolved };
  }
};

// Memoized per cwd for the life of the process. A command that resolves the
// cache path to read and again to write must get the same answer both times:
// a timeout on only one of the two would otherwise let a write built from an
// "empty" cache overwrite the real file. Every cape process is short-lived and
// single-cwd, so a stale entry is not a concern.
const cache = new Map<string, GitCommonDir>();

// Resolved against cwd because git prints a relative `.git` for the ordinary
// case and an absolute path only from a linked worktree, then realpath'd so a
// symlinked and a physical route to one repository agree on a single cache.
export const gitCommonDir = (cwd?: string): GitCommonDir => {
  const key = cwd ?? '';
  const memoized = cache.get(key);
  if (memoized != null) {
    return memoized;
  }
  const result = readCommonDir(cwd);
  cache.set(key, result);
  return result;
};
