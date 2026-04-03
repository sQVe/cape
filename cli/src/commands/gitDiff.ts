import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { DIFF_SCOPES, getGitDiff } from '../services/git';
import type { DiffScope } from '../services/git';

const isDiffScope = (value: string): value is DiffScope =>
  (DIFF_SCOPES as readonly string[]).includes(value);

export const gitDiff = Command.make(
  'diff',
  {
    scope: Argument.string('scope').pipe(Argument.withDescription('Diff scope: unstaged | staged | branch (default: unstaged)'), Argument.optional),
  },
  Effect.fn(function* ({ scope }) {
    const raw = scope._tag === 'Some' ? scope.value : 'unstaged';

    if (!isDiffScope(raw)) {
      const error = `invalid scope: ${raw}. valid: ${DIFF_SCOPES.join(', ')}`;
      return yield* Console.error(JSON.stringify({ error })).pipe(
        Effect.andThen(Effect.die(new Error(error))),
      );
    }

    const resolved = raw;

    const diff = yield* getGitDiff(resolved).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    yield* Console.log(diff);
  }),
).pipe(
  Command.withDescription(
    'Output git diff for a given scope (unstaged, staged, branch). Use to inspect changes before committing or reviewing.',
  ),
);
