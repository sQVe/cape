import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

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
      const error = result.errors.join(', ');
      yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }
  }),
).pipe(
  Command.withDescription(
    'Validate a branch name against naming conventions. Returns { valid, errors }. Use before creating a new branch.',
  ),
);
