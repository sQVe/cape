import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import {
  HookService,
  denyTable,
  denyWith,
  detectBugReport,
  detectExecutePlan,
  detectTrackerSkill,
  normalizeEventName,
  preToolUseBash,
  sessionStart,
  stripQuotedContent,
  userPromptSubmit,
} from '../services/hook';
import { PrService } from '../services/pr';
import { TRACKER_CACHE_TTL_MS } from '../services/tracker';
import {
  stubCommitLayer,
  stubGitLayer,
  stubPrLayer,
  stubValidateLayer,
  stubHerdrLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';
import { trackerCachePath } from '../utils/trackerCachePath';

describe('normalizeEventName', () => {
  it('converts kebab-case to PascalCase', () => {
    expect(normalizeEventName('session-start')).toBe('SessionStart');
  });

  it('preserves PascalCase', () => {
    expect(normalizeEventName('SessionStart')).toBe('SessionStart');
  });

  it('converts multi-segment kebab-case', () => {
    expect(normalizeEventName('post-tool-use-failure')).toBe('PostToolUseFailure');
  });
});

describe('detectTrackerSkill', () => {
  it('detects issue tracker wording', () => {
    expect(detectTrackerSkill('show the issue tracker')).toBe(true);
  });

  it('does not detect retired local-store wording', () => {
    expect(detectTrackerSkill('open the legacy local issue store')).toBe(false);
  });

  it('detects issue tracking phrases', () => {
    expect(detectTrackerSkill('track this bug')).toBe(true);
  });

  it('detects what task next', () => {
    expect(detectTrackerSkill('what task should I work on next')).toBe(true);
  });

  it('skips split/merge/archive issue-id operations', () => {
    expect(detectTrackerSkill('split ABU-123 into subtasks')).toBe(false);
  });

  it('returns false for unrelated prompts', () => {
    expect(detectTrackerSkill('hello world')).toBe(false);
  });

  it('does not detect stale create flag syntax as issue-tracking intent', () => {
    expect(detectTrackerSkill('why does --design fail on create commands?')).toBe(false);
    expect(detectTrackerSkill('compare --description with --design in this API')).toBe(false);
  });
});

describe('detectBugReport', () => {
  it('detects JS stack trace', () => {
    const prompt = 'I got this error:\n  at Object.<anonymous> (/src/index.ts:42:10)';
    expect(detectBugReport(prompt)).toBe(true);
  });

  it('detects Python traceback', () => {
    const prompt = 'Traceback (most recent call last)\n  File "app.py", line 10';
    expect(detectBugReport(prompt)).toBe(true);
  });

  it('detects Go panic', () => {
    expect(detectBugReport('panic: runtime error: index out of range')).toBe(true);
  });

  it('detects JS error names', () => {
    expect(detectBugReport('TypeError: Cannot read properties of undefined')).toBe(true);
  });

  it('detects explicit error report', () => {
    expect(detectBugReport("I'm getting an error when I run the build")).toBe(true);
  });

  it('detects broken/crashing language', () => {
    expect(detectBugReport('this is broken after the last deploy')).toBe(true);
  });

  it('does not detect error discussion', () => {
    expect(detectBugReport('how does error handling work in this codebase')).toBe(false);
  });

  it('does not detect figurative broken', () => {
    expect(detectBugReport('this is broken into smaller pieces')).toBe(false);
  });

  it('does not detect unrelated prompts', () => {
    expect(detectBugReport('add a new user endpoint')).toBe(false);
  });
});

describe('detectExecutePlan', () => {
  it('detects continue', () => {
    expect(detectExecutePlan('continue')).toBe(true);
  });

  it('detects next task', () => {
    expect(detectExecutePlan('next task')).toBe(true);
  });

  it('detects keep going', () => {
    expect(detectExecutePlan('keep going')).toBe(true);
  });

  it('detects proceed', () => {
    expect(detectExecutePlan('proceed')).toBe(true);
  });

  it('does not detect ambiguous continue', () => {
    expect(detectExecutePlan('continue this discussion about APIs')).toBe(false);
  });

  it('does not detect unrelated prompts', () => {
    expect(detectExecutePlan('add a new user endpoint')).toBe(false);
  });
});

const makeStubHookLayer = (
  overrides: Partial<{
    pluginRoot: string;
    files: Record<string, string>;
    gitResponses: Record<string, string | null>;
    stdin: string;
    writtenFiles: Record<string, string>;
    removedFiles: string[];
    gitCalls: string[];
    spawnGit: (args: readonly string[], cwd?: string) => Effect.Effect<string | null>;
    ghResponse: string;
    ghCalls: string[];
  }> = {},
) => {
  const {
    pluginRoot = '/test',
    files = {},
    gitResponses = {},
    stdin = '',
    writtenFiles = {},
    removedFiles = [],
    gitCalls = [],
    spawnGit,
    ghResponse,
    ghCalls = [],
  } = overrides;

  const prLayer = Layer.succeed(PrService)({
    fileExists: () => Effect.succeed(false),
    readFile: () => Effect.fail(new Error('no file')),
    readStdin: () => Effect.succeed(''),
    gitRoot: () => Effect.succeed('/repo'),
    spawnGh: (args) => {
      ghCalls.push(args.join(' '));
      return ghResponse == null ? Effect.fail(new Error('no gh')) : Effect.succeed(ghResponse);
    },
  });

  const hookLayer = Layer.succeed(HookService)({
    pluginRoot: () => pluginRoot,
    readFile: (path) => Effect.succeed(files[path] ?? null),
    writeFile: (path, content) => {
      writtenFiles[path] = content;
      return Effect.succeed(undefined);
    },
    removeFile: (path) => {
      removedFiles.push(path);
      return Effect.succeed(undefined);
    },
    ensureDir: () => Effect.succeed(undefined),
    readStdin: () => Effect.succeed(stdin),
    spawnGit:
      spawnGit ??
      ((args) => {
        const key = args.join(' ');
        gitCalls.push(key);
        for (const [pattern, response] of Object.entries(gitResponses)) {
          if (key.includes(pattern)) {
            return Effect.succeed(response);
          }
        }
        return Effect.succeed(null);
      }),
    spawnGitChecked: (args) => {
      const key = args.join(' ');
      gitCalls.push(key);
      for (const [pattern, response] of Object.entries(gitResponses)) {
        if (key.includes(pattern) && response != null) {
          return Effect.succeed({ kind: 'ok' as const, stdout: response });
        }
      }
      return Effect.succeed({ kind: 'exit-nonzero' as const });
    },
    fileExists: (path) => Effect.succeed(files[path] != null),
  });

  return Layer.mergeAll(hookLayer, prLayer);
};

const trackerCacheFile = (cache: Record<string, unknown>) => ({
  [trackerCachePath('/test')]: JSON.stringify(cache),
});

const trackerCache = (timestamp = Date.now()) => ({
  version: 1,
  timestamp,
  epics: {
    'ABU-15': {
      id: 'ABU-15',
      title: 'Cape V2',
      status: 'In Progress',
      gitBranchName: 'abu-15-cape-v2',
      tasks: [
        {
          id: 'ABU-16',
          title: 'Tracker seam',
          status: 'Done',
          stateType: 'completed',
        },
        {
          id: 'ABU-17',
          title: 'Session banner',
          status: 'Todo',
          stateType: 'unstarted',
        },
      ],
    },
  },
});

describe('sessionStart', () => {
  it('outputs SKILL.md content when present', async () => {
    const layer = makeStubHookLayer({
      files: { '/test/skills/don-cape/SKILL.md': 'test skill content' },
    });
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('test skill content');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('outputs the unslop skill after don-cape', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'routing',
        '/test/skills/unslop/SKILL.md': 'UNSLOP-BODY',
      },
    });
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('skills/unslop/SKILL.md');
    expect(result.additionalContext).toContain('routing');
    expect(result.additionalContext.indexOf('UNSLOP-BODY')).toBeGreaterThan(
      result.additionalContext.indexOf('routing'),
    );
  });

  it('outputs fallback when SKILL.md missing', async () => {
    const layer = makeStubHookLayer();
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape plugin loaded.');
  });

  it('derives the banner from the branch matched against a cached epic gitBranchName', async () => {
    const gitCalls: string[] = [];
    const ghCalls: string[] = [];
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git/worktrees/abu-15\n/repo/.git',
      },
      gitCalls,
      ghCalls,
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toMatch(/^Render this cape session banner verbatim/);
    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
    expect(result.additionalContext).toContain('| Phase  build  (1/2 tasks done)');
    expect(result.additionalContext).toContain('| Next   ABU-17 - Session banner');
    expect(result.additionalContext).toContain('| Branch feat/abu-15-cape-v2 (worktree)');
    expect(result.additionalContext).not.toContain('stale');
    expect(ghCalls).toEqual([]);
    expect(gitCalls).toContain('rev-parse --git-dir --git-common-dir');
    expect(result.additionalContext.indexOf('| Epic   ABU-15')).toBeLessThan(
      result.additionalContext.indexOf('skills/don-cape/SKILL.md'),
    );
  });

  it('matches an exact branch with no conventional-commit prefix', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
  });

  it('matches a sanitized worktree branch against a slashed Linear slug', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].gitBranchName = 'sqve/abu-15-cape-v2';
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'feat/sqve-abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
  });

  it('matches a raw checkout of a slashed Linear slug', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].gitBranchName = 'sqve/abu-15-cape-v2';
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'sqve/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
  });

  it('matches the branch case-insensitively', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'Feat/ABU-15-Cape-V2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
  });

  it('does not label the main git tree as a worktree', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Branch feat/abu-15-cape-v2');
    expect(result.additionalContext).not.toContain('| Branch feat/abu-15-cape-v2 (worktree)');
  });

  it('omits the banner when the branch matches no cached epic', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'feat/unrelated-work',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).not.toContain('+-- cape');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('omits the banner when git reports no branch', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache()),
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).not.toContain('+-- cape');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('omits the banner when the tracker cache is empty', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile({ version: 1, timestamp: Date.now(), epics: {} }),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).not.toContain('+-- cape');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('omits the banner when the tracker cache JSON is corrupt', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        [trackerCachePath('/test')]: 'corrupted{{{',
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).not.toContain('+-- cape');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('renders the banner with a stale marker when the tracker cache is past its TTL', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(trackerCache(Date.now() - TRACKER_CACHE_TTL_MS - 1)),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('+-- cape');
    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
    expect(result.additionalContext).toContain('stale');
    expect(result.additionalContext).toContain('updated 30m ago');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('omits the banner when the matched epic is already done', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].status = 'Done';
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).not.toContain('+-- cape');
  });

  it('stays in the build phase without spawning gh when the epic has no tasks yet', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].tasks = [];
    const ghCalls: string[] = [];
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
      ghCalls,
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Phase  build  (0/0 tasks done)');
    expect(ghCalls).toEqual([]);
  });

  it('derives the ship phase when no ready task remains and no PR is open', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].tasks = [
      {
        id: 'ABU-16',
        title: 'Tracker seam',
        status: 'Done',
        stateType: 'completed',
      },
    ];
    const ghCalls: string[] = [];
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
      ghCalls,
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Next   None');
    expect(result.additionalContext).toContain('| Phase  ship  (1/1 tasks done)');
    expect(ghCalls).toEqual(['pr view --json state']);
  });

  it('derives the pr phase when no ready task remains and a PR is open', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].tasks = [
      {
        id: 'ABU-16',
        title: 'Tracker seam',
        status: 'Done',
        stateType: 'completed',
      },
    ];
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
      ghResponse: JSON.stringify({ state: 'OPEN' }),
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Phase  pr  (1/1 tasks done)');
  });

  it('derives the ship phase when gh reports only a closed PR', async () => {
    const cache = trackerCache();
    cache.epics['ABU-15'].tasks = [
      {
        id: 'ABU-16',
        title: 'Tracker seam',
        status: 'Done',
        stateType: 'completed',
      },
    ];
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...trackerCacheFile(cache),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15-cape-v2',
        'rev-parse --git-dir --git-common-dir': '/repo/.git\n/repo/.git',
      },
      ghResponse: JSON.stringify({ state: 'MERGED' }),
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Phase  ship  (1/1 tasks done)');
  });
});

