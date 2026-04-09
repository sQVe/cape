import { Console, Effect } from 'effect';
import { Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { getCheckResults } from '../services/check';
import { getDetectResult } from '../services/detect';
import { catchAndDie } from '../utils/catchAndDie';

export const check = Command.make(
  'check',
  {},
  Effect.fn(function* () {
    const ecosystems = yield* getDetectResult.pipe(catchAndDie);

    const results = yield* getCheckResults(ecosystems).pipe(catchAndDie);

    yield* Console.log(JSON.stringify(results, null, 2));

    if (results.some((r) => !r.passed)) {
      const failedNames = results
        .filter((r) => !r.passed)
        .map((r) => r.check)
        .join(', ');
      yield* dieWithError(`checks failed: ${failedNames}`);
    }
  }),
).pipe(
  Command.withDescription(
    'Run project checks (lint, typecheck, test) for all detected ecosystems. Returns JSON array of { check, passed, output }. Use to verify code health before commits or closing tasks.',
  ),
);
