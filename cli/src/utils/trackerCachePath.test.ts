import { describe, expect, it } from 'vitest';

import { cacheFileName, trackerCachePath } from './trackerCachePath';

describe('cacheFileName', () => {
  it('gives two repositories two different file names', () => {
    expect(cacheFileName('/home/me/cape/.git')).not.toEqual(
      cacheFileName('/home/me/platform/.git'),
    );
  });

  it('gives the same repository the same file name every call', () => {
    expect(cacheFileName('/home/me/cape/.git')).toEqual(cacheFileName('/home/me/cape/.git'));
  });

  it('falls back to a fixed name outside a repository', () => {
    expect(cacheFileName(null)).toEqual('tracker-nogit.json');
  });
});

describe('trackerCachePath', () => {
  it('places the cache under the plugin context directory', () => {
    expect(trackerCachePath('/plugin')).toMatch(
      /^\/plugin\/hooks\/context\/tracker-[a-z0-9]+\.json$/,
    );
  });
});
