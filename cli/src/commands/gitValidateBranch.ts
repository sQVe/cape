import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { getValidateBranch } from '../services/git';

export const gitValidateBranch = Command.make(
  'validate-branch',
  {
    name: Argument.string('name').pipe(Argument.withDescription('Branch name to validate')),
  },
  Effect.fn(function* ({ name }) {
    const result = yield* getValidateBranch(name).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

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
