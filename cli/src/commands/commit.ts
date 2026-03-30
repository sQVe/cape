import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  detectSensitiveFiles,
  stageAndCommit,
  validateFiles,
  validateMessage,
} from '../services/commit';
import type { CommitResult } from '../services/commit';

export const commit = Command.make(
  'commit',
  {
    files: Argument.string('files').pipe(Argument.atLeast(1)),
    message: Flag.string('message').pipe(Flag.withAlias('m')),
  },
  Effect.fn(function* ({ files, message }) {
    const fileError = validateFiles(files);
    if (fileError != null) {
      yield* Console.error(JSON.stringify({ error: fileError }));
      return yield* Effect.fail(new Error(fileError));
    }

    const messageError = validateMessage(message);
    if (messageError != null) {
      yield* Console.error(JSON.stringify({ error: messageError }));
      return yield* Effect.fail(new Error(messageError));
    }

    const sensitive = detectSensitiveFiles(files);
    if (sensitive.length > 0) {
      yield* Console.error(`warning: sensitive files: ${sensitive.join(', ')}`);
    }

    yield* stageAndCommit(files, message);

    const result: CommitResult = {
      message,
      files: [...files],
    };

    yield* Console.log(JSON.stringify(result));
  }),
).pipe(
  Command.withDescription(
    'Stage files and create a git commit with message validation and sensitive-file detection. Use instead of raw git commit.',
  ),
);
