import { Effect, ServiceMap } from 'effect';

export interface GitContext {
  readonly mainBranch: string;
  readonly currentBranch: string;
  readonly status: string[];
  readonly diffStat: string;
  readonly recentLog: string[];
}

export type DiffScope = 'unstaged' | 'staged' | 'branch' | 'pr';

export const DIFF_SCOPES: readonly DiffScope[] = ['unstaged', 'staged', 'branch', 'pr'];

export interface BranchValidation {
  readonly valid: boolean;
  readonly errors: string[];
}

export const BRANCH_PREFIXES = [
  'feat/',
  'fix/',
  'chore/',
  'refactor/',
  'docs/',
  'test/',
] as const;

export class GitService extends ServiceMap.Service<
  GitService,
  {
    readonly getContext: () => Effect.Effect<GitContext, Error>;
    readonly getDiff: (scope: DiffScope) => Effect.Effect<string, Error>;
    readonly validateBranch: (name: string) => Effect.Effect<BranchValidation, Error>;
  }
>()('GitService') {}

export const getGitContext = Effect.gen(function* () {
  const git = yield* GitService;

  return yield* git.getContext();
});

export const getGitDiff = (scope: DiffScope) =>
  Effect.gen(function* () {
    const git = yield* GitService;

    return yield* git.getDiff(scope);
  });

export const getValidateBranch = (name: string) =>
  Effect.gen(function* () {
    const git = yield* GitService;

    return yield* git.validateBranch(name);
  });
