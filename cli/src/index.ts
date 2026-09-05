import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import packageJson from '../package.json' with { type: 'json' };
import type { UserError } from './dieWithError';
import { main } from './main';
import { CommitServiceLive } from './services/commitLive';
import { GitServiceLive } from './services/gitLive';
import { HerdrServiceLive } from './services/herdrLive';
import { HookServiceLive } from './services/hookLive';
import { PrServiceLive } from './services/prLive';
import { ValidateServiceLive } from './services/validateLive';

const AppLayer = Layer.mergeAll(
  CommitServiceLive,
  GitServiceLive,
  HerdrServiceLive,
  HookServiceLive,
  PrServiceLive,
  ValidateServiceLive,
);

main.pipe(
  Command.run({ version: packageJson.version }),
  Effect.provide(NodeServices.layer),
  Effect.provide(AppLayer),
  Effect.catchTag('UserError', (_e: UserError) => Effect.sync(() => process.exit(1))),
  NodeRuntime.runMain,
);
