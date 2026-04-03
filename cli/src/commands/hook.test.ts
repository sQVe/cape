import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { logEvent } from '../eventLog';
import { main } from '../main';

import {
  HookService,
  denyTable,
  denyWith,
  detectBeadsSkill,
  detectDebugIssue,
  detectExecutePlan,
  isCodeFile,
  isTestFile,
  normalizeEventName,
  postToolUseBash,
  postToolUseEdit,
  postToolUseWrite,
  preToolUseBash,
  preToolUseEdit,
  preToolUseSkill,
  preToolUseWrite,
  sessionStart,
  stripQuotedContent,
  userPromptSubmit,
} from '../services/hook';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubTestLayer,
  stubConformLayer,
  stubValidateLayer,
} from '../testStubs';

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

describe('detectDebugIssue', () => {
  it('detects JS stack trace', () => {
    const prompt = 'I got this error:\n  at Object.<anonymous> (/src/index.ts:42:10)';
    expect(detectDebugIssue(prompt)).toBe(true);
  });

  it('detects Python traceback', () => {
    const prompt = 'Traceback (most recent call last)\n  File "app.py", line 10';
    expect(detectDebugIssue(prompt)).toBe(true);
  });

  it('detects Go panic', () => {
    expect(detectDebugIssue('panic: runtime error: index out of range')).toBe(true);
  });

  it('detects JS error names', () => {
    expect(detectDebugIssue('TypeError: Cannot read properties of undefined')).toBe(true);
  });

  it('detects explicit error report', () => {
    expect(detectDebugIssue("I'm getting an error when I run the build")).toBe(true);
  });

  it('detects broken/crashing language', () => {
    expect(detectDebugIssue('this is broken after the last deploy')).toBe(true);
  });

  it('does not detect error discussion', () => {
    expect(detectDebugIssue('how does error handling work in this codebase')).toBe(false);
  });

  it('does not detect figurative broken', () => {
    expect(detectDebugIssue('this is broken into smaller pieces')).toBe(false);
  });

  it('does not detect unrelated prompts', () => {
    expect(detectDebugIssue('add a new user endpoint')).toBe(false);
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
    brResponses: Record<string, string>;
    gitResponses: Record<string, string | null>;
    stdin: string;
    writtenFiles: Record<string, string>;
    removedFiles: string[];
  }> = {},
) => {
  const {
    pluginRoot = '/test',
    files = {},
    brResponses = {},
    gitResponses = {},
    stdin = '',
    writtenFiles = {},
    removedFiles = [],
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
    spawnGit: (args) => {
      const key = args.join(' ');
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

const tddEntry = (phase: string) => ({
  phase,
  timestamp: Date.now(),
});

const stateFile = (entries: Record<string, unknown>) => ({
  '/test/hooks/context/state.json': JSON.stringify(entries),
});

const flowPhaseFile = (phase: string) =>
  stateFile({ flowPhase: flowPhaseEntry(phase) });

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

  it('includes flow context when flowPhase exists in state', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/skills/don-cape/SKILL.md': 'content',
        ...flowPhaseFile('executing'),
      },
    });
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('<flow-context>');
    expect(result.additionalContext).toContain('executing');
  });

  it('clears logs when flag is set', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      writtenFiles,
      removedFiles,
      files: stateFile({ tddState: tddEntry('red') }),
    });
    await Effect.runPromise(sessionStart(true).pipe(Effect.provide(layer)));
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('');
    expect(removedFiles).toContain('/test/hooks/context/state.json');
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
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show br issues' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.decision).toBe('approve');
    expect(result.additionalContext).toContain('cape:beads');
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

  it('injects debug-issue for stack trace', async () => {
    const prompt = 'Error:\n  at Object.<anonymous> (/src/index.ts:42:10)';
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape:debug-issue');
  });

  it('injects execute-plan for continue', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'continue' }),
    });
    const result = await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(result.additionalContext).toContain('cape:execute-plan');
  });

  it('does not inject debug-issue for error discussion', async () => {
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
      stdin: JSON.stringify({ prompt: 'show br issues' }),
      files: flowPhaseFile('planning'),
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
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
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
    const hookLayer = makeStubHookLayer({
      writtenFiles,
      removedFiles,
      files: stateFile({ tddState: tddEntry('red') }),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'session-start', '--clear-logs']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('');
    expect(removedFiles).toContain('/test/hooks/context/state.json');
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
    const lastBlock = denyTable.reduce(
      (acc, e, i) => (e.tier === 'block' ? i : acc),
      -1,
    );
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

    // Re-enable as each cape command is implemented:
    // it('denies raw br create', ...)
    // it('denies raw br q', ...)
    it('denies raw br update --status', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('br update bd-test --status in_progress') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape br update');
    });

    it('passes through cape br update', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('cape br update bd-test --status in_progress') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('denies raw br close', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('br close cape-2v2.3') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape br close');
    });

    it('passes through cape br close', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('cape br close cape-2v2.3') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
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

    it('denies raw npx vitest', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('npx vitest run') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('denies raw pytest', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('pytest tests/') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('denies raw go test', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('go test ./...') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('denies raw bun test', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('bun test src/') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('denies raw cargo test', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('cargo test --workspace') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('denies raw busted', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('busted spec/') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('denies raw python -m pytest', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('python -m pytest tests/') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expectDeny(result, 'cape test');
    });

    it('passes through cape test', async () => {
      const layer = makeStubHookLayer({ stdin: bashStdin('cape test') });
      const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
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
      expectDeny(result, 'Cannot push');
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
  it.each(['cape:commit', 'cape:review', 'cape:beads', 'cape:branch', 'cape:brainstorm', 'cape:write-plan'])(
    'allows non-gated skill %s',
    async (skill) => {
      const layer = makeStubHookLayer({ stdin: skillStdin(skill) });
      const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    },
  );

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

  it('denies execute-plan when no open epic exists', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      brResponses: { '--type epic': '' },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'brainstorm');
  });

  it('denies execute-plan when epic exists but no ready tasks', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      brResponses: {
        '--type epic': 'cape-1 epic open My Epic',
        ready: '',
      },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'ready');
  });

  it('allows execute-plan when epic and ready tasks exist', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      brResponses: {
        '--type epic': 'cape-1 epic open My Epic',
        ready: 'cape-1.1 task Do something',
      },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('denies finish-epic when open tasks remain', async () => {
    const epicStatus = JSON.stringify([
      { epic: { id: 'cape-1' }, total_children: 3, closed_children: 1 },
    ]);
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic'),
      brResponses: { 'epic status': epicStatus },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'open task');
  });

  it('allows finish-epic when all tasks closed', async () => {
    const epicStatus = JSON.stringify([
      { epic: { id: 'cape-1' }, total_children: 3, closed_children: 3 },
    ]);
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic'),
      brResponses: { 'epic status': epicStatus },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows finish-epic for target epic when other epics have open tasks', async () => {
    const epicStatus = JSON.stringify([
      { epic: { id: 'cape-other' }, total_children: 10, closed_children: 6 },
      { epic: { id: 'cape-target' }, total_children: 5, closed_children: 5 },
    ]);
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic', 'cape-target'),
      brResponses: { 'epic status': epicStatus },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('denies finish-epic for target epic when it has open tasks', async () => {
    const epicStatus = JSON.stringify([
      { epic: { id: 'cape-other' }, total_children: 5, closed_children: 5 },
      { epic: { id: 'cape-target' }, total_children: 5, closed_children: 3 },
    ]);
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:finish-epic', 'cape-target'),
      brResponses: { 'epic status': epicStatus },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'cape-target');
  });

  it('denies fix-bug when no open bug exists', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:fix-bug'),
      brResponses: { '--type bug': '' },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'debug-issue');
  });

  it('allows fix-bug when open bug exists', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:fix-bug'),
      brResponses: { '--type bug': 'cape-5 Bug crash' },
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows execute-plan when br fails', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:execute-plan') });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows finish-epic when br fails', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:finish-epic') });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('allows fix-bug when br fails', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:fix-bug') });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('denies expand-task when no workflow is active', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:expand-task'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'internal');
  });

  it('allows expand-task when workflow is active', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:expand-task'),
      files: stateFile({ workflowActive: { value: true, timestamp: Date.now() } }),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('denies test-driven-development when no workflow is active', async () => {
    const layer = makeStubHookLayer({
      stdin: skillStdin('cape:test-driven-development'),
    });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expectDeny(result, 'internal');
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
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    consoleSpy.mockRestore();
  });

  it('routes pre-tool-use --matcher Skill to flow-gate', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: skillStdin('cape:execute-plan'),
      brResponses: { '--type epic': '' },
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Skill']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    consoleSpy.mockRestore();
  });

  it('produces no output for pass-through commands', async () => {
    const hookLayer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('produces no output for unknown matcher', async () => {
    const hookLayer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Unknown']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('accepts PascalCase PreToolUse event name', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('git commit -m "feat: test"'),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'PreToolUse', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    consoleSpy.mockRestore();
  });

  it('routes pre-tool-use --matcher Edit to TDD gate', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: editStdin('/src/foo.ts'),
      files: flowPhaseFile('executing'),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Edit']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    consoleSpy.mockRestore();
  });

  it('routes pre-tool-use --matcher Write to TDD gate', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: writeStdin('/src/foo.ts', 'new content'),
      files: {
        ...flowPhaseFile('executing'),
        '/src/foo.ts': 'old content',
      },
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Write']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.hookSpecificOutput.permissionDecision).toBe('deny');
    consoleSpy.mockRestore();
  });

  it('produces no output for Edit pass-through', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: editStdin('/src/foo.ts'),
      files: {
        ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('red') }),
      },
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'pre-tool-use', '--matcher', 'Edit']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    consoleSpy.mockRestore();
  });
});

