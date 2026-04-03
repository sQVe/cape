import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import type { ConformInput } from '../services/conform';
import { ConformService, extractChangedPaths } from '../services/conform';
import { DIFF_SCOPES, GitService } from '../services/git';
import type { DiffScope } from '../services/git';

const isDiffScope = (value: string): value is DiffScope =>
  (DIFF_SCOPES as readonly string[]).includes(value);

export const conform = Command.make(
  'conform',
  { scope: Argument.optional(Argument.string('scope').pipe(Argument.withDescription('Diff scope: unstaged | staged | branch (default: branch)'))) },
  Effect.fn(function* ({ scope }) {
    const resolvedScope: DiffScope =
      scope._tag === 'Some' && isDiffScope(scope.value) ? scope.value : 'branch';

    const git = yield* GitService;
    const diff = yield* git.getDiff(resolvedScope).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const changedPaths = extractChangedPaths(diff);

    const conformService = yield* ConformService;
    const rules = yield* conformService.discoverRules().pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const changedFiles = yield* conformService.readFiles(changedPaths).pipe(
      Effect.catch((error: Error) =>
        Console.error(JSON.stringify({ error: error.message })).pipe(
          Effect.andThen(Effect.die(error)),
        ),
      ),
    );

    const output: ConformInput = { rules, changedFiles, scope: resolvedScope };
    yield* Console.log(JSON.stringify(output, null, 2));
  }),
).pipe(
  Command.withDescription(
    'Discover convention rules and changed files for conformance checking. Returns JSON with rules and changed files. Use as input for the conform skill.',
  ),
);
