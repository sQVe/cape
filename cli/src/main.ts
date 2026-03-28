import { Command } from 'effect/unstable/cli';

import { check } from './commands/check';
import { commit } from './commands/commit';
import { detect } from './commands/detect';
import { git } from './commands/git';

export const main = Command.make('cape').pipe(
  Command.withSubcommands([check, commit, detect, git]),
);
