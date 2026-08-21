import { describe, expect, it } from 'vitest';

import { cacheFileName, cacheFileNameFor, trackerCachePath } from './trackerCachePath';

describe('cacheFileName', () => {
  it('gives two repositories two different file names', () => {
    expect(cacheFileName('/home/me/cape/.git')).not.toEqual(
      cacheFileName('/home/me/platform/.git'),
    );
  });

  it('gives the same repository the same file name every call', () => {
    expect(cacheFileName('/home/me/cape/.git')).toEqual(cacheFileName('/home/me/cape/.git'));
  });
});

describe('cacheFileNameFor', () => {
  it('names the file after the repository when git answers', () => {
    expect(cacheFileNameFor({ kind: 'ok', commonDir: '/home/me/cape/.git' })).toEqual(
      cacheFileName('/home/me/cape/.git'),
    );
  });

  it('falls back to a fixed name outside a repository', () => {
    expect(cacheFileNameFor({ kind: 'no-repo' })).toEqual('tracker-nogit.json');
  });

  // Falling back here would dump a real repository's cache into the file every
  // non-repo invocation shares, which is the collision this module prevents.
  it('refuses to guess a path when git never answered', () => {
    expect(() => cacheFileNameFor({ kind: 'unavailable' })).toThrow(/git/i);
  });
});

describe('trackerCachePath', () => {
  it('places the cache under the plugin context directory', () => {
    expect(trackerCachePath('/plugin')).toMatch(
      /^\/plugin\/hooks\/context\/tracker-[a-z0-9]+\.json$/,
    );
  });
});
