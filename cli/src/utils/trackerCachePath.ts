import { createHash } from 'node:crypto';

import { gitCommonDir } from './git';

// One cache file per repository. The name is derived from the git common dir
// rather than the worktree, so every worktree of a repo shares one cache while
// two repos never collide — Linear identifiers are only unique per workspace,
// and two workspaces can both have a team named `AI`.
export const cacheFileName = (commonDir: string | null) => {
  if (commonDir == null) {
    return 'tracker-nogit.json';
  }
  const id = createHash('sha1').update(commonDir).digest('hex').slice(0, 12);
  return `tracker-${id}.json`;
};

export const trackerCacheDir = (root: string) => `${root}/hooks/context`;

export const trackerCachePath = (root: string) =>
  `${trackerCacheDir(root)}/${cacheFileName(gitCommonDir())}`;