describe('isTestFile', () => {
  it('detects .test.ts files', () => {
    expect(isTestFile('/src/foo.test.ts')).toBe(true);
  });

  it('detects .spec.tsx files', () => {
    expect(isTestFile('/src/foo.spec.tsx')).toBe(true);
  });

  it('detects _test.go files', () => {
    expect(isTestFile('/pkg/handler_test.go')).toBe(true);
  });

  it('detects _spec.lua files', () => {
    expect(isTestFile('/tests/parser_spec.lua')).toBe(true);
  });

  it('detects test_*.py files', () => {
    expect(isTestFile('test_foo.py')).toBe(true);
  });

  it('detects __tests__ directory', () => {
    expect(isTestFile('/src/__tests__/foo.ts')).toBe(true);
  });

  it('rejects production .ts files', () => {
    expect(isTestFile('/src/foo.ts')).toBe(false);
  });

  it('rejects production .go files', () => {
    expect(isTestFile('/pkg/handler.go')).toBe(false);
  });
});

describe('isCodeFile', () => {
  it.each(['.ts', '.tsx', '.js', '.jsx', '.go', '.py', '.rs', '.lua'])(
    'accepts %s extension',
    (ext) => {
      expect(isCodeFile(`/src/foo${ext}`)).toBe(true);
    },
  );

  it.each(['.md', '.json', '.yaml', '.toml', '.txt'])('rejects %s extension', (ext) => {
    expect(isCodeFile(`/config/file${ext}`)).toBe(false);
  });
});

