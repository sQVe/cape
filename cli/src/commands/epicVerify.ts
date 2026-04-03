import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { runCloseReadinessCheck } from './br';

export const epicVerify = Command.make(
  'verify',
  {
    id: Argument.string('id').pipe(Argument.withDescription('Epic bead ID to verify')),
  },
  Effect.fn(function* ({ id }) {
    const { ready, openItems, checksPassed, checkResults } = yield* runCloseReadinessCheck(id);

    const result = { verified: ready, openTasks: openItems, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!ready) {
      const error = `epic verification failed for ${id}: ${openItems.length} open task(s), checks ${checksPassed ? 'passed' : 'failed'}`;
      yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }
  }),
).pipe(
  Command.withDescription(
    'Check if an epic can be closed: all child tasks done and project checks pass. Returns { verified, openTasks, checksPassed }. Use before closing an epic.',
  ),
);
