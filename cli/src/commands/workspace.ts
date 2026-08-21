import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { HerdrService, normalizePhase } from '../services/herdr';

const workspacePhase = Command.make(
  'phase',
  {
    phase: Argument.string('phase').pipe(
      Argument.withDescription('Workflow phase: plan | build | review | pr'),
    ),
  },
  Effect.fn(function* ({ phase }) {
    const herdr = yield* HerdrService;

    const workspaceId = herdr.workspaceId();
    if (workspaceId == null) {
      return yield* Console.log(
        JSON.stringify({ skipped: true, reason: 'not in a herdr workspace' }),
      );
    }

    const normalized = normalizePhase(phase);
    if (normalized == null) {
      return yield* Console.log(
        JSON.stringify({ skipped: true, reason: `unknown phase: ${phase}` }),
      );
    }

    const reported = yield* herdr.reportPhase(workspaceId, normalized);
    yield* Console.log(JSON.stringify({ reported, phase: normalized }));
  }),
).pipe(
  Command.withDescription(
    'Report the cape workflow phase to the current herdr workspace as display-only metadata, rendered by a $phase token in the herdr sidebar. Leaves the workspace label alone. Safe no-op outside a herdr workspace.',
  ),
);

export const workspace = Command.make('workspace').pipe(
  Command.withDescription('Report cape workflow state to the current herdr workspace.'),
  Command.withSubcommands([workspacePhase]),
);
