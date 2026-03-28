import { Effect, ServiceMap } from 'effect';

export interface GitContext {
  readonly mainBranch: string;
  readonly currentBranch: string;
  readonly status: string[];
  readonly diffStat: string;
  readonly recentLog: string[];
}

export class GitService extends ServiceMap.Service<
  GitService,
  {
    readonly getContext: () => Effect.Effect<GitContext, Error>;
  }
>()('GitService') {}

export const getGitContext = Effect.gen(function* () {
  const git = yield* GitService;

  return yield* git.getContext();
});
