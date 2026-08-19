import { Console, Effect } from 'effect';
import { Argument, Command } from 'effect/unstable/cli';

import { GitService } from '../services/git';
import { composeLabels, HerdrService } from '../services/herdr';
import { readFlowPhaseContext, readRawTrackerCache } from '../services/hook';
import { PrService } from '../services/pr';
import { findEpic } from '../services/tracker';

// gh emits '{"number":123,"state":"OPEN"}'. Anything else — no PR for the branch, an
// error message, a payload without a usable number — means there is nothing to label
// with. Safe integers only: JSON.parse rounds anything larger, so the label would name
// a different PR than the payload did. The state is load-bearing: 'gh pr view' with no
// argument falls back to the branch's most recent merged or closed PR, and a dead PR
// number is worse than the issue id.
const parsePrNumber = (raw: string): number | null => {
  try {
    const { number, state } = JSON.parse(raw) as { number?: unknown; state?: unknown };
    if (state !== 'OPEN') {
      return null;
    }
    return typeof number === 'number' && Number.isSafeInteger(number) && number > 0 ? number : null;
  } catch {
    return null;
  }
};

// Looked up live rather than stamped at 'cape pr create' time, because a PR can be
// opened outside cape and a stamp never learns about it. Best-effort like
// HerdrService.rename — a missing gh or a failed lookup degrades to the issue id.
// Only the pr phase labels with a PR number, so every other phase skips the gh
// subprocess instead of waiting on a number it will not use. Normalized the same
// way phaseIcon normalizes, so 'PR' and ' pr ' count too.
const lookupPrNumber = (phase: string) =>
  Effect.gen(function* () {
    if (phase.trim().toLowerCase() !== 'pr') {
      return null;
    }

    const pr = yield* PrService;
    const raw = yield* pr.spawnGh(['pr', 'view', '--json', 'number,state']);
    return parsePrNumber(raw);
  }).pipe(Effect.orElseSucceed(() => null));

const workspacePhase = Command.make(
  'phase',
  {
    phase: Argument.string('phase').pipe(
      Argument.withDescription('Workflow phase: plan | build | review | pr | blocked | done'),
    ),
  },
  Effect.fn(function* ({ phase }) {
    const herdr = yield* HerdrService;
    const git = yield* GitService;

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

    // Raw read on purpose: a stale cache still has the right epic title, and a
    // bare "icon + id" label is worse than a slightly old title.
    const cache = yield* readRawTrackerCache();
    const epic = cache == null ? null : findEpic(cache, context.issueId);
    const repo = yield* git.repoName();
    const prNumber = yield* lookupPrNumber(phase);
    const labels = composeLabels(phase, context.issueId, epic?.title ?? null, repo, prNumber);
    if (labels == null) {
      return yield* Console.log(
        JSON.stringify({ skipped: true, reason: `unknown phase: ${phase}` }),
      );
    }

    const renamed = yield* herdr.rename('workspace', workspaceId, labels.workspace);
    const tabId = herdr.tabId();
    if (tabId != null) {
      yield* herdr.rename('tab', tabId, labels.tab);
    }

    yield* Console.log(
      JSON.stringify({
        renamed,
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
