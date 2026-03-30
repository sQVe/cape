import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import { ConformService, extractChangedPaths, parseRuleFile } from '../services/conform';
import { GitService } from '../services/git';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubHookLayer,
  stubPrLayer,
  stubValidateLayer,
} from '../testStubs';

describe('parseRuleFile', () => {
  it('extracts globs from frontmatter and strips it from content', () => {
    const raw = `---
globs:
  - "**/*.ts"
  - "**/*.tsx"
---

Use arrow functions; reserve \`function\` for generators.
Use braces for all control flow statements.`;

    const result = parseRuleFile('/home/user/.claude/rules/typescript.md', raw);

    expect(result.source).toBe('/home/user/.claude/rules/typescript.md');
    expect(result.globs).toEqual(['**/*.ts', '**/*.tsx']);
    expect(result.content).toBe(
      'Use arrow functions; reserve `function` for generators.\nUse braces for all control flow statements.',
    );
  });

  it('returns empty globs for files without frontmatter', () => {
    const raw = `Some rules without frontmatter.
Another rule here.`;

    const result = parseRuleFile('/project/CLAUDE.md', raw);

    expect(result.globs).toEqual([]);
    expect(result.content).toBe(raw);
  });

  it('returns empty globs for frontmatter without globs field', () => {
    const raw = `---
name: test
description: A test file
---

Some content here.`;

    const result = parseRuleFile('/project/CLAUDE.md', raw);

    expect(result.globs).toEqual([]);
    expect(result.content).toBe('Some content here.');
  });

  it('handles single-quoted globs', () => {
    const raw = `---
globs:
  - '**/*.go'
---

Single lowercase word for package names.`;

    const result = parseRuleFile('/home/user/.claude/rules/go.md', raw);

    expect(result.globs).toEqual(['**/*.go']);
    expect(result.content).toBe('Single lowercase word for package names.');
  });

  it('strips leading blank lines from content after frontmatter', () => {
    const raw = `---
globs:
  - "**/*.ts"
---


Content after two blank lines.`;

    const result = parseRuleFile('test.md', raw);

    expect(result.content).toBe('Content after two blank lines.');
  });

  it('handles empty content after frontmatter', () => {
    const raw = `---
globs:
  - "**/*.ts"
---
`;

    const result = parseRuleFile('test.md', raw);

    expect(result.content).toBe('');
  });
});

describe('extractChangedPaths', () => {
  it('extracts file paths from a unified diff', () => {
    const diff = `diff --git a/src/index.ts b/src/index.ts
index abc123..def456 100644
--- a/src/index.ts
+++ b/src/index.ts
@@ -1,3 +1,4 @@
+import { foo } from './foo';
 const bar = 1;
diff --git a/src/utils.ts b/src/utils.ts
index 111222..333444 100644
--- a/src/utils.ts
+++ b/src/utils.ts
@@ -5,2 +5,3 @@
+export const helper = () => {};`;

    const paths = extractChangedPaths(diff);

    expect(paths).toEqual(['src/index.ts', 'src/utils.ts']);
  });

  it('returns empty array for empty diff', () => {
    expect(extractChangedPaths('')).toEqual([]);
  });

  it('deduplicates paths', () => {
    const diff = `diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts
diff --git a/src/foo.ts b/src/foo.ts
--- a/src/foo.ts
+++ b/src/foo.ts`;

    const paths = extractChangedPaths(diff);

    expect(paths).toEqual(['src/foo.ts']);
  });

  it('handles renamed files by using the target path', () => {
    const diff = `diff --git a/old/path.ts b/new/path.ts
similarity index 95%
rename from old/path.ts
rename to new/path.ts
--- a/old/path.ts
+++ b/new/path.ts`;

    const paths = extractChangedPaths(diff);

    expect(paths).toEqual(['new/path.ts']);
  });
});

const makeTestConformLayer = (
  rules: { source: string; globs: string[]; content: string }[] = [],
  files: Record<string, string> = {},
) =>
  Layer.succeed(ConformService)({
    discoverRules: () => Effect.succeed(rules),
    readFiles: (paths: string[]) =>
      Effect.succeed(
        paths.filter((p) => files[p] != null).map((p) => ({ path: p, content: files[p]! })),
      ),
  });

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (conformLayer = makeTestConformLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubHookLayer,
    stubPrLayer,
    stubValidateLayer,
    conformLayer,
  );

describe('conform command wiring', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(run(['conform', '--help']).pipe(Effect.provide(makeCommandLayers())));
  });

  it('outputs JSON with rules and changed files', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const conformLayer = makeTestConformLayer(
      [{ source: 'rules/ts.md', globs: ['**/*.ts'], content: 'Use arrow functions.' }],
      { 'src/index.ts': 'const foo = function() {}' },
    );
    const gitLayer = Layer.succeed(GitService)({
      getContext: () =>
        Effect.succeed({
          mainBranch: 'main',
          currentBranch: 'feat/test',
          status: [],
          diffStat: '',
          recentLog: [],
        }),
      getDiff: () =>
        Effect.succeed(
          'diff --git a/src/index.ts b/src/index.ts\n--- a/src/index.ts\n+++ b/src/index.ts\n',
        ),
      validateBranch: () => Effect.succeed({ valid: true, errors: [] }),
    });

    await Effect.runPromise(
      run(['conform']).pipe(
        Effect.provide(
          Layer.mergeAll(
            NodeServices.layer,
            gitLayer,
            stubDetectLayer,
            stubCheckLayer,
            stubCommitLayer,
            stubBrLayer,
            stubHookLayer,
            stubPrLayer,
            stubValidateLayer,
            conformLayer,
          ),
        ),
      ),
    );

    const output = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(output.scope).toBe('branch');
    expect(output.rules).toHaveLength(1);
    expect(output.rules[0].source).toBe('rules/ts.md');
    expect(output.changedFiles).toHaveLength(1);
    expect(output.changedFiles[0].path).toBe('src/index.ts');
    consoleSpy.mockRestore();
  });

  it('accepts a scope argument', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await Effect.runPromise(
      run(['conform', 'unstaged']).pipe(Effect.provide(makeCommandLayers())),
    );

    const output = JSON.parse(consoleSpy.mock.calls[0]?.[0] as string);
    expect(output.scope).toBe('unstaged');
    consoleSpy.mockRestore();
  });
});
