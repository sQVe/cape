import { execSync } from 'node:child_process';

import { Effect, Layer } from 'effect';

import type { DiffScope } from './git';
import { GitService } from './git';

const git = (args: string) => execSync(`git ${args}`, { encoding: 'utf-8' }).trim();
const gitRaw = (args: string) => execSync(`git ${args}`, { encoding: 'utf-8' });

const tryGit = (args: string) => {
  try {
    return git(args);
  } catch {
    return null;
  }
};

const detectMainBranch = () => {
  const ref = tryGit('symbolic-ref refs/remotes/origin/HEAD');
  if (ref != null) {
    return ref.replace('refs/remotes/origin/', '');
  }

  for (const candidate of ['main', 'master']) {
    if (tryGit(`rev-parse --verify ${candidate}`) != null) {
      return candidate;
    }
  }

  return 'main';
};

const getContext = () =>
  Effect.try({
    try: () => {
      git('rev-parse --git-dir');

      return {
        mainBranch: detectMainBranch(),
        currentBranch: git('branch --show-current'),
        status: git('status --porcelain').split('\n').filter(Boolean),
        diffStat: git('diff --stat'),
        recentLog: git('log --oneline -n 10').split('\n').filter(Boolean),
      };
    },
    catch: (error) => new Error('not a git repository', { cause: error }),
  });

const resolveDiffArgs = (scope: DiffScope, mainBranch: string): string => {
  switch (scope) {
    case 'unstaged':
      return 'diff';
    case 'staged':
      return 'diff --cached';
    case 'branch':
      return `diff ${mainBranch}...HEAD`;
    case 'pr':
      return `diff ${mainBranch}...HEAD`;
  }
};

const getDiff = (scope: DiffScope) =>
  Effect.try({
    try: () => {
      git('rev-parse --git-dir');

      const mainBranch = detectMainBranch();
      const branchDiff = gitRaw(resolveDiffArgs(scope, mainBranch));

      if (scope === 'pr') {
        const uncommitted = gitRaw('diff');
        return branchDiff + uncommitted;
      }

      return branchDiff;
    },
    catch: (error) => new Error('not a git repository', { cause: error }),
  });

export const GitServiceLive = Layer.succeed(GitService)({ getContext, getDiff });
