import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { listChildren } from '../services/brValidate';
import { getCheckResults } from '../services/check';
import { getDetectResult } from '../services/detect';

export const epicVerify = Command.make(
  'verify',
  {
    id: Argument.string('id'),
  },
  Effect.fn(function* ({ id }) {
    const children = yield* listChildren(id).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const openTasks = children.filter((child) => child.status !== 'closed');

    const ecosystems = yield* getDetectResult.pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const checkResults = yield* getCheckResults(ecosystems).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const checksPassed = checkResults.every((r) => r.passed);
    const verified = openTasks.length === 0 && checksPassed;

    const result = { verified, openTasks, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!verified) {
      yield* Effect.fail(new Error('epic verification failed'));
    }
  }),
).pipe(Command.withDescription('Check if an epic can be closed: all child tasks done and project checks pass. Use before closing an epic.'));
