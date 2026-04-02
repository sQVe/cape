import { Effect, ServiceMap } from 'effect';

export interface TestResult {
  readonly passed: boolean;
  readonly output: string;
}

export class TestService extends ServiceMap.Service<
  TestService,
  {
    readonly runTest: (
      command: string,
      args: readonly string[],
    ) => Effect.Effect<TestResult>;
  }
>()('TestService') {}

export const runTest = (command: string, args: readonly string[]) =>
  Effect.gen(function* () {
    const service = yield* TestService;
    return yield* service.runTest(command, args);
  });
