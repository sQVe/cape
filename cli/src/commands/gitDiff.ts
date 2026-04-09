import { Console, Effect, Option } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { DIFF_SCOPES, getGitDiff } from '../services/git';
import type { DiffScope } from '../services/git';
import { catchAndDie } from '../utils/catchAndDie';

const isDiffScope = (value: string): value is DiffScope =>
  (DIFF_SCOPES as readonly string[]).includes(value);

export const gitDiff = Command.make(
  'diff',
  {
    scope: Argument.string('scope').pipe(Argument.withDescription('Diff scope: unstaged | staged | branch (default: unstaged)'), Argument.optional),
  },
  Effect.fn(function* ({ scope }) {
    const raw = Option.isSome(scope) ? scope.value : 'unstaged';

    if (!isDiffScope(raw)) {
      return yield* dieWithError(`invalid scope: ${raw}. valid: ${DIFF_SCOPES.join(', ')}`);
    }

    const resolved = raw;

    const diff = yield* getGitDiff(resolved).pipe(catchAndDie);

    yield* Console.log(diff);
  }),
).pipe(
  Command.withDescription(
    'Output git diff for a given scope (unstaged, staged, branch). Use to inspect changes before committing or reviewing.',
  ),
);
