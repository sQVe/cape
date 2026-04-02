import { Effect, ServiceMap } from 'effect';

const conventionalPattern =
  /^(feat|fix|refactor|docs|test|chore|ci|perf|build|style|revert)(\(.+\))?: .+$/;

const sensitivePatterns = [/^\.env/, /credentials/i, /secret/i, /\.pem$/, /\.key$/];

export interface CommitResult {
  readonly message: string;
  readonly files: string[];
}

export const validateMessage = (message: string) => {
  const subject = message.split('\n')[0] ?? '';
  if (!conventionalPattern.test(subject)) {
    return `invalid conventional commit format: "${message}"`;
  }
  return null;
};

export const validateFiles = (files: readonly string[]) => {
  if (files.includes('.')) {
    return 'bulk staging with "." is not allowed';
  }
  return null;
};

export const detectSensitiveFiles = (files: readonly string[]) =>
  files.filter((file) => sensitivePatterns.some((pattern) => pattern.test(file)));

export class CommitService extends ServiceMap.Service<
  CommitService,
  {
    readonly stageAndCommit: (
      files: readonly string[],
      message: string,
    ) => Effect.Effect<void, Error>;
  }
>()('CommitService') {}

export const stageAndCommit = (files: readonly string[], message: string) =>
  Effect.gen(function* () {
    const service = yield* CommitService;
    return yield* service.stageAndCommit(files, message);
  });
