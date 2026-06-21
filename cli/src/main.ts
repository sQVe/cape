import { Command } from 'effect/unstable/cli';

import { check } from './commands/check';
import { conform } from './commands/conform';
import { commit } from './commands/commit';
import { state } from './commands/state';
import { git } from './commands/git';
import { hook } from './commands/hook';
import { pr } from './commands/pr';
import { tracker } from './commands/tracker';
import { validate } from './commands/validate';
import { worktree } from './commands/worktree';

export const main = Command.make('cape').pipe(
  Command.withDescription('Cape CLI — opinionated Claude Code workflow tools.'),
  Command.withSubcommands([check, commit, conform, git, hook, pr, state, tracker, validate, worktree]),
);