describe('userPromptSubmit', () => {
  it('approves empty prompt', async () => {
    const layer = makeStubHookLayer({ stdin: JSON.stringify({ prompt: '' }) });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });

  it('approves when prompt field missing', async () => {
    const layer = makeStubHookLayer({ stdin: JSON.stringify({}) });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });

  it('approves on invalid JSON', async () => {
    const layer = makeStubHookLayer({ stdin: 'not json' });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });

  it('injects tracker skill for issue-tracker mention', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show the issue tracker' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.decision).toBe('approve');
    expect(result.additionalContext).toContain('cape:tracker');
  });

  it('approves with no context when nothing matches', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });

  it('injects fix-bug for stack trace', async () => {
    const prompt = 'Error:\n  at Object.<anonymous> (/src/index.ts:42:10)';
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape:fix-bug');
  });

  it('injects execute-plan for continue', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'continue' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape:execute-plan');
  });

  it('does not inject fix-bug for error discussion', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'how does error handling work' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });

  it('does not inject execute-plan for ambiguous continue', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'continue this discussion about APIs' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });
});

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (hookLayer = makeStubHookLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubHerdrLayer,
    stubGitLayer,
    stubCommitLayer,
    stubPrLayer,
    stubValidateLayer,
    hookLayer,
  );

