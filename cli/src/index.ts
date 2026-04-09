import { NodeRuntime, NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';

import type { UserError } from './dieWithError';
import { logEvent } from './eventLog';
import { main } from './main';
import { BrValidateServiceLive } from './services/brValidateLive';
import { CheckServiceLive } from './services/checkLive';
import { ConformServiceLive } from './services/conformLive';
import { CommitServiceLive } from './services/commitLive';
import { DetectServiceLive } from './services/detectLive';
import { GitServiceLive } from './services/gitLive';
import { HookServiceLive } from './services/hookLive';
import { PrServiceLive } from './services/prLive';
import { TestServiceLive } from './services/testLive';
import { ValidateServiceLive } from './services/validateLive';

const AppLayer = Layer.mergeAll(
  BrValidateServiceLive,
  CheckServiceLive,
  ConformServiceLive,
  CommitServiceLive,
  DetectServiceLive,
  GitServiceLive,
  HookServiceLive,
  PrServiceLive,
  TestServiceLive,
  ValidateServiceLive,
);

const skipCommands = new Set(['hook', 'stats']);
const args = process.argv.slice(2);
const cmdSegments = args.filter((a) => !a.startsWith('-'));
const cmd = cmdSegments.join('.');

if (cmd && cmdSegments[0] != null && !skipCommands.has(cmdSegments[0])) {
  logEvent(cmd);
}

main.pipe(
  Command.run({ version: '1.6.2' }),
  Effect.provide(NodeServices.layer),
  Effect.provide(AppLayer),
  Effect.catchTag('UserError', (_e: UserError) => Effect.sync(() => process.exit(1))),
  NodeRuntime.runMain,
);
