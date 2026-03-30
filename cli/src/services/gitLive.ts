import { execFileSync } from 'node:child_process';

import { Effect, Layer } from 'effect';

import type { BranchValidation, DiffScope } from './git';
import { BRANCH_PREFIXES, GitService } from './git';

const git = (args: readonly string[]) =>
  execFileSync('git', args, { encoding: 'utf-8' }).trim();
const gitRaw = (args: readonly string[]) =>
  execFileSync('git', args, { encoding: 'utf-8' });

const tryGit = (args: readonly string[]) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

const detectMainBranch = () => {
  const ref = tryGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
  if (ref != null) {
    return ref.replace('refs/remotes/origin/', '');
  }

  for (const candidate of ['main', 'master']) {
    if (tryGit(['rev-parse', '--verify', candidate]) != null) {
      return candidate;
    }
  }

  return 'main';
};

const getContext = () =>
  Effect.try({
    try: () => {
      git(['rev-parse', '--git-dir']);

      return {
        mainBranch: detectMainBranch(),
        currentBranch: git(['branch', '--show-current']),
        status: git(['status', '--porcelain']).split('\n').filter(Boolean),
        diffStat: git(['diff', '--stat']),
        recentLog: git(['log', '--oneline', '-n', '10']).split('\n').filter(Boolean),
      };
    },
    catch: (error) => new Error('not a git repository', { cause: error }),
  });

const resolveDiffArgs = (scope: DiffScope, mainBranch: string): readonly string[] => {
  switch (scope) {
    case 'unstaged':
      return ['diff'];
    case 'staged':
      return ['diff', '--cached'];
    case 'branch':
      return ['diff', `${mainBranch}...HEAD`];
    case 'pr':
      return ['diff', `${mainBranch}...HEAD`];
  }
};

const getDiff = (scope: DiffScope) =>
  Effect.try({
    try: () => {
      git(['rev-parse', '--git-dir']);

      const mainBranch = detectMainBranch();
      const branchDiff = gitRaw(resolveDiffArgs(scope, mainBranch));

      if (scope === 'pr') {
        const uncommitted = gitRaw(['diff']);
        return branchDiff + uncommitted;
      }

      return branchDiff;
    },
    catch: (error) => new Error('not a git repository', { cause: error }),
  });

const validateBranch = (name: string) =>
  Effect.try({
    try: (): BranchValidation => {
      git(['rev-parse', '--git-dir']);

      const errors: string[] = [];

      const refCheck = tryGit(['check-ref-format', '--branch', name]);
      if (refCheck == null) {
        errors.push(`invalid ref format: ${name}`);
      }

      const localExists = tryGit(['rev-parse', '--verify', `refs/heads/${name}`]);
      if (localExists != null) {
        errors.push(`branch already exists locally: ${name}`);
      }

      const remoteExists = tryGit(['rev-parse', '--verify', `refs/remotes/origin/${name}`]);
      if (remoteExists != null) {
        errors.push(`branch already exists on remote: ${name}`);
      }

      const hasPrefix = BRANCH_PREFIXES.some((prefix) => name.startsWith(prefix));
      if (!hasPrefix) {
        errors.push(
          `missing conventional prefix (${BRANCH_PREFIXES.map((p) => p.replace('/', '')).join(', ')})`,
        );
      }

      return { valid: errors.length === 0, errors };
    },
    catch: (error) => new Error('not a git repository', { cause: error }),
  });

export const GitServiceLive = Layer.succeed(GitService)({ getContext, getDiff, validateBranch });
