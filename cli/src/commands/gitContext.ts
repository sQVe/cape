import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { getGitContext } from '../services/git';
import { catchAndDie } from '../utils/catchAndDie';

export const gitContext = Command.make(
  'context',
  {},
  Effect.fn(function* () {
    const context = yield* getGitContext.pipe(catchAndDie);

    yield* Console.log(JSON.stringify(context, null, 2));
  }),
).pipe(
  Command.withDescription(
    'Output current git state as JSON: { mainBranch, currentBranch, status, diffStat, recentLog }. Use to understand repo state before commits or PRs.',
  ),
);
