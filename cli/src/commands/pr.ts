import { Console, Effect } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import { HookService } from '../services/hook';
import { findTemplate, PrService, readStdin, validatePrBody } from '../services/pr';

const formatValidationErrors = (result: ReturnType<typeof validatePrBody>) => {
  const parts: string[] = [];
  if (result.missing.length > 0) {
    parts.push(`missing sections: ${result.missing.join(', ')}`);
  }
  if (result.unchecked.length > 0) {
    parts.push(`unchecked test plan items: ${result.unchecked.join(', ')}`);
  }
  return parts.join('; ');
};

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
      return yield* Effect.fail(new Error(formatValidationErrors(result)));
    }
  }),
).pipe(
  Command.withDescription(
    'Validate a PR body against the repo template sections. Use before creating a PR to ensure completeness.',
  ),
);

const prCreate = Command.make(
  'create',
  {
    title: Flag.string('title'),
    body: Flag.string('body'),
    draft: Flag.boolean('draft').pipe(Flag.withDefault(false)),
    label: Flag.string('label').pipe(Flag.optional),
    noPush: Flag.boolean('no-push').pipe(Flag.withDefault(false)),
  },
  Effect.fn(function* ({ title, body, draft, label, noPush }) {
    const hookService = yield* HookService;
    const prService = yield* PrService;

    const branch = yield* hookService.spawnGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch == null) {
      yield* Console.error(JSON.stringify({ error: 'failed to determine current branch' }));
      return yield* Effect.fail(new Error('failed to determine current branch'));
    }

    const defaultRef = yield* hookService.spawnGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const defaultBranch = defaultRef?.replace(/^refs\/remotes\/origin\//, '') ?? 'main';
    if (branch === defaultBranch) {
      const error = { error: `Cannot create PR from default branch "${branch}". Create a feature branch first.` };
      yield* Console.error(JSON.stringify(error));
      return yield* Effect.fail(new Error(error.error));
    }

    const status = yield* hookService.spawnGit(['status', '--porcelain']);
    if (status != null && status.length > 0) {
      const error = { error: 'Uncommitted changes detected. Commit or stash before creating a PR.' };
      yield* Console.error(JSON.stringify(error));
      return yield* Effect.fail(new Error(error.error));
    }

    const template = yield* findTemplate();
    const validation = validatePrBody(template.sections, body);
    if (!validation.valid) {
      const error = { error: `PR body validation failed: ${formatValidationErrors(validation)}` };
      yield* Console.error(JSON.stringify(error));
      return yield* Effect.fail(new Error(error.error));
    }

    if (!noPush) {
      const pushResult = yield* hookService.spawnGit(['push', '-u', 'origin', branch]);
      if (pushResult == null) {
        const error = { error: 'git push failed' };
        yield* Console.error(JSON.stringify(error));
        return yield* Effect.fail(new Error(error.error));
      }
    }

    const ghArgs = ['pr', 'create', '--title', title, '--body', body];
    if (draft) {
      ghArgs.push('--draft');
    }
    if (label._tag === 'Some') {
      ghArgs.push('--label', label.value);
    }

    const url = yield* prService.spawnGh(ghArgs).pipe(
      Effect.catch((error: Error) => {
        const message = `gh pr create failed: ${error.message}`;
        return Console.error(JSON.stringify({ error: message })).pipe(
          Effect.andThen(Effect.fail(new Error(message))),
        );
      }),
    );

    yield* Console.log(JSON.stringify({ created: true, url: url.trim() }));
  }),
).pipe(
  Command.withDescription(
    'Create a PR with pre-flight checks and body validation. Pushes branch and validates against template.',
  ),
);

export const pr = Command.make('pr').pipe(
  Command.withDescription('PR template discovery, body validation, and creation.'),
  Command.withSubcommands([prTemplate, prValidate, prCreate]),
);
