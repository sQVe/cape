import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { GitService } from '../services/git';
import { catchAndDie } from '../utils/catchAndDie';

export const gitContext = Command.make(
  'context',
  {},
  Effect.fn(function* () {
    const git = yield* GitService;
    const context = yield* git.getContext().pipe(catchAndDie);

    yield* Console.log(JSON.stringify(context));
  }),
).pipe(
  Command.withDescription(
    'Output current git state as JSON: { mainBranch, currentBranch, status, diffStat, recentLog }. Use to understand repo state before commits or PRs.',
  ),
);
