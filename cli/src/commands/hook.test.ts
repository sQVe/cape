import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logEvent } from '../eventLog';
import { main } from '../main';
import {
  FLOW_PHASE_TTL_MS,
  HookService,
  denyTable,
  denyWith,
  detectBugReport,
  detectExecutePlan,
  detectTrackerSkill,
  normalizeEventName,
  preToolUseBash,
  preToolUseSkill,
  sessionStart,
  stripQuotedContent,
  userPromptSubmit,
} from '../services/hook';
import { TRACKER_CACHE_TTL_MS } from '../services/tracker';
import {
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubConformLayer,
  stubValidateLayer,
  stubHerdrLayer,
} from '../testStubs';
import { spyConsole } from '../testUtils';

vi.mock('../eventLog', () => ({
  logEvent: vi.fn(),
}));

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
  } = overrides;

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
    spawnGit: (args) => {
      const key = args.join(' ');
      gitCalls.push(key);
      for (const [pattern, response] of Object.entries(gitResponses)) {
        if (key.includes(pattern)) {
          return Effect.succeed(response);
        }
      }
      return Effect.succeed(null);
    },
    fileExists: (path) => Effect.succeed(files[path] != null),
  });

  return hookLayer;
};

const flowPhaseEntry = (phase: string) => ({
  phase,
  issueId: 'cape-abc',
  timestamp: Date.now(),
});

const flowPhaseEntryForIssue = (phase: string, issueId: string) => ({
  phase,
  issueId,
  timestamp: Date.now(),
});

const stateFile = (entries: Record<string, unknown>) => ({
  '/test/hooks/context/state.json': JSON.stringify(entries),
});

const reviewedAtEntry = (timestamp = Date.now()) => ({
  scope: 'branch',
  timestamp,
});

const flowPhaseFile = (phase: string) => stateFile({ flowPhase: flowPhaseEntry(phase) });

const trackerCacheFile = (cache: Record<string, unknown>) => ({
  '/test/hooks/context/tracker.json': JSON.stringify(cache),
});

