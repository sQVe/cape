import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { commitNoEdit, stageAndCommit, validateFiles, validateMessage } from '../services/commit';
import type { CommitResult } from '../services/commit';
import { catchAndDie } from '../utils/catchAndDie';

export const commit = Command.make(
  'commit',
  {
    files: Argument.string('files').pipe(
      Argument.withDescription('Files to stage and commit'),
      Argument.atLeast(0),
    ),
    noEdit: Flag.boolean('no-edit').pipe(
      Flag.withDescription('Finalize a merge commit (git commit --no-edit)'),
      Flag.withDefault(false),
    ),
    allowSensitive: Flag.boolean('allow-sensitive').pipe(
      Flag.withDescription(
        'Commit files matching sensitive patterns (.env, *.pem, *.key, credentials, secret)',
      ),
      Flag.withDefault(false),
    ),
    message: Flag.string('message').pipe(
      Flag.withDescription('Commit message (repeatable, joined with blank line)'),
      Flag.withAlias('m'),
      Flag.atLeast(0),
    ),
  },
  Effect.fn(function* ({ files, noEdit, allowSensitive, message }) {
    if (noEdit) {
      yield* commitNoEdit();
      yield* Console.log(JSON.stringify({ noEdit: true }));
      return;
    }

    if (files.length === 0) {
      return yield* dieWithError('at least one file is required');
    }

    if (message.length === 0) {
      return yield* dieWithError('--message is required');
    }

    const msg = message.join('\n\n');

    const fileError = validateFiles(files);
    if (fileError != null) {
      return yield* dieWithError(fileError);
    }

    const messageError = validateMessage(msg);
    if (messageError != null) {
      return yield* dieWithError(messageError);
    }

    yield* stageAndCommit(files, msg, allowSensitive).pipe(catchAndDie);

    const result: CommitResult = {
      message: msg,
      files: [...files],
    };

    yield* Console.log(JSON.stringify(result));
  }),
).pipe(
  Command.withDescription(
    'Stage files and create a git commit with message validation and rejection of staged sensitive files (override with --allow-sensitive). Returns { message, files }. Use instead of raw git commit.',
  ),
);
