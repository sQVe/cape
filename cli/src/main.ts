import { Command } from 'effect/unstable/cli';

import { br } from './commands/br';
import { check } from './commands/check';
import { commit } from './commands/commit';
import { detect } from './commands/detect';
import { epic } from './commands/epic';
import { git } from './commands/git';
import { hook } from './commands/hook';
import { pr } from './commands/pr';
import { validate } from './commands/validate';

export const main = Command.make('cape').pipe(
  Command.withSubcommands([br, check, commit, detect, epic, git, hook, pr, validate]),
);
