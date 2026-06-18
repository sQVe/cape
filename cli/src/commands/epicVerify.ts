import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { getCheckResults } from '../services/check';
import { isDoneTask, readTrackerCache } from '../services/hook';

export const epicVerify = Command.make(
  'verify',
  {
    id: Argument.string('id').pipe(Argument.withDescription('Epic issue ID to verify')),
  },
  Effect.fn(function* ({ id }) {
    const cache = yield* readTrackerCache();
    const epic = cache?.epics[id];
    if (epic == null) {
      return yield* dieWithError(`epic ${id} is not present in the tracker cache`);
    }

    const openItems = epic.tasks
      .filter((task) => !isDoneTask(task))
      .map((task) => ({ id: task.id, title: task.title, status: task.status }));
    const checkResults = yield* getCheckResults([]);
    const checksPassed = checkResults.every((result) => result.passed);
    const ready = openItems.length === 0 && checksPassed;

    const result = { verified: ready, openTasks: openItems, checksPassed, checkResults };
    yield* Console.log(JSON.stringify(result, null, 2));

    if (!ready) {
      yield* dieWithError(`epic verification failed for ${id}: ${openItems.length} open task(s), checks ${checksPassed ? 'passed' : 'failed'}`);
    }
  }),
).pipe(
  Command.withDescription(
    'Check if an epic can be closed: all child tasks done and project checks pass. Returns { verified, openTasks, checksPassed }. Use before closing an epic.',
  ),
);
