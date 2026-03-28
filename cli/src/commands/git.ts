import { Command } from 'effect/unstable/cli';

import { gitContext } from './gitContext';

export const git = Command.make('git').pipe(Command.withSubcommands([gitContext]));
