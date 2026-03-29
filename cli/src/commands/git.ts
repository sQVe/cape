import { Command } from 'effect/unstable/cli';

import { gitContext } from './gitContext';
import { gitDiff } from './gitDiff';

export const git = Command.make('git').pipe(Command.withSubcommands([gitContext, gitDiff]));
