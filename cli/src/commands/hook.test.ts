import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import {
  HookService,
  deriveFlowContext,
  detectBeadsSkill,
  normalizeEventName,
  sessionStart,
  userPromptSubmit,
} from '../services/hook';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
} from '../testStubs';

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

describe('detectBeadsSkill', () => {
  it('detects br keyword', () => {
    expect(detectBeadsSkill('show br issues')).toBe(true);
  });

  it('detects beads keyword', () => {
    expect(detectBeadsSkill('create a bead')).toBe(true);
  });

  it('detects issue tracking phrases', () => {
    expect(detectBeadsSkill('track this bug')).toBe(true);
  });

  it('detects what task next', () => {
    expect(detectBeadsSkill('what task should I work on next')).toBe(true);
  });

  it('skips split/merge/archive br operations', () => {
    expect(detectBeadsSkill('split br-123 into subtasks')).toBe(false);
  });

  it('returns false for unrelated prompts', () => {
    expect(detectBeadsSkill('hello world')).toBe(false);
  });
});

describe('deriveFlowContext', () => {
  it('returns debugging when bugs exist', () => {
    expect(deriveFlowContext({ bugs: 'cape-bug1', inProgressTasks: null, epics: null })).toContain(
      'debugging',
    );
  });

  it('returns executing when in-progress tasks exist', () => {
    expect(deriveFlowContext({ bugs: null, inProgressTasks: 'cape-abc', epics: null })).toContain(
      'executing',
    );
  });

  it('returns planning when only epics exist', () => {
    expect(deriveFlowContext({ bugs: null, inProgressTasks: null, epics: 'cape-epic1' })).toContain(
      'planning',
    );
  });

  it('returns idle when br available but all empty', () => {
    expect(deriveFlowContext({ bugs: '', inProgressTasks: '', epics: '' })).toContain('idle');
  });

  it('returns null when br unavailable', () => {
    expect(deriveFlowContext({ bugs: null, inProgressTasks: null, epics: null })).toBeNull();
  });

  it('prioritizes debugging over executing', () => {
    const result = deriveFlowContext({
      bugs: 'cape-bug1',
      inProgressTasks: 'cape-abc',
      epics: null,
    });
    expect(result).toContain('debugging');
  });
});

const makeStubHookLayer = (
  overrides: Partial<{
    pluginRoot: string;
    files: Record<string, string>;
    brResponses: Record<string, string>;
    stdin: string;
    writtenFiles: Record<string, string>;
    removedFiles: string[];
  }> = {},
) => {
  const {
    pluginRoot = '/test',
    files = {},
    brResponses = {},
    stdin = '',
    writtenFiles = {},
    removedFiles = [],
  } = overrides;

  return Layer.succeed(HookService)({
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
    brQuery: (args) => {
      const key = args.join(' ');
      for (const [pattern, response] of Object.entries(brResponses)) {
        if (key.includes(pattern)) {
          return Effect.succeed(response);
        }
      }
      return Effect.succeed(null);
    },
    readStdin: () => Effect.succeed(stdin),
  });
};

describe('sessionStart', () => {
  it('outputs SKILL.md content when present', async () => {
    const layer = makeStubHookLayer({
      files: { '/test/skills/don-cape/SKILL.md': 'test skill content' },
    });
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('test skill content');
    expect(result.additionalContext).toContain('skills/don-cape/SKILL.md');
  });

  it('outputs fallback when SKILL.md missing', async () => {
    const layer = makeStubHookLayer();
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape plugin loaded.');
  });

  it('includes flow context when br available', async () => {
    const layer = makeStubHookLayer({
      files: { '/test/skills/don-cape/SKILL.md': 'content' },
      brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
    });
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('executing');
  });

  it('clears logs when flag is set', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({ writtenFiles, removedFiles });
    await Effect.runPromise(sessionStart(true).pipe(Effect.provide(layer)));
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('');
    expect(removedFiles).toContain('/test/hooks/context/tdd-state.json');
  });

  it('does not clear logs when flag is false', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({ writtenFiles, removedFiles });
    await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(Object.keys(writtenFiles)).toHaveLength(0);
    expect(removedFiles).toHaveLength(0);
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

  it('injects beads skill for br mention', async () => {
    const layer = makeStubHookLayer({ stdin: JSON.stringify({ prompt: 'show br issues' }) });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.decision).toBe('approve');
    expect(result.additionalContext).toContain('cape:beads');
  });

  it('injects flow context when br available', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
      brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('executing');
  });

  it('approves with no context when nothing matches', async () => {
    const layer = makeStubHookLayer({ stdin: JSON.stringify({ prompt: 'hello' }) });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result).toEqual({ decision: 'approve' });
  });

  it('combines skills and flow context', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show br issues' }),
      brResponses: { '--type epic': 'cape-epic1 epic open Build' },
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape:beads');
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('planning');
  });
});

const run = Command.runWith(main, { version: '0.1.0' });

const makeCommandLayers = (hookLayer = makeStubHookLayer()) =>
  Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubPrLayer,
    hookLayer,
  );

describe('hook command wiring', () => {
  it('handles session-start event', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'session-start']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('cape plugin loaded.');
    consoleSpy.mockRestore();
  });

  it('handles SessionStart PascalCase', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'SessionStart']).pipe(Effect.provide(makeCommandLayers())),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('cape plugin loaded.');
    consoleSpy.mockRestore();
  });

  it('clears logs with --clear-logs flag', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const hookLayer = makeStubHookLayer({ writtenFiles, removedFiles });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'session-start', '--clear-logs']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('');
    expect(removedFiles).toContain('/test/hooks/context/tdd-state.json');
    consoleSpy.mockRestore();
  });

  it('handles user-prompt-submit with beads detection', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show br issues' }),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'user-prompt-submit']).pipe(Effect.provide(makeCommandLayers(hookLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.decision).toBe('approve');
    expect(result.additionalContext).toContain('cape:beads');
    consoleSpy.mockRestore();
  });

  it('outputs approve-only for pass-through on user-prompt-submit', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'user-prompt-submit']).pipe(Effect.provide(makeCommandLayers(hookLayer))),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result).toEqual({ decision: 'approve' });
    consoleSpy.mockRestore();
  });
});
