import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { composeLabels, HerdrService } from '../services/herdr';
import { readFlowPhaseContext, readTrackerCache } from '../services/hook';

const workspacePhase = Command.make(
  'phase',
  {
    phase: Argument.string('phase').pipe(
      Argument.withDescription('Workflow phase: plan | build | review | pr | blocked | done'),
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

    const context = yield* readFlowPhaseContext();
    if (context == null) {
      return yield* Console.log(JSON.stringify({ skipped: true, reason: 'no epic stamped' }));
    }

    const cache = yield* readTrackerCache();
    const epic = cache?.epics[context.issueId] ?? null;
    const labels = composeLabels(phase, context.issueId, epic?.title ?? null);
    if (labels == null) {
      return yield* Console.log(
        JSON.stringify({ skipped: true, reason: `unknown phase: ${phase}` }),
      );
    }

    yield* herdr.rename('workspace', workspaceId, labels.workspace);
    const tabId = herdr.tabId();
    if (tabId != null) {
      yield* herdr.rename('tab', tabId, labels.tab);
    }

    yield* Console.log(
      JSON.stringify({
        renamed: true,
        workspace: labels.workspace,
        tab: tabId == null ? null : labels.tab,
      }),
    );
  }),
).pipe(
  Command.withDescription(
    'Relabel the current herdr workspace and tab with the cape workflow phase icon for the active epic. Safe no-op outside a herdr workspace or with no stamped epic.',
  ),
);

export const workspace = Command.make('workspace').pipe(
  Command.withDescription('Manage the herdr workspace label for the active epic context.'),
  Command.withSubcommands([workspacePhase]),
);
