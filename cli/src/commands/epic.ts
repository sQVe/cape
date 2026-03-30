import { Command } from 'effect/unstable/cli';

import { epicVerify } from './epicVerify';

export const epic = Command.make('epic').pipe(
  Command.withDescription('Epic lifecycle commands. Use for verifying epic completion readiness.'),
  Command.withSubcommands([epicVerify]),
);
