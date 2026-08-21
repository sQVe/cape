import { execFileSync } from 'node:child_process';

import { Effect } from 'effect';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HerdrService } from './herdr';
import { HerdrServiceLive } from './herdrLive';

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}));

const run = <A>(effect: Effect.Effect<A, unknown, HerdrService>) =>
  Effect.runPromise(effect.pipe(Effect.provide(HerdrServiceLive)));

const mockExecFileSync = vi.mocked(execFileSync);

const reportPhase = (workspaceId: string, phase: 'plan' | 'build' | 'review' | 'pr') =>
  run(
    Effect.gen(function* () {
      const herdr = yield* HerdrService;
      return yield* herdr.reportPhase(workspaceId, phase);
    }),
  );

const lastArgv = () => {
  const argv = mockExecFileSync.mock.calls[0]?.[1];
  if (argv == null) {
    throw new Error('herdr was never spawned');
  }
  return argv as string[];
};

// Throws rather than returning undefined: a missing flag is the failure these tests
// exist to catch, so it has to surface as one instead of an undefined comparison.
const flagValue = (flag: string) => {
  const argv = lastArgv();
  const value = argv[argv.indexOf(flag) + 1];
  if (value == null) {
    throw new Error(`no value for ${flag} in: ${argv.join(' ')}`);
  }
  return value;
};

afterEach(() => {
  vi.resetAllMocks();
});

// The command swallows every herdr rejection into reported:false, so a renamed flag
// or an out-of-range TTL would ship silently. These pin the argv itself.
describe('HerdrServiceLive.reportPhase', () => {
  it('reports the phase as metadata under the cape source, never a rename', async () => {
    mockExecFileSync.mockReturnValue('');

    await reportPhase('w65', 'build');

    const argv = lastArgv();
    expect(mockExecFileSync.mock.calls[0]?.[0]).toBe('herdr');
    expect(argv.slice(0, 3)).toEqual(['workspace', 'report-metadata', 'w65']);
    expect(flagValue('--source')).toBe('cape');
    expect(flagValue('--token')).toBe('phase=build');
    expect(argv).not.toContain('rename');
  });

  it('keeps the ttl inside the range herdr accepts', async () => {
    mockExecFileSync.mockReturnValue('');

    await reportPhase('w65', 'pr');

    const ttl = Number(flagValue('--ttl-ms'));
    expect(ttl).toBeGreaterThanOrEqual(1);
    expect(ttl).toBeLessThanOrEqual(86_400_000);
  });

  // herdr rejects a report whose seq trails the last one from the same source, so a
  // seq that lost precision to float rounding would drop later reports on the floor.
  it('sends a monotonic integer seq that survives the safe integer range', async () => {
    mockExecFileSync.mockReturnValue('');
    await reportPhase('w65', 'plan');
    const first = flagValue('--seq');

    vi.resetAllMocks();
    mockExecFileSync.mockReturnValue('');
    await reportPhase('w65', 'review');
    const second = flagValue('--seq');

    expect(first).toMatch(/^\d+$/);
    expect(Number(first)).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
    expect(BigInt(second)).toBeGreaterThanOrEqual(BigInt(first));
  });

  it('reports false instead of throwing when herdr rejects the call', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('metadata ttl_ms must be 86400000 or less');
    });

    await expect(reportPhase('w65', 'build')).resolves.toBe(false);
  });

  it('reports true when herdr accepts the call', async () => {
    mockExecFileSync.mockReturnValue('');

    await expect(reportPhase('w65', 'build')).resolves.toBe(true);
  });
});
