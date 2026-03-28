import { Command } from 'effect/unstable/cli';

import { detect } from './commands/detect';
import { git } from './commands/git';

export const main = Command.make('cape').pipe(Command.withSubcommands([detect, git]));
