import { Command } from 'effect/unstable/cli';

import { br } from './commands/br';
import { check } from './commands/check';
import { commit } from './commands/commit';
import { detect } from './commands/detect';
import { git } from './commands/git';

export const main = Command.make('cape').pipe(
  Command.withSubcommands([br, check, commit, detect, git]),
);
