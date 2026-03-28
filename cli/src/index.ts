import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { main } from './main';
import { BrValidateServiceLive } from './services/brValidateLive';
import { CheckServiceLive } from './services/checkLive';
import { CommitServiceLive } from './services/commitLive';
import { DetectServiceLive } from './services/detectLive';
import { GitServiceLive } from './services/gitLive';

main.pipe(
  Command.run({ version: '0.1.0' }),
  Effect.provide(NodeServices.layer),
  Effect.provide(BrValidateServiceLive),
  Effect.provide(CheckServiceLive),
  Effect.provide(CommitServiceLive),
  Effect.provide(DetectServiceLive),
  Effect.provide(GitServiceLive),
  NodeRuntime.runMain,
);
