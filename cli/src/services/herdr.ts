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

const shortTitle = (title: string) => title.trim().split(/\s+/).slice(0, 3).join(' ');

export interface WorkspaceLabels {
  readonly workspace: string;
  readonly tab: string;
}

// Composes the herdr labels for a phase + epic, or null when the phase is unknown.
// The workspace label carries the short title; the narrower tab label is icon + id only.
export const composeLabels = (
  phase: string,
  issueId: string,
  title: string | null,
): WorkspaceLabels | null => {
  const icon = phaseIcon(phase);
  if (icon == null) {
    return null;
  }
  const trimmedTitle = title == null ? '' : shortTitle(title);
  const workspace =
    trimmedTitle.length > 0 ? `${icon} ${issueId} ${trimmedTitle}` : `${icon} ${issueId}`;
  return { workspace, tab: `${icon} ${issueId}` };
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
