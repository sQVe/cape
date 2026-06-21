import { readFileSync } from 'node:fs';

import { Console, Effect, Option } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import {
  mergeEpic,
  mergeTasks,
  readCacheFile,
  toEpic,
  toTasks,
  updateCachedIssueStatus,
  writeCacheFile,
} from '../services/trackerLive';
import { catchAndDie } from '../utils/catchAndDie';

const readStdin = () =>
  Effect.try({
    try: () => readFileSync('/dev/stdin', 'utf-8').trim(),
    catch: (error) =>
      error instanceof Error ? error : new Error('failed to read stdin', { cause: error }),
  });

const readJsonInput = (input: Option.Option<string>) =>
  Effect.gen(function* () {
    const content = Option.isSome(input) ? input.value : yield* readStdin().pipe(catchAndDie);
    if (content.trim().length === 0) {
      return yield* dieWithError('provide Linear issue JSON as an argument or stdin');
    }
    return content;
  });

const parseJson = (input: string, label: string) =>
  Effect.try({
    try: () => JSON.parse(input) as unknown,
    catch: () => new Error(`invalid ${label} JSON`),
  }).pipe(catchAndDie);

const cacheEpic = Command.make(
  'cache-epic',
  {
    issue: Argument.string('issue-json').pipe(
      Argument.withDescription('Linear epic issue JSON; reads stdin when omitted'),
      Argument.optional,
    ),
  },
  Effect.fn(function* ({ issue }) {
    const raw = yield* readJsonInput(issue);
    const parsed = yield* parseJson(raw, 'Linear issue');
    const epic = toEpic(parsed);
    if (epic == null) {
      return yield* dieWithError('Linear epic JSON must include an issue id');
    }

    const cache = yield* readCacheFile();
    yield* writeCacheFile(mergeEpic(cache, epic, Date.now())).pipe(catchAndDie);
    yield* Console.log(
      JSON.stringify({ cached: true, epicId: epic.id, taskCount: epic.tasks.length }),
    );
  }),
).pipe(
  Command.withDescription(
    'Refresh the local tracker cache from a Linear epic issue JSON payload, including child sub-issues.',
  ),
);

const cacheTasks = Command.make(
  'cache-tasks',
  {
    epicId: Argument.string('epic-id').pipe(
      Argument.withDescription('Epic issue id to cache tasks under'),
    ),
    issues: Argument.string('issues-json').pipe(
      Argument.withDescription('Linear task issue array JSON; reads stdin when omitted'),
      Argument.optional,
    ),
  },
  Effect.fn(function* ({ epicId, issues }) {
    const trimmedEpicId = epicId.trim();
    if (trimmedEpicId.length === 0) {
      return yield* dieWithError('epic id is required');
    }

    const raw = yield* readJsonInput(issues);
    const parsed = yield* parseJson(raw, 'Linear tasks');
    if (!Array.isArray(parsed)) {
      return yield* dieWithError('Linear tasks JSON must be an array of issues');
    }

    const tasks = toTasks(parsed);
    if (tasks.length !== parsed.length) {
      return yield* dieWithError('Linear task JSON must include issue ids');
    }

    const cache = yield* readCacheFile();
    yield* writeCacheFile(mergeTasks(cache, trimmedEpicId, tasks, Date.now())).pipe(catchAndDie);
    yield* Console.log(
      JSON.stringify({ cached: true, epicId: trimmedEpicId, taskCount: tasks.length }),
    );
  }),
).pipe(
  Command.withDescription(
    'Refresh cached tasks for an epic from Linear list_issues JSON. This replaces the cached task list for that epic.',
  ),
);

const cacheStatus = Command.make(
  'cache-status',
  {
    issueId: Argument.string('issue-id').pipe(
      Argument.withDescription('Issue id whose cached status should update'),
    ),
    status: Argument.string('status').pipe(
      Argument.withDescription('Linear state name, e.g. Todo, In Progress, Done'),
    ),
    stateType: Argument.string('state-type').pipe(
      Argument.withDescription('Optional Linear state type, e.g. unstarted, started, completed'),
      Argument.optional,
    ),
  },
  Effect.fn(function* ({ issueId, status, stateType }) {
    const trimmedIssueId = issueId.trim();
    const trimmedStatus = status.trim();
    if (trimmedIssueId.length === 0) {
      return yield* dieWithError('issue id is required');
    }
    if (trimmedStatus.length === 0) {
      return yield* dieWithError('status is required');
    }

    const cache = yield* readCacheFile();
    const updatedCache = updateCachedIssueStatus({
      cache,
      targetIssueId: trimmedIssueId,
      status: trimmedStatus,
      stateType: Option.isSome(stateType) ? stateType.value : null,
      timestamp: Date.now(),
    });

    if (updatedCache != null) {
      yield* writeCacheFile(updatedCache).pipe(catchAndDie);
    }

    yield* Console.log(
      JSON.stringify({
        cached: updatedCache != null,
        issueId: trimmedIssueId,
        changed: updatedCache != null,
      }),
    );
  }),
).pipe(
  Command.withDescription('Refresh one cached issue status after an MCP Linear state update.'),
);

export const tracker = Command.make('tracker').pipe(
  Command.withDescription(
    'Write MCP Linear results into the local tracker cache. Pure local cache writes; no network calls.',
  ),
  Command.withSubcommands([cacheEpic, cacheTasks, cacheStatus]),
);
