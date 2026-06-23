import { Command } from 'effect/unstable/cli';

import { check } from './commands/check';
import { commit } from './commands/commit';
import { conform } from './commands/conform';
import { git } from './commands/git';
import { hook } from './commands/hook';
import { pr } from './commands/pr';
import { state } from './commands/state';
import { tracker } from './commands/tracker';
import { validate } from './commands/validate';
import { workspace } from './commands/workspace';
import { worktree } from './commands/worktree';

export const main = Command.make('cape').pipe(
  Command.withDescription('Cape CLI — opinionated Claude Code workflow tools.'),
  Command.withSubcommands([
    check,
    commit,
    conform,
    git,
    hook,
    pr,
    state,
    tracker,
    validate,
    workspace,
    worktree,
  ]),
);
