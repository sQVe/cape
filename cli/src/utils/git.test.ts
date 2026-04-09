import { describe, expect, it } from 'vitest';

import { gitRoot } from './git';

describe('gitRoot', () => {
  it('returns the git repository root when invoked inside one', () => {
    const root = gitRoot();
    expect(root.length).toBeGreaterThan(0);
    expect(root.includes('\n')).toBe(false);
  });
});
