import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { main } from './main';
import { BrValidateServiceLive } from './services/brValidateLive';
import { CheckServiceLive } from './services/checkLive';
import { ConformServiceLive } from './services/conformLive';
import { CommitServiceLive } from './services/commitLive';
import { DetectServiceLive } from './services/detectLive';
import { GitServiceLive } from './services/gitLive';
import { HookServiceLive } from './services/hookLive';
import { PrServiceLive } from './services/prLive';
import { ValidateServiceLive } from './services/validateLive';

main.pipe(
  Command.run({ version: '0.1.0' }),
  Effect.provide(NodeServices.layer),
  Effect.provide(BrValidateServiceLive),
  Effect.provide(CheckServiceLive),
  Effect.provide(ConformServiceLive),
  Effect.provide(CommitServiceLive),
  Effect.provide(DetectServiceLive),
  Effect.provide(GitServiceLive),
  Effect.provide(HookServiceLive),
  Effect.provide(PrServiceLive),
  Effect.provide(ValidateServiceLive),
  NodeRuntime.runMain,
);
