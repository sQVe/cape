import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { resolveTestCommand } from '../services/check';
import { getDetectResult, getPackageManager, isTestFile, resolveTestPath } from '../services/detect';
import { writeStateKey } from '../services/hook';
import { runTest } from '../services/test';

export const test = Command.make(
  'test',
  { file: Argument.string('file').pipe(Argument.optional) },
  Effect.fn(function* ({ file }) {
    const ecosystems = yield* getDetectResult.pipe(
      Effect.catch((error: Error) => {
        const result = { error: error.message };
        return Console.error(JSON.stringify(result)).pipe(Effect.andThen(Effect.die(error)));
      }),
    );

    const packageManager = yield* getPackageManager;
    const testCommand = resolveTestCommand(ecosystems, packageManager);
    if (testCommand == null) {
      const result = { error: 'no test runner detected' };
      yield* Console.error(JSON.stringify(result));
      return yield* Effect.fail(new Error(result.error));
    }

    const args = [...testCommand.args];

    if (file._tag === 'Some') {
      const ecosystem = ecosystems[0];
      let testFile = file.value;

      if (ecosystem != null && !isTestFile(ecosystem.language, file.value)) {
        const resolved = resolveTestPath(ecosystem.language, file.value);
        if (resolved != null) {
          testFile = resolved;
        }
      }

      args.push(testFile);
    }

    const result = yield* runTest(testCommand.command, args);

    const phase = result.passed ? 'green' : 'red';
    yield* writeStateKey('tddState', { phase });

    yield* Console.log(
      JSON.stringify({
        passed: result.passed,
        phase,
        runner: testCommand.label,
        ...(file._tag === 'Some' ? { file: file.value } : {}),
      }),
    );

    if (!result.passed) {
      yield* Console.error(result.output);
      yield* Effect.fail(new Error('tests failed'));
    }
  }),
).pipe(
  Command.withDescription(
    'Run tests for the detected ecosystem. Writes TDD state (green/red) and returns structured JSON.',
  ),
);
