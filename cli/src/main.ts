import { Command } from 'effect/unstable/cli';

import { br } from './commands/br';
import { check } from './commands/check';
import { conform } from './commands/conform';
import { commit } from './commands/commit';
import { state } from './commands/state';
import { detect } from './commands/detect';
import { epic } from './commands/epic';
import { git } from './commands/git';
import { hook } from './commands/hook';
import { pr } from './commands/pr';
import { stats } from './commands/stats';
import { test } from './commands/test';
import { validate } from './commands/validate';

export const main = Command.make('cape').pipe(
  Command.withDescription('Cape CLI — opinionated Claude Code workflow tools.'),
  Command.withSubcommands([br, check, commit, conform, detect, epic, git, hook, pr, state, stats, test, validate]),
);
