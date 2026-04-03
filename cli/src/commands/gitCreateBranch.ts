import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { getCreateBranch, getValidateBranch } from '../services/git';

export const gitCreateBranch = Command.make(
  'create-branch',
  {
    name: Argument.string('name').pipe(Argument.withDescription('Branch name to validate and create')),
  },
  Effect.fn(function* ({ name }) {
    const validation = yield* getValidateBranch(name).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    if (!validation.valid) {
      yield* Console.error(JSON.stringify({ error: validation.errors.join(', ') }));
      return yield* Effect.fail(new Error(validation.errors.join(', ')));
    }

    const result = yield* getCreateBranch(name).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    yield* Console.log(JSON.stringify(result));
  }),
).pipe(
  Command.withDescription(
    'Validate a branch name and create it via git checkout -b. Returns { created, branch }. Use to create branches with naming enforcement.',
  ),
);
