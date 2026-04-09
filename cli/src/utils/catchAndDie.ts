import { Console, Effect } from 'effect';

export const catchAndDie = <A, E extends Error, R>(
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, never, R> =>
  effect.pipe(
    Effect.catch((error: E) =>
      Console.error(JSON.stringify({ error: error.message })).pipe(
        Effect.andThen(Effect.die(error)),
      ),
    ),
  );
