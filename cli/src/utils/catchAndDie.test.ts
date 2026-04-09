import { Cause, Effect, Exit } from 'effect';
import { describe, expect, it, vi } from 'vitest';

import { catchAndDie } from './catchAndDie';

describe('catchAndDie', () => {
  it('writes JSON error to stderr and dies with the original error as a defect on failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const original = new Error('boom');

    const exit = await Effect.runPromiseExit(
      Effect.fail(original).pipe(catchAndDie),
    );

    expect(errorSpy).toHaveBeenCalledWith(JSON.stringify({ error: 'boom' }));
    expect(Exit.isFailure(exit)).toBe(true);
    if (Exit.isFailure(exit)) {
      const dies = exit.cause.reasons
        .filter(Cause.isDieReason)
        .map((r) => r.defect);
      expect(dies).toContain(original);
    }

    errorSpy.mockRestore();
  });

  it('passes the success value through unchanged', async () => {
    const value = await Effect.runPromise(Effect.succeed(42).pipe(catchAndDie));
    expect(value).toBe(42);
  });
});
