import { Command } from 'effect/unstable/cli';

import { git } from './commands/git';

export const main = Command.make('cape').pipe(Command.withSubcommands([git]));
