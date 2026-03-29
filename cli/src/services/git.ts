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

export class GitService extends ServiceMap.Service<
  GitService,
  {
    readonly getContext: () => Effect.Effect<GitContext, Error>;
    readonly getDiff: (scope: DiffScope) => Effect.Effect<string, Error>;
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
