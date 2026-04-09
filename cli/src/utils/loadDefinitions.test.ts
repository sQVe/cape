import { Effect } from 'effect';
import { describe, expect, it } from 'vitest';

import type { DefinitionReader } from './loadDefinitions';
import { collectDefinitionNames, loadDefinitions } from './loadDefinitions';

const makeReader = (files: Record<string, string>): DefinitionReader => ({
  globFiles: (pattern: string) => {
    const dir = pattern.split('*')[0] ?? '';
    return Effect.succeed(Object.keys(files).filter((f) => f.startsWith(dir)));
  },
  readFile: (path: string) =>
    files[path] != null
      ? Effect.succeed(files[path])
      : Effect.die(new Error(`no file: ${path}`)),
});

describe('loadDefinitions', () => {
  it('applies transform to each matched file', async () => {
    const reader = makeReader({
      'skills/a/SKILL.md': 'body-a',
      'skills/b/SKILL.md': 'body-b',
    });

    const results = await Effect.runPromise(
      loadDefinitions(reader, 'skills/', (file, content) => ({ file, content })),
    );

    expect(results).toEqual([
      { file: 'skills/a/SKILL.md', content: 'body-a' },
      { file: 'skills/b/SKILL.md', content: 'body-b' },
    ]);
  });
});

const skillNameExtractor = (path: string): string | null => {
  const match = path.match(/skills\/([^/]+)\/SKILL\.md$/);
  return match?.[1] ?? null;
};

describe('collectDefinitionNames', () => {
  it('collects names extracted from matched paths and drops nulls', async () => {
    const reader = makeReader({
      'skills/alpha/SKILL.md': '',
      'skills/beta/SKILL.md': '',
      'skills/ignored.txt': '',
    });

    const names = await Effect.runPromise(
      collectDefinitionNames(reader, 'skills/', skillNameExtractor),
    );

    expect([...names].toSorted()).toEqual(['alpha', 'beta']);
  });
});
