import { Console, Effect } from 'effect';

export class UserError {
  readonly _tag = 'UserError';
  constructor(readonly message: string) {}
}

export const dieWithError = (error: string) =>
  Console.error(JSON.stringify({ error })).pipe(
    Effect.andThen(Effect.fail(new UserError(error))),
  );
