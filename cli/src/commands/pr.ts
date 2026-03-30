import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import { findTemplate, PrService, readStdin, validatePrBody } from '../services/pr';

const prTemplate = Command.make(
  'template',
  {},
  Effect.fn(function* () {
    const result = yield* findTemplate();
    yield* Console.log(JSON.stringify(result));
  }),
).pipe(
  Command.withDescription(
    'Find and output the PR template for this repo. Use to discover required PR sections.',
  ),
);

const prValidate = Command.make(
  'validate',
  {
    file: Argument.string('file').pipe(Argument.optional),
    stdin: Flag.boolean('stdin').pipe(Flag.withDefault(false)),
  },
  Effect.fn(function* ({ file, stdin }) {
    const template = yield* findTemplate();

    let body: string;
    if (stdin) {
      body = yield* readStdin();
    } else if (file._tag === 'Some') {
      const service = yield* PrService;
      body = yield* service.readFile(file.value);
    } else {
      yield* Console.error(JSON.stringify({ error: 'provide <file> or --stdin' }));
      return yield* Effect.fail(new Error('provide <file> or --stdin'));
    }

    const result = validatePrBody(template.sections, body);
    yield* Console.log(JSON.stringify(result));

    if (!result.valid) {
      return yield* Effect.fail(new Error(result.missing.join(', ')));
    }
  }),
).pipe(
  Command.withDescription(
    'Validate a PR body against the repo template sections. Use before creating a PR to ensure completeness.',
  ),
);

export const pr = Command.make('pr').pipe(
  Command.withDescription('PR template discovery and body validation.'),
  Command.withSubcommands([prTemplate, prValidate]),
);
