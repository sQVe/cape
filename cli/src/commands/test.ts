import { Console, Effect, Option } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';

import { resolveTestCommand } from '../services/check';
import { getDetectResult, getPackageManager, isTestFile, resolveTestPath } from '../services/detect';
import { writeStateKey } from '../services/hook';
import { runTest } from '../services/test';

export const test = Command.make(
  'test',
  { file: Argument.string('file').pipe(Argument.withDescription('Test file or source file to run (auto-resolves to test path)'), Argument.optional) },
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
      const languages = ecosystems.map((e) => e.language).join(', ');
      const error = languages
        ? `no test runner detected for ${languages}`
        : 'no ecosystem detected';
      return yield* dieWithError(error);
    }

    const args = [...testCommand.args];

    if (Option.isSome(file)) {
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
        ...(Option.isSome(file) ? { file: file.value } : {}),
      }),
    );

    if (!result.passed) {
      yield* Console.error(result.output);
      yield* dieWithError(`tests failed (runner: ${testCommand.label})`);
    }
  }),
).pipe(
  Command.withDescription(
    'Run tests for the detected ecosystem. Returns { passed, phase, runner } and writes TDD state. Use instead of raw test commands.',
  ),
);
