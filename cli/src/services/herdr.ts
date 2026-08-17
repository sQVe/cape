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

const descriptionBudget = 32;

const describeTitle = (title: string) => {
  const text = title.trim().toLowerCase().replace(/\s+/g, ' ');
  // Budget in code points, not code units: slicing units splits a non-BMP
  // character into an unpaired surrogate at the boundary.
  const points = [...text];
  if (points.length <= descriptionBudget) {
    return text;
  }
  const head = points.slice(0, descriptionBudget + 1).join('');
  const boundary = head.lastIndexOf(' ');
  return boundary === -1 ? points.slice(0, descriptionBudget).join('') : head.slice(0, boundary);
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
  const description = title == null ? '' : describeTitle(title);
  const repoName = repo == null ? '' : repo.trim().toLowerCase();
  const tab = `${icon} ${prNumber == null ? id : `#${prNumber}`}`;

  if (repoName.length === 0) {
    return {
      workspace: description.length > 0 ? `${icon} ${id} ${description}` : `${icon} ${id}`,
      tab,
    };
  }

  return {
    workspace: `${repoName}: ${icon} ${description.length > 0 ? description : id}`,
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
