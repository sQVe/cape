import type { Effect } from 'effect';
import { ServiceMap } from 'effect';

import { splitFrontmatter } from '../utils/frontmatter';

export interface RuleFile {
  readonly source: string;
  readonly globs: string[];
  readonly content: string;
}

export interface ChangedFile {
  readonly path: string;
  readonly content: string;
}

export interface ConformInput {
  readonly rules: RuleFile[];
  readonly changedFiles: ChangedFile[];
  readonly scope: string;
}

const parseGlobs = (frontmatterBlock: string): string[] => {
  const globs: string[] = [];

  let inGlobs = false;
  for (const line of frontmatterBlock.split('\n')) {
    if (line.startsWith('globs:')) {
      inGlobs = true;
      continue;
    }
    if (inGlobs) {
      const match = line.match(/^\s+-\s+['"]?([^'"]+)['"]?$/);
      if (match?.[1] != null) {
        globs.push(match[1]);
      } else {
        break;
      }
    }
  }

  return globs;
};

export const parseRuleFile = (source: string, raw: string): RuleFile => {
  const { frontmatter, body } = splitFrontmatter(raw);
  const globs = frontmatter != null ? parseGlobs(frontmatter) : [];

  return { source, globs, content: body };
};

export const extractChangedPaths = (diff: string): string[] => {
  const paths = new Set<string>();

  for (const line of diff.split('\n')) {
    const match = line.match(/^diff --git a\/.+ b\/(.+)$/);
    if (match?.[1] != null) {
      paths.add(match[1]);
    }
  }

  return [...paths];
};

export class ConformService extends ServiceMap.Service<
  ConformService,
  {
    readonly discoverRules: () => Effect.Effect<RuleFile[], Error>;
    readonly readFiles: (paths: string[]) => Effect.Effect<ChangedFile[], Error>;
  }
>()('ConformService') {}
