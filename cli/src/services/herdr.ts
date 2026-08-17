import { Effect, ServiceMap } from 'effect';

type WorkspacePhase = 'plan' | 'build' | 'review' | 'pr' | 'blocked' | 'done';

const phaseIcons: Record<WorkspacePhase, string> = {
  plan: '📋',
  build: '🔨',
  review: '🔍',
  pr: '🚀',
  blocked: '⛔',
  done: '✅',
};

// Maps a phase name (case-insensitive) to its icon, or null for an unknown phase.
export const phaseIcon = (phase: string): string | null =>
  phaseIcons[phase.trim().toLowerCase() as WorkspacePhase] ?? null;

// Budgets the whole composed label, not the description alone: the prefix is part
// of what herdr has to fit, so budgeting the tail lets a long repo name push the
// label past the sidebar and hand herdr the hard truncation this cut avoids.
const labelBudget = 40;

const describeTitle = (title: string, budget: number) => {
  const text = title.trim().toLowerCase().replace(/\s+/g, ' ');
  if (budget <= 0) {
    return '';
  }
  // Budget in code points, not code units: slicing units splits a non-BMP
  // character into an unpaired surrogate at the boundary.
  const points = [...text];
  if (points.length <= budget) {
    return text;
  }
  const head = points.slice(0, budget + 1).join('');
  const boundary = head.lastIndexOf(' ');
  return boundary === -1 ? points.slice(0, budget).join('') : head.slice(0, boundary);
};

export interface WorkspaceLabels {
  readonly workspace: string;
  readonly tab: string;
}

// Composes the herdr labels for a phase + epic, or null when the phase is unknown.
// The workspace label leads with the repo so sibling workspaces stay distinguishable;
// the narrower tab label carries the identifier worth acting on, which is the PR
// number once one is open and the issue id before that.
export const composeLabels = (
  phase: string,
  issueId: string,
  title: string | null,
  repo: string | null,
  prNumber: number | null = null,
): WorkspaceLabels | null => {
  const icon = phaseIcon(phase);
  if (icon == null) {
    return null;
  }

  const id = issueId.trim().toLowerCase();
  const repoName = repo == null ? '' : repo.trim().toLowerCase();
  const tab = `${icon} ${prNumber == null ? id : `#${prNumber}`}`;
  const prefix = repoName.length === 0 ? `${icon} ${id} ` : `${repoName}: ${icon} `;
  const description = title == null ? '' : describeTitle(title, labelBudget - [...prefix].length);

  if (repoName.length === 0) {
    return {
      workspace: description.length > 0 ? `${prefix}${description}` : `${icon} ${id}`,
      tab,
    };
  }

  return {
    workspace: `${prefix}${description.length > 0 ? description : id}`,
    tab,
  };
};

export class HerdrService extends ServiceMap.Service<
  HerdrService,
  {
    readonly workspaceId: () => string | null;
    readonly tabId: () => string | null;
    readonly rename: (
      kind: 'workspace' | 'tab',
      id: string,
      label: string,
    ) => Effect.Effect<boolean>;
  }
>()('HerdrService') {}
