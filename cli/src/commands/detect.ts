import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { getDetectResult } from '../services/detect';

export const detect = Command.make(
  'detect',
  {},
  Effect.fn(function* () {
    const results = yield* getDetectResult.pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    yield* Console.log(JSON.stringify(results, null, 2));
  }),
);
