import { Console, Effect } from 'effect';

export const dieWithError = (error: string) =>
  Console.error(JSON.stringify({ error })).pipe(
    Effect.andThen(Effect.die(new Error(error))),
  );
