import { Command } from 'effect/unstable/cli';

import { gitContext } from './gitContext';
import { gitDiff } from './gitDiff';
import { gitValidateBranch } from './gitValidateBranch';

export const git = Command.make('git').pipe(
  Command.withSubcommands([gitContext, gitDiff, gitValidateBranch]),
);
