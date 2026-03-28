import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { getCheckResults } from '../services/check';
import { getDetectResult } from '../services/detect';

export const check = Command.make(
  'check',
  {},
  Effect.fn(function* () {
    const ecosystems = yield* getDetectResult.pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const results = yield* getCheckResults(ecosystems).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    yield* Console.log(JSON.stringify(results, null, 2));

    if (results.some((r) => !r.passed)) {
      yield* Effect.die(new Error('checks failed'));
    }
  }),
);
