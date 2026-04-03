import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { getGitContext } from '../services/git';

export const gitContext = Command.make(
  'context',
  {},
  Effect.fn(function* () {
    const context = yield* getGitContext.pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    yield* Console.log(JSON.stringify(context, null, 2));
  }),
).pipe(
  Command.withDescription(
    'Output current git state as JSON: { mainBranch, currentBranch, status, diffStat, recentLog }. Use to understand repo state before commits or PRs.',
  ),
);
