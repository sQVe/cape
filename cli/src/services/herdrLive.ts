import { execFileSync } from 'node:child_process';

import { Effect, Layer } from 'effect';

import { HerdrService, type WorkspacePhase } from './herdr';

const env = (name: string) => {
  // eslint-disable-next-line node/no-process-env
  const value = process.env[name];
  // A blank or whitespace-only value is absent, not a usable id.
  return value == null || value.trim() === '' ? null : value;
};

// The maximum herdr accepts. A phase is only true while the session that reported it
// is alive, so an abandoned workspace expires overnight instead of showing a phase
// nothing is working on -- the failure mode of the label this replaced.
const phaseTtlMs = 86_400_000;

// herdr rejects a report whose seq does not advance past the last one from the same
// source, ties included, and still exits 0 when it drops one. Scaling Date.now() to
// nanoseconds looks precise but carries millisecond resolution, so two cape processes
// reporting in the same millisecond built the same seq and the second write vanished
// while the command still printed reported:true. timeOrigin is wall-clock at process
// start with sub-millisecond precision and performance.now() adds monotonic elapsed
// time, which keeps two processes comparable and separable. Microseconds hold the
// origin inside the safe integer range; the sum exceeds it, hence the bigint.
const reportSeq = () => {
  const originNs = BigInt(Math.round(performance.timeOrigin * 1000)) * 1000n;
  const elapsedNs = BigInt(Math.round(performance.now() * 1_000_000));
  return (originNs + elapsedNs).toString();
};

// Display-only metadata, never a rename: the workspace label belongs to whoever named
// it. Best-effort like every cosmetic cape call -- a cape command must never fail
// because a sidebar hint did not land.
const reportPhase = (workspaceId: string, phase: WorkspacePhase) =>
  Effect.try({
    try: () => {
      execFileSync(
        'herdr',
        [
          'workspace',
          'report-metadata',
          workspaceId,
          '--source',
          'cape',
          '--token',
          `phase=${phase}`,
          '--ttl-ms',
          String(phaseTtlMs),
          '--seq',
          reportSeq(),
        ],
        { encoding: 'utf-8', timeout: 3000 },
      );
      return true;
    },
    catch: () => new Error('herdr command failed'),
  }).pipe(Effect.orElseSucceed(() => false));

export const HerdrServiceLive = Layer.succeed(HerdrService)({
  workspaceId: () => env('HERDR_WORKSPACE_ID'),
  reportPhase,
});
