import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { getValidateBranch } from '../services/git';
import { catchAndDie } from '../utils/catchAndDie';

export const gitValidateBranch = Command.make(
  'validate-branch',
  {
    name: Argument.string('name').pipe(Argument.withDescription('Branch name to validate')),
  },
  Effect.fn(function* ({ name }) {
    const result = yield* getValidateBranch(name).pipe(catchAndDie);

    yield* Console.log(JSON.stringify(result));

    if (!result.valid) {
      yield* dieWithError(result.errors.join(', '));
    }
  }),
).pipe(
  Command.withDescription(
    'Validate a branch name against naming conventions. Returns { valid, errors }. Use before creating a new branch.',
  ),
);