const trackerCache = (timestamp = Date.now()) => ({
  version: 1,
  timestamp,
  epics: {
    'ABU-15': {
      id: 'ABU-15',
      title: 'Cape V2',
      status: 'In Progress',
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

const task = (id: string, status: string, stateType: string, title = 'Task') => ({
  id,
  title,
  status,
  stateType,
});

const epic = (id: string, tasks: readonly ReturnType<typeof task>[], title = 'My Epic') => ({
  id,
  title,
  status: 'In Progress',
  tasks,
});

const trackerGateFiles = (
  epics: Record<string, ReturnType<typeof epic>>,
  activeEpicId = 'cape-1',
) => ({
  ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', activeEpicId) }),
  ...trackerCacheFile({ version: 1, timestamp: Date.now(), epics }),
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

  it('outputs fallback when SKILL.md missing', async () => {
    const layer = makeStubHookLayer();
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape plugin loaded.');
  });

  it('includes flow context when flowPhase exists in state', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...flowPhaseFile('executing'),
      },
    });
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('executing');
  });

  it('removes legacy tddState key from state.json', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      writtenFiles,
      removedFiles,
      files: stateFile({ tddState: { phase: 'red', timestamp: Date.now() } }),
    });
    await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(removedFiles).toContain('/test/hooks/context/state.json');
  });

  it('preserves flowPhase while removing legacy tddState', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      writtenFiles,
      removedFiles,
      files: stateFile({
        tddState: { phase: 'red', timestamp: Date.now() },
        flowPhase: flowPhaseEntry('executing'),
      }),
    });
    await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    const written = writtenFiles['/test/hooks/context/state.json'];
    expect(written).toBeDefined();
    const parsed = JSON.parse(written as string);
    expect(parsed).not.toHaveProperty('tddState');
    expect(parsed).toHaveProperty('flowPhase');
  });

  it('injects an active epic banner from the tracker cache as the first context', async () => {
    const gitCalls: string[] = [];
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', 'ABU-15') }),
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15',
        'rev-parse --git-dir': '/repo/.git/worktrees/abu-15',
        'rev-parse --git-common-dir': '/repo/.git',
      },
      gitCalls,
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toMatch(/^Render this cape session banner verbatim/);
    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
    expect(result.additionalContext).toContain('| Phase  BUILD  (1/2 tasks done)');
    expect(result.additionalContext).toContain('| Next   ABU-17 - Session banner');
    expect(result.additionalContext).toContain('| Branch feat/abu-15 (worktree)');
    expect(result.additionalContext).not.toContain('stale');
    expect(gitCalls).toContain('rev-parse --git-dir');
    expect(gitCalls).toContain('rev-parse --git-common-dir');
    expect(result.additionalContext.indexOf('| Epic   ABU-15')).toBeLessThan(
      result.additionalContext.indexOf('skills/don-cape/SKILL.md'),
    );
  });

  it('does not label the main git tree as a worktree', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', 'ABU-15') }),
        ...trackerCacheFile(trackerCache()),
      },
      gitResponses: {
        'branch --show-current': 'feat/abu-15',
        'rev-parse --git-dir': '/repo/.git',
        'rev-parse --git-common-dir': '/repo/.git',
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Branch feat/abu-15');
    expect(result.additionalContext).not.toContain('| Branch feat/abu-15 (worktree)');
  });

  it('omits the banner when no active epic exists in flowPhase', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...stateFile({ flowPhase: { phase: 'BUILD', timestamp: Date.now() } }),
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
        ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', 'ABU-15') }),
        ...trackerCacheFile({ version: 1, timestamp: Date.now(), epics: {} }),
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
        ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', 'ABU-15') }),
        '/test/hooks/context/tracker.json': 'corrupted{{{',
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
        ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', 'ABU-15') }),
        ...trackerCacheFile(trackerCache(Date.now() - TRACKER_CACHE_TTL_MS - 1)),
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('+-- cape');
    expect(result.additionalContext).toContain('| Epic   ABU-15  Cape V2');
    expect(result.additionalContext).toContain('stale');
    expect(result.additionalContext).toContain('updated 30m ago');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('renders a no-ready-tasks banner when the active epic has no ready task', async () => {
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
        ...stateFile({ flowPhase: flowPhaseEntryForIssue('BUILD', 'ABU-15') }),
        ...trackerCacheFile(cache),
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).toContain('| Next   None');
    expect(result.additionalContext).toContain('| Phase  BUILD  (1/1 tasks done)');
  });

  it('omits the banner when flowPhase is expired even if the tracker cache is present', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...stateFile({
          flowPhase: {
            phase: 'BUILD',
            issueId: 'ABU-15',
            timestamp: Date.now() - FLOW_PHASE_TTL_MS - 1,
          },
        }),
        ...trackerCacheFile(trackerCache()),
      },
    });

    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));

    expect(result.additionalContext).not.toContain('+-- cape');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
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

  it('injects flow context when flowPhase exists in state', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
      files: flowPhaseFile('executing'),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('executing');
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

  it('combines skills and flow context', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show the issue tracker' }),
      files: flowPhaseFile('planning'),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape:tracker');
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('planning');
  });
});

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (hookLayer = makeStubHookLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubHerdrLayer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubPrLayer,
    stubValidateLayer,
    stubConformLayer,
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

const bashStdin = (command: string) => JSON.stringify({ tool_input: { command } });

const skillStdin = (skill: string, args?: string) =>
  JSON.stringify({ tool_input: { skill, ...(args != null ? { args } : {}) } });

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
      expect(['redirect', 'block', 'warn']).toContain(entry.tier);
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
    it('blocks git push --force', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git push --force origin main') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'Force push');
    });

    it('blocks git push -f', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git push -f origin main') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'Force push');
    });

    it('allows git push --force-with-lease', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('git push --force-with-lease origin feat'),
        gitResponses: { 'rev-parse': 'feat', 'symbolic-ref': 'refs/remotes/origin/main' },
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

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

  describe('warn tier', () => {
    it('warns on git reset --hard', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git reset --hard HEAD~1') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('reset --hard');
    });

    it('warns on git checkout --', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git checkout -- src/foo.ts') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('checkout --');
    });

    it('warns on git clean -f', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('git clean -f') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('clean -f');
    });
  });

  describe('push branch check', () => {
    it('denies push from default branch', async () => {
      const layer = makeStubHookLayer({
        stdin: bashStdin('git push origin main'),
        gitResponses: {
          'rev-parse': 'main',
          'symbolic-ref': 'refs/remotes/origin/main',
        },
      });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'Push from `main` is blocked');
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

describe('preToolUseSkill', () => {
  it.each([
    'cape:commit',
    'cape:review',
    'cape:tracker',
    'cape:worktree',
    'cape:brainstorm',
    'cape:write-plan',
  ])('allows non-gated skill %s', async (skill) => {
    const layer = makeStubHookLayer({ stdin: skillStdin(skill) });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('denies pr when review has not stamped state', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:pr'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'review-before-pr');
    expectDeny(result, 'CAPE_HARD_GATE_OVERRIDE');
  });

  it('denies pr when review stamp is stale', async () => {
    const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000;
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:pr'),
      files: stateFile({ reviewedAt: reviewedAtEntry(staleTimestamp) }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'stale');
  });

  it('allows pr when review stamp is fresh', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:pr'),
      files: stateFile({ reviewedAt: reviewedAtEntry() }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('downgrades pr review gate to warning when explicit override is present', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:pr', 'CAPE_HARD_GATE_OVERRIDE'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('review-before-pr override accepted'),
    });
    const context = (result as { additionalContext: string }).additionalContext;
    expect(context).toContain('proceeding');
    expect(context).not.toContain('Run cape:review');
    expect(context).not.toContain('blocked');
  });

  it('downgrades pr review gate to warning when orchestrate marker is present', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:pr', 'CAPE_ORCHESTRATE'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining(
        'review-before-pr override accepted (orchestrate)',
      ),
    });
    const context = (result as { additionalContext: string }).additionalContext;
    expect(context).toContain('proceeding');
    expect(context).not.toContain('Run cape:review');
    expect(context).not.toContain('blocked');
  });

  it('passes through on invalid JSON', async () => {
    const layer = makeStubHookLayer({ stdin: 'not json' });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('passes through when skill field is missing', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ tool_input: { command: 'echo' } }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('passes through when tool_input is missing', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ other: 'data' }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('adds context for execute-plan when no open epic exists', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      files: trackerGateFiles({}),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('brainstorm'),
    });
  });

  it('adds context for execute-plan when epic exists but no ready tasks', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      files: trackerGateFiles({
        'cape-1': epic('cape-1', [task('cape-1.1', 'In Progress', 'started')]),
      }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('ready'),
    });
  });

  it('allows execute-plan when epic and ready tasks exist', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      files: trackerGateFiles({
        'cape-1': epic('cape-1', [task('cape-1.1', 'Todo', 'unstarted')]),
      }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('adds context for finish-epic when open tasks remain', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic'),
      files: trackerGateFiles({
        'cape-1': epic('cape-1', [
          task('cape-1.1', 'Done', 'completed'),
          task('cape-1.2', 'Todo', 'unstarted'),
          task('cape-1.3', 'In Progress', 'started'),
        ]),
      }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('open task'),
    });
  });

  it('allows finish-epic when all tasks closed', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic'),
      files: trackerGateFiles({
        'cape-1': epic('cape-1', [
          task('cape-1.1', 'Done', 'completed'),
          task('cape-1.2', 'Closed', 'completed'),
          task('cape-1.3', 'Completed', 'completed'),
        ]),
      }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows finish-epic for target epic when other epics have open tasks', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic', 'cape-target'),
      files: trackerGateFiles(
        {
          'cape-other': epic('cape-other', [
            task('cape-other.1', 'Todo', 'unstarted'),
            task('cape-other.2', 'Done', 'completed'),
          ]),
          'cape-target': epic('cape-target', [task('cape-target.1', 'Done', 'completed')]),
        },
        'cape-target',
      ),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('adds context for target epic when it has open tasks', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic', 'cape-target'),
      files: trackerGateFiles(
        {
          'cape-other': epic('cape-other', [task('cape-other.1', 'Done', 'completed')]),
          'cape-target': epic('cape-target', [
            task('cape-target.1', 'Done', 'completed'),
            task('cape-target.2', 'Todo', 'unstarted'),
          ]),
        },
        'cape-target',
      ),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('cape-target'),
    });
  });

  it('adds diagnosis gate context for fix-bug', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:fix-bug'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('diagnosis gate'),
    });
  });

  it('returns additionalContext when on default branch with open epic and ready tasks', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      files: trackerGateFiles({
        'cape-1': epic('cape-1', [task('cape-1.1', 'Todo', 'unstarted')]),
      }),
      gitResponses: {
        'rev-parse': 'main',
        'symbolic-ref': 'refs/remotes/origin/main',
      },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toHaveProperty('additionalContext');
    expect((result as unknown as { additionalContext: string }).additionalContext).toContain(
      'branch',
    );
  });

  it('allows execute-plan on a feature branch with open epic and ready tasks', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      files: trackerGateFiles({
        'cape-1': epic('cape-1', [task('cape-1.1', 'Todo', 'unstarted')]),
      }),
      gitResponses: {
        'rev-parse': 'feat/my-feature',
        'symbolic-ref': 'refs/remotes/origin/main',
      },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows execute-plan when tracker cache is unreadable', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:execute-plan') });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows finish-epic when tracker cache is unreadable', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:finish-epic') });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('adds context for test-driven-development when no workflow is active', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:test-driven-development'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toEqual({
      additionalContext: expect.stringContaining('internal'),
    });
  });

  it('allows test-driven-development when workflow is active', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:test-driven-development'),
      files: stateFile({ workflowActive: { value: true, timestamp: Date.now() } }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
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

  it('routes pre-tool-use --matcher Skill to flow-gate', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      files: trackerGateFiles({}),
    });
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Skill']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = console_.output();
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('brainstorm');
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

describe('readFlowPhase', () => {
  it('returns null when flowPhase is older than 30 minutes', async () => {
    const staleTimestamp = Date.now() - 31 * 60 * 1000;
    const layer = makeStubHookLayer({
      files: stateFile({
        flowPhase: { phase: 'executing', issueId: 'cape-abc', timestamp: staleTimestamp },
      }),
    });
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).not.toContain('<flow-context>');
  });

  it('returns null when state.json contains malformed JSON', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/hooks/context/state.json': 'corrupted{{{',
      },
    });
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).not.toContain('<flow-context>');
  });

  it('returns null when flowPhase is missing phase field', async () => {
    const layer = makeStubHookLayer({
      files: stateFile({
        flowPhase: { issueId: 'cape-abc', timestamp: Date.now() },
      }),
    });
    const result = await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(result.additionalContext).not.toContain('<flow-context>');
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
    console_.restore();
  });
});

