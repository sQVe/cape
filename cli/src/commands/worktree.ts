import { Console, Effect, Option } from 'effect';
import { Argument, Command, Flag } from 'effect/unstable/cli';

import { dieWithError } from '../dieWithError';
import { removeStateKey, writeStateKey } from '../services/hook';

const validPhases = ['PLAN', 'BUILD', 'SHIP'] as const;
type WorktreePhase = (typeof validPhases)[number];

const parsePhase = (value: string) => {
  const phase = value.toUpperCase();
  switch (phase) {
    case 'PLAN':
    case 'BUILD':
    case 'SHIP':
      return phase satisfies WorktreePhase;
    default:
      return null;
  }
};

const worktreeStart = Command.make(
  'start',
  {
    issueId: Argument.string('epic-id').pipe(
      Argument.withDescription('Epic issue id to stamp into this worktree'),
    ),
    phase: Flag.string('phase').pipe(
      Flag.withDescription('Workflow phase to stamp: PLAN | BUILD | SHIP (default: BUILD)'),
      Flag.optional,
    ),
  },
  Effect.fn(function* ({ issueId, phase }) {
    const trimmedIssueId = issueId.trim();
    if (trimmedIssueId.length === 0) {
      return yield* dieWithError('epic id is required');
    }

    const phaseValue = Option.isSome(phase) ? parsePhase(phase.value) : 'BUILD';
    if (phaseValue == null) {
      return yield* dieWithError('phase must be one of: PLAN, BUILD, SHIP');
    }

    yield* writeStateKey('flowPhase', { phase: phaseValue, issueId: trimmedIssueId });
    yield* Console.log(
      JSON.stringify({ stamped: true, issueId: trimmedIssueId, phase: phaseValue }),
    );
  }),
).pipe(
  Command.withDescription(
    'Stamp this worktree with the active epic context. Returns { stamped, issueId, phase }. Use after creating or entering an epic worktree.',
  ),
);

const worktreeStop = Command.make(
  'stop',
  {},
  Effect.fn(function* () {
    yield* removeStateKey('flowPhase');
    yield* Console.log(JSON.stringify({ cleared: true }));
  }),
).pipe(
  Command.withDescription(
    'Clear the active epic context from this worktree. No-op if absent. Returns { cleared }.',
  ),
);

export const worktree = Command.make('worktree').pipe(
  Command.withDescription(
    'Manage cape worktree context. Grove owns worktree creation; this command stamps or clears the local epic context used by the session banner.',
  ),
  Command.withSubcommands([worktreeStart, worktreeStop]),
);