const editStdin = (filePath: string) =>
  JSON.stringify({ tool_input: { file_path: filePath, old_string: 'old', new_string: 'new' } });

const writeStdin = (filePath: string, content: string) =>
  JSON.stringify({ tool_input: { file_path: filePath, content } });

const tddStateFile = (phase: string) =>
  stateFile({ tddState: tddEntry(phase) });

describe('readFlowPhase', () => {
  it('returns null when flowPhase is older than 30 minutes', async () => {
    const staleTimestamp = Date.now() - 31 * 60 * 1000;
    const layer = makeStubHookLayer({
      files: stateFile({
        flowPhase: { phase: 'executing', issueId: 'cape-abc', timestamp: staleTimestamp },
      }),
    });
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).not.toContain('<flow-context>');
  });

  it('returns null when state.json contains malformed JSON', async () => {
    const layer = makeStubHookLayer({
      files: {
        '/test/hooks/context/state.json': 'corrupted{{{',
      },
    });
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).not.toContain('<flow-context>');
  });

  it('returns null when flowPhase is missing phase field', async () => {
    const layer = makeStubHookLayer({
      files: stateFile({
        flowPhase: { issueId: 'cape-abc', timestamp: Date.now() },
      }),
    });
    const result = await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(result.additionalContext).not.toContain('<flow-context>');
  });
});

