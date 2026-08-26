import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { GitService } from '../services/git';
import { catchAndDie } from '../utils/catchAndDie';

export const gitCreateBranch = Command.make(
  'create-branch',
  {
    name: Argument.string('name').pipe(
      Argument.withDescription('Branch name to validate and create'),
    ),
  },
  Effect.fn(function* ({ name }) {
    const git = yield* GitService;
    const validation = yield* git.validateBranch(name).pipe(catchAndDie);

    if (!validation.valid) {
      return yield* dieWithError(validation.errors.join(', '));
    }

    const result = yield* git.createBranch(name).pipe(catchAndDie);

    yield* Console.log(JSON.stringify(result));
  }),
).pipe(
  Command.withDescription(
    'Validate a branch name and create it via git checkout -b. Returns { created, branch }. Use to create branches with naming enforcement.',
  ),
);