describe('hook command wiring', () => {
  it('handles session-start event', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'session-start']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('cape plugin loaded.');
    console_.restore();
  });

  it('handles SessionStart PascalCase', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'SessionStart']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('cape plugin loaded.');
    console_.restore();
  });

  it('handles user-prompt-submit with tracker detection', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show the issue tracker' }),
    });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'user-prompt-submit']).pipe(Effect.provide(makeCommandLayers(hookLayer))),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.decision).toBe('approve');
    expect(result.additionalContext).toContain('cape:tracker');
    console_.restore();
  });

  it('outputs approve-only for pass-through on user-prompt-submit', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
    });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'user-prompt-submit']).pipe(Effect.provide(makeCommandLayers(hookLayer))),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result).toEqual({ decision: 'approve' });
    console_.restore();
  });
});

const bashStdin = (command: string, cwd?: string) =>
  JSON.stringify({ ...(cwd != null ? { cwd } : {}), tool_input: { command } });

const expectDeny = (result: unknown, reasonSubstring: string) => {
  const r = result as {
    hookSpecificOutput: {
      permissionDecision: string;
      permissionDecisionReason: string;
    };
  };
  expect(r.hookSpecificOutput.permissionDecision).toBe('deny');
  expect(r.hookSpecificOutput.permissionDecisionReason).toContain(reasonSubstring);
};

