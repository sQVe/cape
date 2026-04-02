import { Command } from 'effect/unstable/cli';

import { gitContext } from './gitContext';
import { gitCreateBranch } from './gitCreateBranch';
import { gitDiff } from './gitDiff';
import { gitValidateBranch } from './gitValidateBranch';

export const git = Command.make('git').pipe(
  Command.withDescription('Git utilities for context, diffs, and branch management.'),
  Command.withSubcommands([gitContext, gitCreateBranch, gitDiff, gitValidateBranch]),
);
