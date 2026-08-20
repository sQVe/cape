import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import type { UserError } from './dieWithError';
import { main } from './main';
import { CheckServiceLive } from './services/checkLive';
import { CommitServiceLive } from './services/commitLive';
import { DetectServiceLive } from './services/detectLive';
import { GitServiceLive } from './services/gitLive';
import { HerdrServiceLive } from './services/herdrLive';
import { HookServiceLive } from './services/hookLive';
import { PrServiceLive } from './services/prLive';
import { ValidateServiceLive } from './services/validateLive';

const AppLayer = Layer.mergeAll(
  CheckServiceLive,
  CommitServiceLive,
  DetectServiceLive,
  GitServiceLive,
  HerdrServiceLive,
  HookServiceLive,
  PrServiceLive,
  ValidateServiceLive,
);

main.pipe(
  Command.run({ version: '1.6.2' }),
  Effect.provide(NodeServices.layer),
  Effect.provide(AppLayer),
  Effect.catchTag('UserError', (_e: UserError) => Effect.sync(() => process.exit(1))),
  NodeRuntime.runMain,
);
