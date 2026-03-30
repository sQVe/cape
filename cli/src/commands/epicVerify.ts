import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { runCloseReadinessCheck } from './br';

export const epicVerify = Command.make(
  'verify',
  {
    id: Argument.string('id'),
  },
  Effect.fn(function* ({ id }) {
    const { ready, openItems, checksPassed, checkResults } = yield* runCloseReadinessCheck(id);

    const result = { verified: ready, openTasks: openItems, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!ready) {
      yield* Effect.fail(new Error('epic verification failed'));
    }
  }),
).pipe(
  Command.withDescription(
    'Check if an epic can be closed: all child tasks done and project checks pass. Use before closing an epic.',
  ),
);
