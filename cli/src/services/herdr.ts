import { Effect, ServiceMap } from 'effect';

// The cape workflow phases herdr cannot observe for itself. Deliberately excludes
// blocked and done: herdr tracks those natively as agent_status and renders them
// through state_icon, so reporting them duplicates a live value with a pushed one
// that goes stale the moment a session ends.
const workspacePhases = ['plan', 'build', 'review', 'pr'] as const;

export type WorkspacePhase = (typeof workspacePhases)[number];

// Normalizes a phase name (case-insensitive, surrounding whitespace ignored), or
// null when it is not a cape phase.
export const normalizePhase = (phase: string): WorkspacePhase | null => {
  const normalized = phase.trim().toLowerCase();
  return workspacePhases.includes(normalized as WorkspacePhase)
    ? (normalized as WorkspacePhase)
    : null;
};

export class HerdrService extends ServiceMap.Service<
  HerdrService,
  {
    readonly workspaceId: () => string | null;
    readonly reportPhase: (workspaceId: string, phase: WorkspacePhase) => Effect.Effect<boolean>;
  }
>()('HerdrService') {}
