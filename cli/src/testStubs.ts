import { Effect, Layer } from 'effect';

import { CheckService } from './services/check';
import { CommitService } from './services/commit';
import { ConformService } from './services/conform';
import { DetectService } from './services/detect';
import { GitService } from './services/git';
import { HerdrService } from './services/herdr';
import { HookService } from './services/hook';
import { PrService } from './services/pr';
import { ValidateService } from './services/validate';

export const stubGitLayer = Layer.succeed(GitService)({
  getContext: () =>
    Effect.succeed({
      mainBranch: 'main',
      currentBranch: 'main',
      status: [],
      diffStat: '',
      recentLog: [],
    }),
  getDiff: () => Effect.succeed(''),
  validateBranch: () => Effect.succeed({ valid: true, errors: [] }),
  createBranch: () => Effect.succeed({ created: true, branch: 'feat/test' }),
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
  commitNoEdit: () => Effect.succeed(undefined),
});

export const stubHookLayer = Layer.succeed(HookService)({
  pluginRoot: () => '/test',
  readFile: () => Effect.succeed(null),
  writeFile: () => Effect.succeed(undefined),
  removeFile: () => Effect.succeed(undefined),
  ensureDir: () => Effect.succeed(undefined),
  readStdin: () => Effect.succeed(''),
  spawnGit: () => Effect.succeed(null),
  fileExists: () => Effect.succeed(false),
});

export const stubPrLayer = Layer.succeed(PrService)({
  fileExists: () => Effect.succeed(false),
  readFile: () => Effect.fail(new Error('no file')),
  readStdin: () => Effect.succeed(''),
  gitRoot: () => Effect.succeed('/repo'),
  spawnGh: () => Effect.fail(new Error('no gh')),
});

export const stubValidateLayer = Layer.succeed(ValidateService)({
  globFiles: () => Effect.succeed([]),
  readFile: () => Effect.succeed(''),
  gitRoot: () => Effect.succeed('/repo'),
});

export const stubConformLayer = Layer.succeed(ConformService)({
  discoverRules: () => Effect.succeed([]),
  readFiles: () => Effect.succeed([]),
});

export const stubHerdrLayer = Layer.succeed(HerdrService)({
  workspaceId: () => null,
  tabId: () => null,
  rename: () => Effect.succeed(true),
});
