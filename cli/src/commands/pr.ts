import { Console, Effect, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';

import { HookService } from '../services/hook';
import { findTemplate, PrService, readStdin, validatePrBody } from '../services/pr';
import { catchAndDie } from '../utils/catchAndDie';

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
    'Find and output the PR template for this repo. Returns { found, path?, sections }. Use to discover required PR sections.',
  ),
);

const prValidate = Command.make(
  'validate',
  {
    file: Argument.string('file').pipe(Argument.withDescription('Path to PR body file to validate'), Argument.optional),
    stdin: Flag.boolean('stdin').pipe(Flag.withDescription('Read PR body from stdin instead of file'), Flag.withDefault(false)),
  },
  Effect.fn(function* ({ file, stdin }) {
    const template = yield* findTemplate();

    let body: string;
    if (stdin) {
      body = yield* readStdin();
    } else if (Option.isSome(file)) {
      const service = yield* PrService;
      body = yield* service.readFile(file.value);
    } else {
      return yield* dieWithError('provide <file> or --stdin');
    }

    const result = validatePrBody(template.sections, body);
    yield* Console.log(JSON.stringify(result));

    if (!result.valid) {
      return yield* dieWithError(formatValidationErrors(result));
    }
  }),
).pipe(
  Command.withDescription(
    'Validate a PR body against the repo template sections. Returns { valid, missing, unchecked }. Use before creating a PR.',
  ),
);

const prCreate = Command.make(
  'create',
  {
    title: Flag.string('title').pipe(Flag.withDescription('PR title')),
    body: Flag.string('body').pipe(Flag.withDescription('PR body content with required template sections')),
    draft: Flag.boolean('draft').pipe(Flag.withDescription('Create as draft PR'), Flag.withDefault(false)),
    label: Flag.string('label').pipe(Flag.withDescription('GitHub label to apply to the PR'), Flag.optional),
    noPush: Flag.boolean('no-push').pipe(Flag.withDescription('Skip git push; assume branch is already pushed'), Flag.withDefault(false)),
  },
  Effect.fn(function* ({ title, body, draft, label, noPush }) {
    const hookService = yield* HookService;
    const prService = yield* PrService;

    const branch = yield* hookService.spawnGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch == null) {
      return yield* dieWithError('failed to determine current branch');
    }

    const defaultRef = yield* hookService.spawnGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
    const defaultBranch = defaultRef?.replace(/^refs\/remotes\/origin\//, '') ?? 'main';
    if (branch === defaultBranch) {
      return yield* dieWithError(`Cannot create PR from default branch "${branch}". Create a feature branch first.`);
    }

    const status = yield* hookService.spawnGit(['status', '--porcelain']);
    if (status != null && status.length > 0) {
      return yield* dieWithError('Uncommitted changes detected. Commit or stash before creating a PR.');
    }

    const template = yield* findTemplate();
    const validation = validatePrBody(template.sections, body);
    if (!validation.valid) {
      return yield* dieWithError(`PR body validation failed: ${formatValidationErrors(validation)}`);
    }

    if (!noPush) {
      const pushResult = yield* hookService.spawnGit(['push', '-u', 'origin', branch]);
      if (pushResult == null) {
        return yield* dieWithError(`git push failed for branch "${branch}"`);
      }
    }

    const ghArgs = ['pr', 'create', '--title', title, '--body', body];
    if (draft) {
      ghArgs.push('--draft');
    }
    if (Option.isSome(label)) {
      ghArgs.push('--label', label.value);
    }

    const url = yield* prService.spawnGh(ghArgs).pipe(
      Effect.mapError((error: Error) => new Error(`gh pr create failed: ${error.message}`)),
      catchAndDie,
    );

    yield* Console.log(JSON.stringify({ created: true, url: url.trim() }));
  }),
).pipe(
  Command.withDescription(
    'Create a PR with pre-flight checks and body validation. Returns { created, url }. Use to push and open a PR in one step.',
  ),
);

export const pr = Command.make('pr').pipe(
  Command.withDescription('PR template discovery, body validation, and creation. Use for all PR lifecycle operations.'),
  Command.withSubcommands([prTemplate, prValidate, prCreate]),
);