describe('denyWith', () => {
  it('produces correct protocol envelope', () => {
    const result = denyWith('test reason');
    expect(result).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: 'test reason',
      },
    });
  });
});

describe('stripQuotedContent', () => {
  it('removes double-quoted strings', () => {
    expect(stripQuotedContent('echo "hello world"')).toBe('echo ""');
  });

  it('removes single-quoted strings', () => {
    expect(stripQuotedContent("echo 'hello world'")).toBe("echo ''");
  });

  it('removes heredoc bodies', () => {
    const command = 'cat <<EOF\nbr create inside heredoc\nEOF';
    const stripped = stripQuotedContent(command);
    expect(stripped).not.toContain('br create');
  });

  it('removes heredoc with quoted delimiter', () => {
    const command = "cat <<'EOF'\nbr close inside heredoc\nEOF";
    const stripped = stripQuotedContent(command);
    expect(stripped).not.toContain('br close');
  });

  it('preserves unquoted command tokens', () => {
    expect(stripQuotedContent('git commit -m "message"')).toBe('git commit -m ""');
  });

  it('handles mixed quoted and unquoted content', () => {
    const command = 'br update foo --description "## Goal\nbr create inside desc"';
    const stripped = stripQuotedContent(command);
    expect(stripped).toContain('br update');
    expect(stripped).not.toContain('br create');
  });

  it('handles empty string', () => {
    expect(stripQuotedContent('')).toBe('');
  });

  it('handles command with no quotes', () => {
    expect(stripQuotedContent('git status')).toBe('git status');
  });
});

describe('denyTable', () => {
  it('is a readonly array of pattern/message/tier objects', () => {
    for (const entry of denyTable) {
      expect(entry.pattern).toBeInstanceOf(RegExp);
      expect(typeof entry.message).toBe('string');
      expect(['redirect', 'block']).toContain(entry.tier);
    }
  });

  it('has block entries before redirect entries', () => {
    const firstRedirect = denyTable.findIndex((e) => e.tier === 'redirect');
    const lastBlock = denyTable.reduce((acc, e, i) => (e.tier === 'block' ? i : acc), -1);
    expect(lastBlock).toBeLessThan(firstRedirect);
  });
});

