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

export interface BranchCreation {
  readonly created: boolean;
  readonly branch: string;
}

export const BRANCH_PREFIXES = ['feat/', 'fix/', 'chore/', 'refactor/', 'docs/', 'test/'] as const;

export class GitService extends ServiceMap.Service<
  GitService,
  {
    readonly getContext: () => Effect.Effect<GitContext, Error>;
    readonly getDiff: (scope: DiffScope) => Effect.Effect<string, Error>;
    readonly validateBranch: (name: string) => Effect.Effect<BranchValidation, Error>;
    readonly createBranch: (name: string) => Effect.Effect<BranchCreation, Error>;
    readonly repoName: () => Effect.Effect<string | null>;
  }
>()('GitService') {}
