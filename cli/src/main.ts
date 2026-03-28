import { Command } from 'effect/unstable/cli';

import { check } from './commands/check';
import { detect } from './commands/detect';
import { git } from './commands/git';

export const main = Command.make('cape').pipe(Command.withSubcommands([check, detect, git]));