describe('preToolUseEdit', () => {
  describe('denies production code edits during active phase', () => {
    it('denies when tdd-state is null during executing phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expectDeny(result, 'failing test');
    });

    it('denies when tdd-state is null during debugging phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: flowPhaseFile('debugging'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expectDeny(result, 'failing test');
    });

    it('denies when tdd-state is writing-test during executing phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/handler.go'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expectDeny(result, 'run the test');
    });
  });

  describe('allows edits on red and green states', () => {
    it('allows when tdd-state is red', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: {
          ...flowPhaseFile('executing'),
          ...tddStateFile('red'),
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows when tdd-state is green', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('green') }),
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('allows test file edits regardless of TDD state', () => {
    it('allows .test.ts file when tdd-state is null', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.test.ts'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows _test.go file when tdd-state is writing-test', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/pkg/handler_test.go'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('allows non-code files', () => {
    it('allows .md files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/README.md'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows .json files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/package.json'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('allows outside active phase', () => {
    it('allows when no flow phase exists', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows during planning phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: flowPhaseFile('planning'),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('auto-bypasses trivial files', () => {
    it('allows config files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/project/.eslintrc.js'),
        files: {
          ...flowPhaseFile('executing'),
          '/project/.eslintrc.js': 'module.exports = {};',
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows type-only files', async () => {
      const typeContent = 'export type Foo = { bar: string };\nexport interface Baz { qux: number; }';
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/types.ts'),
        files: {
          ...flowPhaseFile('executing'),
          '/src/types.ts': typeContent,
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows barrel export files', async () => {
      const barrelContent = "export * from './foo';\nexport * from './bar';";
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/index.ts'),
        files: {
          ...flowPhaseFile('executing'),
          '/src/index.ts': barrelContent,
        },
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('handles invalid input', () => {
    it('returns null on invalid JSON', async () => {
      const layer = makeStubHookLayer({ stdin: 'not json' });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('returns null on missing file_path', async () => {
      const layer = makeStubHookLayer({
        stdin: JSON.stringify({ tool_input: {} }),
      });
      const result = await Effect.runPromise(preToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });
});

describe('preToolUseWrite', () => {
  describe('allows new file creation regardless of TDD state', () => {
    it('allows new file when tdd-state is null during executing phase', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/newModule.ts', 'export const foo = 42;'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows new file when tdd-state is writing-test', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/newTypes.ts', 'export type Foo = string;'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('denies overwriting existing production files without TDD', () => {
    it('denies when tdd-state is null during executing phase', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/existing.ts', 'new content'),
        files: {
          ...flowPhaseFile('executing'),
          '/src/existing.ts': 'old content',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expectDeny(result, 'failing test');
    });

    it('denies when tdd-state is writing-test', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/existing.ts', 'new content'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
          '/src/existing.ts': 'old content',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expectDeny(result, 'run the test');
    });
  });

  describe('allows on red and green states', () => {
    it('allows overwrite when tdd-state is red', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/existing.ts', 'new content'),
        files: {
          ...flowPhaseFile('executing'),
          ...tddStateFile('red'),
          '/src/existing.ts': 'old content',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows overwrite when tdd-state is green', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/existing.ts', 'new content'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('green') }),
          '/src/existing.ts': 'old content',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('auto-bypasses trivial files', () => {
    it('allows overwriting config files', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/tsconfig.json', '{}'),
        files: {
          ...flowPhaseFile('executing'),
          '/tsconfig.json': '{}',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows overwriting type-only files', async () => {
      const typeContent = 'export type Config = { key: string };';
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/types.ts', typeContent),
        files: {
          ...flowPhaseFile('executing'),
          '/src/types.ts': 'export type OldConfig = {};',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('allows test file writes', () => {
    it('allows writing new test files', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.test.ts', 'test content'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('allows overwriting test files', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.test.ts', 'new test content'),
        files: {
          ...flowPhaseFile('executing'),
          '/src/foo.test.ts': 'old test content',
        },
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('handles invalid input', () => {
    it('returns null on invalid JSON', async () => {
      const layer = makeStubHookLayer({ stdin: 'not json' });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('returns null on missing file_path', async () => {
      const layer = makeStubHookLayer({
        stdin: JSON.stringify({ tool_input: { content: 'foo' } }),
      });
      const result = await Effect.runPromise(preToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });
});

describe('postToolUseWrite', () => {
  describe('when writing test files during active phase', () => {
    it('writes writing-test phase for first test file write', async () => {
      const writtenFiles: Record<string, string> = {};
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.test.ts', 'test content'),
        files: flowPhaseFile('executing'),
        writtenFiles,
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
      const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}');
      expect(state.tddState.phase).toBe('writing-test');
    });

    it('warns on second test file write without test run', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.test.ts', 'test content'),
        files: {
          ...stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
        },
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('batching');
    });
  });

  describe('when writing production code during active phase', () => {
    it('injects TDD reminder when no test state exists', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.ts', 'production code'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('TDD reminder');
    });

    it('does not inject reminder when tests are red', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.ts', 'production code'),
        files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('red') }),
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when writing non-code files', () => {
    it('does not inject reminder for .md files', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/README.md', '# README'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when phase is not active', () => {
    it('does not inject reminder outside active phase', async () => {
      const layer = makeStubHookLayer({
        stdin: writeStdin('/src/foo.ts', 'production code'),
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('handles invalid input', () => {
    it('returns null on invalid JSON', async () => {
      const layer = makeStubHookLayer({ stdin: 'not json' });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('returns null on missing file_path', async () => {
      const layer = makeStubHookLayer({
        stdin: JSON.stringify({ tool_input: { content: 'foo' } }),
      });
      const result = await Effect.runPromise(postToolUseWrite().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });
});

describe('postToolUseBash', () => {
  it('tracks br show command by writing bead ID to br-show-log.txt', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('br show cape-abc'),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseBash().pipe(Effect.provide(layer)));
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toContain('cape-abc');
  });

  it('appends to existing br-show-log.txt', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('br show cape-def'),
      files: { '/test/hooks/context/br-show-log.txt': 'cape-abc\n' },
      writtenFiles,
    });
    await Effect.runPromise(postToolUseBash().pipe(Effect.provide(layer)));
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toBe('cape-abc\ncape-def\n');
  });

  it('returns null for non-matching commands', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({ stdin: bashStdin('echo hello'), writtenFiles });
    const result = await Effect.runPromise(postToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
    expect(Object.keys(writtenFiles)).toHaveLength(0);
  });

  it('returns null for invalid JSON', async () => {
    const layer = makeStubHookLayer({ stdin: 'not json' });
    const result = await Effect.runPromise(postToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('returns null for empty command', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('') });
    const result = await Effect.runPromise(postToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });
});

describe('postToolUseEdit', () => {
  describe('when editing production code during executing phase', () => {
    it('injects reminder when no test state exists', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('TDD reminder');
    });

    it('injects reminder when tests are green', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/handler.go'),
        files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('green') }),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('TDD reminder');
    });

    it('does not inject reminder when tests are red', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('red') }),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when editing test files', () => {
    it('writes writing-test phase for first test file edit', async () => {
      const writtenFiles: Record<string, string> = {};
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.test.ts'),
        files: flowPhaseFile('executing'),
        writtenFiles,
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
      const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}');
      expect(state.tddState.phase).toBe('writing-test');
    });

    it('warns on second test file edit without test run', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.test.ts'),
        files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('batching');
    });

    it('does not warn on test file edit after test run resets state to green', async () => {
      const writtenFiles: Record<string, string> = {};
      const layer = makeStubHookLayer({
        stdin: editStdin('/pkg/handler_test.go'),
        files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('green') }),
        writtenFiles,
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
      const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}');
      expect(state.tddState.phase).toBe('writing-test');
    });

    it('does not warn on test file edit after test run resets state to red', async () => {
      const writtenFiles: Record<string, string> = {};
      const layer = makeStubHookLayer({
        stdin: editStdin('/tests/parser_spec.lua'),
        files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('red') }),
        writtenFiles,
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
      const state = JSON.parse(writtenFiles['/test/hooks/context/state.json'] ?? '{}');
      expect(state.tddState.phase).toBe('writing-test');
    });

    it('does not track test file edits outside active phase', async () => {
      const writtenFiles: Record<string, string> = {};
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.test.ts'),
        writtenFiles,
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
      expect(writtenFiles['/test/hooks/context/state.json']).toBeUndefined();
    });
  });

  describe('when editing non-code files', () => {
    it('does not inject reminder for .md files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/README.md'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not inject reminder for .json files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/package.json'),
        files: flowPhaseFile('executing'),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when phase is not executing or debugging', () => {
    it('does not inject reminder during idle phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not inject reminder during planning phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: flowPhaseFile('planning'),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when editing during debugging phase', () => {
    it('injects reminder when no test state exists', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: flowPhaseFile('debugging'),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
    });
  });

  describe('when state is stale', () => {
    it('injects reminder when red state is older than 10 minutes', async () => {
      const staleTimestamp = Date.now() - 11 * 60 * 1000;
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: stateFile({
          flowPhase: flowPhaseEntry('executing'),
          tddState: { phase: 'red', timestamp: staleTimestamp },
        }),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
    });
  });

  describe('when tddState is malformed', () => {
    it('injects reminder when tddState has no phase field', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        files: stateFile({
          flowPhase: flowPhaseEntry('executing'),
          tddState: { timestamp: Date.now() },
        }),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
    });
  });

  describe('when input is invalid', () => {
    it('returns null on invalid JSON', async () => {
      const layer = makeStubHookLayer({ stdin: 'not json' });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('returns null on missing file_path', async () => {
      const layer = makeStubHookLayer({
        stdin: JSON.stringify({ tool_input: {} }),
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });
});

describe('hook command - PostToolUse wiring', () => {
  it('routes post-tool-use --matcher Bash without output', async () => {
    const writtenFiles: Record<string, string> = {};
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('br show cape-abc'),
      writtenFiles,
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toContain('cape-abc');
    consoleSpy.mockRestore();
  });

  it('routes post-tool-use --matcher Edit with TDD reminder output', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: editStdin('/src/foo.ts'),
      files: flowPhaseFile('executing'),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'Edit']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('TDD reminder');
    consoleSpy.mockRestore();
  });

  it('accepts PascalCase PostToolUse event name', async () => {
    const writtenFiles: Record<string, string> = {};
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('br show cape-xyz'),
      writtenFiles,
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'PostToolUse', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(writtenFiles['/test/hooks/context/br-show-log.txt']).toContain('cape-xyz');
    consoleSpy.mockRestore();
  });

  it('routes post-tool-use --matcher Write with TDD reminder output', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: writeStdin('/src/foo.ts', 'production code'),
      files: flowPhaseFile('executing'),
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'Write']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const output = consoleSpy.mock.calls.flat().join('');
    const result = JSON.parse(output);
    expect(result.additionalContext).toContain('TDD reminder');
    consoleSpy.mockRestore();
  });

  it('produces no output for unknown PostToolUse matcher', async () => {
    const hookLayer = makeStubHookLayer({ stdin: bashStdin('echo hello') });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'Unknown']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    consoleSpy.mockRestore();
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
      stdin: skillStdin('cape:execute-plan'),
      brResponses: { '--type epic': '' },
    });
    await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith(
      'hook.PreToolUse.Skill',
      expect.stringContaining('brainstorm'),
    );
  });

  it('does not log for preToolUseSkill pass-through', async () => {
    const layer = makeStubHookLayer({ stdin: skillStdin('cape:commit') });
    await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('logs inject event for userPromptSubmit skill detection', async () => {
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show br issues' }),
    });
    await Effect.runPromise(userPromptSubmit().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith(
      'hook.UserPromptSubmit',
      expect.stringContaining('cape:beads'),
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

  it('logs tdd-reminder for postToolUseEdit production code edit', async () => {
    const layer = makeStubHookLayer({
      stdin: editStdin('/src/foo.ts'),
      files: flowPhaseFile('executing'),
    });
    await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith('hook.PostToolUse.Edit', 'tdd-reminder');
  });

  it('logs tdd-batching for postToolUseEdit second test edit without run', async () => {
    const layer = makeStubHookLayer({
      stdin: editStdin('/src/foo.test.ts'),
      files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('writing-test') }),
    });
    await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
    expect(logEvent).toHaveBeenCalledWith('hook.PostToolUse.Edit', 'tdd-batching');
  });

  it('does not log for postToolUseEdit when tests are red', async () => {
    const layer = makeStubHookLayer({
      stdin: editStdin('/src/foo.ts'),
      files: stateFile({ flowPhase: flowPhaseEntry('executing'), tddState: tddEntry('red') }),
    });
    await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });

  it('does not log for sessionStart', async () => {
    const layer = makeStubHookLayer();
    await Effect.runPromise(sessionStart(false).pipe(Effect.provide(layer)));
    expect(logEvent).not.toHaveBeenCalled();
  });
});
