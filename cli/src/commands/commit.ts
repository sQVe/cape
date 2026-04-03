import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import {
  commitNoEdit,
  detectSensitiveFiles,
  stageAndCommit,
  validateFiles,
  validateMessage,
} from '../services/commit';
import type { CommitResult } from '../services/commit';

export const commit = Command.make(
  'commit',
  {
    files: Argument.string('files').pipe(Argument.atLeast(0)),
    noEdit: Flag.boolean('no-edit').pipe(Flag.withDefault(false)),
    message: Flag.string('message').pipe(Flag.withAlias('m'), Flag.optional),
  },
  Effect.fn(function* ({ files, noEdit, message }) {
    if (noEdit) {
      yield* commitNoEdit();
      yield* Console.log(JSON.stringify({ noEdit: true }));
      return;
    }

    if (files.length === 0) {
      const error = 'at least one file is required';
      yield* Console.error(JSON.stringify({ error }));
      return yield* Effect.fail(new Error(error));
    }

    if (message._tag !== 'Some') {
      const error = '--message is required';
      yield* Console.error(JSON.stringify({ error }));
      return yield* Effect.fail(new Error(error));
    }

    const msg = message.value;

    const fileError = validateFiles(files);
    if (fileError != null) {
      yield* Console.error(JSON.stringify({ error: fileError }));
      return yield* Effect.fail(new Error(fileError));
    }

    const messageError = validateMessage(msg);
    if (messageError != null) {
      yield* Console.error(JSON.stringify({ error: messageError }));
      return yield* Effect.fail(new Error(messageError));
    }

    const sensitive = detectSensitiveFiles(files);
    if (sensitive.length > 0) {
      yield* Console.error(`warning: sensitive files: ${sensitive.join(', ')}`);
    }

    yield* stageAndCommit(files, msg);

    const result: CommitResult = {
      message: msg,
      files: [...files],
    };

    yield* Console.log(JSON.stringify(result));
  }),
).pipe(
  Command.withDescription(
    'Stage files and create a git commit with message validation and sensitive-file detection. Use instead of raw git commit.',
  ),
);
