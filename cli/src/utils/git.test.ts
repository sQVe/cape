import { describe, expect, it } from 'vitest';

import { gitCommonDir, gitRoot } from './git';

describe('gitRoot', () => {
  it('returns the git repository root when invoked inside one', () => {
    const root = gitRoot();
    expect(root.length).toBeGreaterThan(0);
    expect(root.includes('\n')).toBe(false);
  });
});

describe('gitCommonDir', () => {
  it('returns an absolute path when invoked inside a repository', () => {
    const commonDir = gitCommonDir();
    expect(commonDir).not.toBeNull();
    expect(commonDir?.startsWith('/')).toBe(true);
    expect(commonDir?.includes('\n')).toBe(false);
  });

  it('returns null when invoked outside a repository', () => {
    expect(gitCommonDir('/')).toBeNull();
  });
});
