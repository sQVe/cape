import { Command } from 'effect/unstable/cli';

import { check } from './commands/check';
import { commit } from './commands/commit';
import { git } from './commands/git';
import { hook } from './commands/hook';
import { pr } from './commands/pr';
import { tracker } from './commands/tracker';
import { validate } from './commands/validate';
import { workspace } from './commands/workspace';

export const main = Command.make('cape').pipe(
  Command.withDescription('Cape CLI: opinionated Claude Code workflow tools.'),
  Command.withSubcommands([check, commit, git, hook, pr, tracker, validate, workspace]),
);
