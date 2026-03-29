import { Command } from 'effect/unstable/cli';

import { epicVerify } from './epicVerify';

export const epic = Command.make('epic').pipe(Command.withSubcommands([epicVerify]));