describe('event logging', () => {
  beforeEach(() => {
    vi.mocked(logEvent).mockClear();
  });

  it('logs deny event for preToolUseBash deny table match', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('git commit -m "feat: test"') });
    await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith(
      'hook.PreToolUse.Bash',
      expect.stringContaining('cape commit'),
    );
  });

  it('logs inject event for preToolUseBash warn tier', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('git reset --hard HEAD') });
    await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith('hook.PreToolUse.Bash', 'inject');
  });

  it('does not log for preToolUseBash pass-through', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('logs deny event for preToolUseSkill gate denial', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:pr'),
    });
    await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith(
      'hook.PreToolUse.Skill',
      expect.stringContaining('review-before-pr'),
    );
  });

  it('does not log for preToolUseSkill pass-through', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:commit') });
    await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('logs inject event for userPromptSubmit skill detection', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show the issue tracker' }),
    });
    await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith(
      'hook.UserPromptSubmit',
      expect.stringContaining('cape:tracker'),
    );
  });

  it('logs flow-context for userPromptSubmit when only flow context injected', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
      files: flowPhaseFile('executing'),
    });
    await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith('hook.UserPromptSubmit', 'flow-context');
  });

  it('does not log for userPromptSubmit pass-through', async () => {
    const layer = makeStubHookLayer({ stdin: JSON.stringify({ prompt: 'hello' }) });
    await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does not log for sessionStart', async () => {
    const layer = makeStubHookLayer();
    await Effect.runPromise(sessionStart().pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });
});
