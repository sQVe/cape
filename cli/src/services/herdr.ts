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
  if (text.length <= descriptionBudget) {
    return text;
  }
  const head = text.slice(0, descriptionBudget + 1);
  const boundary = head.lastIndexOf(' ');
  return boundary === -1 ? text.slice(0, descriptionBudget) : head.slice(0, boundary);
};

export interface WorkspaceLabels {
  readonly workspace: string;
  readonly tab: string;
}

// Composes the herdr labels for a phase + epic, or null when the phase is unknown.
// The workspace label leads with the repo so sibling workspaces stay distinguishable;
// the narrower tab label is icon + id only.
export const composeLabels = (
  phase: string,
  issueId: string,
  title: string | null,
  repo: string | null,
): WorkspaceLabels | null => {
  const icon = phaseIcon(phase);
  if (icon == null) {
    return null;
  }

  const id = issueId.trim().toLowerCase();
  const description = title == null ? '' : describeTitle(title);
  const repoName = repo == null ? '' : repo.trim().toLowerCase();

  if (repoName.length === 0) {
    return {
      workspace: description.length > 0 ? `${icon} ${id} ${description}` : `${icon} ${id}`,
      tab: `${icon} ${id}`,
    };
  }

  return {
    workspace: `${repoName}: ${icon} ${description.length > 0 ? description : id}`,
    tab: `${icon} ${id}`,
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