describe('preToolUseBash', () => {
  it('passes through non-matching commands', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('passes through on empty command', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('') });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('passes through on invalid JSON', async () => {
    const layer = makeStubHookLayer({ stdin: 'not json' });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  describe('redirect tier', () => {
    it('denies raw git commit', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git commit -m "feat: add"') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape commit');
    });

    it('denies raw gh pr create', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('gh pr create --title "feat"') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape pr create');
    });

    it('passes through cape pr create', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('cape pr create --title "feat"') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('denies raw git checkout -b', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git checkout -b feat/new') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape git create-branch');
    });

    it('denies raw git switch -c', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git switch -c feat/new') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape git create-branch');
    });

    it('denies raw git branch <name>', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git branch feat/new') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape git create-branch');
    });
  });

  describe('block tier', () => {
    it('blocks gh pr merge', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('gh pr merge 42') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'merge');
    });

    it('blocks gh pr close', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('gh pr close 42') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'close');
    });

    it('blocks git commit --amend', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git commit --amend') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'amend');
    });
  });

  describe('push branch check', () => {
    it('denies push from default branch', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('git push origin main', '/work/repo'),
        spawnGit: (args, cwd) => {
          expect(cwd).toBe('/work/repo');
          const key = args.join(' ');
          return Effect.succeed(key.includes('rev-parse') ? 'main' : 'refs/remotes/origin/main');
        },
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'Push from `main` is blocked');
    });

    it('allows push from payload cwd feature branch when process cwd is default branch', async () => {
      const gitCalls: Array<{ args: string; cwd: string | undefined }> = [];
      const layer = makeStubHookLayer({
        stdin: bashStdin('git push origin feature/x', '/work/repo'),
        spawnGit: (args, cwd) => {
          gitCalls.push({ args: args.join(' '), cwd });
          const key = args.join(' ');
          if (key.includes('rev-parse')) {
            return Effect.succeed(cwd == null ? 'main' : 'feature/x');
          }
          return Effect.succeed('refs/remotes/origin/main');
        },
      });

      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));

      expect(result).toBeNull();
      expect(gitCalls).toEqual([
        { args: 'rev-parse --abbrev-ref HEAD', cwd: '/work/repo' },
        { args: 'symbolic-ref refs/remotes/origin/HEAD', cwd: '/work/repo' },
      ]);
    });

    it('treats an empty payload cwd as missing and falls back to the process cwd', async () => {
      const seenCwds: Array<string | undefined> = [];
      const layer = makeStubHookLayer({
        stdin: bashStdin('git push origin main', ''),
        spawnGit: (args, cwd) => {
          seenCwds.push(cwd);
          const key = args.join(' ');
          return Effect.succeed(key.includes('rev-parse') ? 'main' : 'refs/remotes/origin/main');
        },
      });

      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));

      expectDeny(result, 'Push from `main` is blocked');
      expect(seenCwds).toEqual([undefined, undefined]);
    });

    it('allows push from feature branch', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('git push origin feat/foo'),
        gitResponses: {
          'rev-parse': 'feat/foo',
          'symbolic-ref': 'refs/remotes/origin/main',
        },
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('pass-through', () => {
    it('allows read-only br commands', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('br show cape-abc') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows br list', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('br list') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows br update without --status', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('br update cape-abc --description "new"'),
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows git status', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git status') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows npm install', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('npm install') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows git branch -d (deletion)', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git branch -d old-branch') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('stripQuotedContent integration', () => {
    it('does not false-positive on br create inside double quotes', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('echo "br create should not trigger"'),
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not false-positive on br create inside single quotes', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin("echo 'br create should not trigger'"),
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not false-positive on denied patterns inside heredocs', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('cat <<EOF\nbr create inside heredoc\ngit commit too\nEOF'),
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });
});

describe('hook command - PreToolUse wiring', () => {
  it('routes pre-tool-use --matcher Bash to deny table', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('git commit -m "feat: test"'),
    });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    console_.restore();
  });

  it('produces no output for pass-through commands', async () => {
    const hookLayer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(console_.output()).toHaveLength(0);
    console_.restore();
  });

  it('warns on stderr for unknown PreToolUse matcher', async () => {
    const hookLayer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Unknown']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(console_.output()).toHaveLength(0);
    expect(console_.errorOutput()).toContain('Unknown');
    expect(console_.errorOutput()).toContain('PreToolUse');
    expect(console_.errorOutput()).not.toContain('—');
    console_.restore();
  });

  it('accepts PascalCase PreToolUse event name', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('git commit -m "feat: test"'),
    });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'PreToolUse', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    console_.restore();
  });
});

describe('hook command - PostToolUse wiring', () => {
  it('accepts PascalCase PostToolUse event name', async () => {
    const hookLayer = makeStubHookLayer();
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'PostToolUse', '--matcher', 'linear-write']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result.hookSpecificOutput.additionalContext).toContain('cape tracker');
    console_.restore();
  });

  it('routes post-tool-use --matcher linear-write with tracker refresh context', async () => {
    const hookLayer = makeStubHookLayer();
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'linear-write']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.additionalContext).toContain('cape tracker');
    expect(result.hookSpecificOutput).not.toHaveProperty('permissionDecision');
    expect(result).not.toHaveProperty('decision');
    console_.restore();
  });

  it('warns on stderr for unknown PostToolUse matcher', async () => {
    const hookLayer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'Unknown']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(console_.output()).toHaveLength(0);
    expect(console_.errorOutput()).toContain('Unknown');
    expect(console_.errorOutput()).toContain('PostToolUse');
    expect(console_.errorOutput()).not.toContain('—');
    console_.restore();
  });
});
