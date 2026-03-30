import type { Effect } from 'effect';
import { ServiceMap } from 'effect';

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

const stripFrontmatter = (raw: string): { frontmatter: string | null; body: string } => {
  if (!raw.startsWith('---\n')) {
    return { frontmatter: null, body: raw };
  }

  const closing = raw.indexOf('\n---\n', 4);
  if (closing === -1) {
    const closingEnd = raw.indexOf('\n---', 4);
    if (closingEnd !== -1 && closingEnd + 4 >= raw.length) {
      return { frontmatter: raw.slice(4, closingEnd), body: '' };
    }
    return { frontmatter: null, body: raw };
  }

  return {
    frontmatter: raw.slice(4, closing),
    body: raw.slice(closing + 5).replace(/^\n+/, ''),
  };
};

export const parseRuleFile = (source: string, raw: string): RuleFile => {
  const { frontmatter, body } = stripFrontmatter(raw);
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
