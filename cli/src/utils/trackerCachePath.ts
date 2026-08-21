import { createHash } from 'node:crypto';

import { gitCommonDir } from './git';
import type { GitCommonDir } from './git';

// One cache file per repository. The name is derived from the git common dir
// rather than the worktree, so every worktree of a repo shares one cache while
// two repos never collide — Linear identifiers are only unique per workspace,
// and two workspaces can both have a team named `AI`.
export const cacheFileName = (commonDir: string) => {
  const id = createHash('sha1').update(commonDir).digest('hex').slice(0, 12);
  return `tracker-${id}.json`;
};

export const cacheFileNameFor = (result: GitCommonDir) => {
  if (result.kind === 'unavailable') {
    throw new Error(
      'git did not answer, so the tracker cache path cannot be resolved; refusing to fall back, since that would mix this repository cache with every other one',
    );
  }
  return result.kind === 'no-repo' ? 'tracker-nogit.json' : cacheFileName(result.commonDir);
};

export const trackerCacheDir = (root: string) => `${root}/hooks/context`;

export const trackerCachePath = (root: string, cwd?: string) =>
  `${trackerCacheDir(root)}/${cacheFileNameFor(gitCommonDir(cwd))}`;
