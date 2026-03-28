import { Effect, Layer } from 'effect';

import { BrValidateService } from './services/brValidate';
import { CheckService } from './services/check';
import { CommitService } from './services/commit';
import { DetectService } from './services/detect';
import { GitService } from './services/git';

export const stubGitLayer = Layer.succeed(GitService)({
  getContext: () =>
    Effect.succeed({
      mainBranch: 'main',
      currentBranch: 'main',
      status: [],
      diffStat: '',
      recentLog: [],
    }),
});

export const stubDetectLayer = Layer.succeed(DetectService)({
  detect: () => Effect.succeed([]),
  mapDirectory: () => Effect.succeed({}),
});

export const stubCheckLayer = Layer.succeed(CheckService)({
  runChecks: () => Effect.succeed([]),
});

export const stubCommitLayer = Layer.succeed(CommitService)({
  stageAndCommit: () => Effect.succeed(undefined),
});

export const stubBrLayer = Layer.succeed(BrValidateService)({
  show: () => Effect.succeed({ id: '', issue_type: 'task', description: '', design: null }),
  updateDesign: () => Effect.succeed(undefined),
  readStdin: () => Effect.succeed(''),
});
