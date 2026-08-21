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

    // Argument before environment: a caller naming a phase that no longer exists
    // hears about the phase, not about herdr. blocked and done were valid until
    // recently, so the callers most likely to get this wrong are the ones running
    // an older copy of a skill, outside herdr as often as in it.
    const normalized = normalizePhase(phase);
    if (normalized == null) {
      return yield* Console.log(
        JSON.stringify({ skipped: true, reason: `unknown phase: ${phase}` }),
      );
    }

    const workspaceId = herdr.workspaceId();
    if (workspaceId == null) {
      return yield* Console.log(
        JSON.stringify({ skipped: true, reason: 'not in a herdr workspace' }),
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
