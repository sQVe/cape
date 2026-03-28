import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it, vi } from 'vitest';

import { main } from '../main';
import {
  HookService,
  checkBrRules,
  checkBrShowRequirement,
  checkGitStagingRules,
  checkPrBodyRules,
  checkPrCreationGuards,
  checkStopReinforcement,
  denyWith,
  deriveFlowContext,
  detectBeadsSkill,
  isCodeFile,
  isTestCommand,
  isTestFile,
  normalizeEventName,
  postToolUseAskUserQuestion,
  postToolUseBash,
  postToolUseEdit,
  postToolUseFailureBash,
  preToolUseBash,
  preToolUseSkill,
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
    expect(
      deriveFlowContext({
        bugs: 'cape-bug1',
        inProgressTasks: null,
        epics: null,
      }),
    ).toContain('debugging');
  });

  it('returns executing when in-progress tasks exist', () => {
    expect(
      deriveFlowContext({
        bugs: null,
        inProgressTasks: 'cape-abc',
        epics: null,
      }),
    ).toContain('executing');
  });

  it('returns planning when only epics exist', () => {
    expect(
      deriveFlowContext({
        bugs: null,
        inProgressTasks: null,
        epics: 'cape-epic1',
      }),
    ).toContain('planning');
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
    spawnGit: (args) => {
      const key = args.join(' ');
      for (const [pattern, response] of Object.entries(gitResponses)) {
        if (key.includes(pattern)) {
          return Effect.succeed(response);
        }
      }
      return Effect.succeed(null);
    },
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
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'show br issues' }),
    });
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
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ prompt: 'hello' }),
    });
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

const bashStdin = (command: string) => JSON.stringify({ tool_input: { command } });

const skillStdin = (skill: string) => JSON.stringify({ tool_input: { skill } });

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

describe('checkBrRules', () => {
  it('denies --design on br create', () => {
    const violations = checkBrRules('br create --design foo');
    expect(violations.some((v) => v.includes('--description'))).toBe(true);
  });

  it('allows --description on br create', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
    );
    expect(violations).toHaveLength(0);
  });

  it('denies missing --type on br create', () => {
    const violations = checkBrRules('br create --title foo');
    expect(violations.some((v) => v.includes('--type'))).toBe(true);
  });

  it('denies missing --priority on br create', () => {
    const violations = checkBrRules('br create --type task --title foo');
    expect(violations.some((v) => v.includes('--priority'))).toBe(true);
  });

  it('allows br create with both --type and --priority', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
    );
    expect(violations).toHaveLength(0);
  });

  it('accepts -t -p -l short flags', () => {
    const violations = checkBrRules(
      'br create -t task -p 2 -l foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
    );
    expect(violations).toHaveLength(0);
  });

  it('accepts mixed short and long flags', () => {
    const violations = checkBrRules(
      'br create --type task -p 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
    );
    expect(violations).toHaveLength(0);
  });

  it('denies task without ## Goal', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Success criteria\nThing done"',
    );
    expect(violations.some((v) => v.includes('## Goal'))).toBe(true);
  });

  it('denies task without ## Behaviors', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Success criteria\nThing done"',
    );
    expect(violations.some((v) => v.includes('## Behaviors'))).toBe(true);
  });

  it('denies task without ## Success criteria', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X"',
    );
    expect(violations.some((v) => v.includes('## Success criteria'))).toBe(true);
  });

  it('denies bug without ## Reproduction steps or ## Evidence', () => {
    const violations = checkBrRules(
      'br create --type bug --priority 2 --labels foo --description "## Summary\nBroken"',
    );
    expect(violations.some((v) => v.includes('## Reproduction steps'))).toBe(true);
  });

  it('allows bug with ## Reproduction steps', () => {
    const violations = checkBrRules(
      'br create --type bug --priority 2 --labels foo --description "## Reproduction steps\nSteps here"',
    );
    expect(violations).toHaveLength(0);
  });

  it('allows bug with ## Evidence', () => {
    const violations = checkBrRules(
      'br create --type bug --priority 2 --labels foo --description "## Evidence\nScreenshot here"',
    );
    expect(violations).toHaveLength(0);
  });

  it('denies epic without ## Requirements', () => {
    const violations = checkBrRules(
      'br create --type epic --priority 2 --labels foo --description "## Success criteria\nDone"',
    );
    expect(violations.some((v) => v.includes('## Requirements'))).toBe(true);
  });

  it('denies epic without ## Success criteria', () => {
    const violations = checkBrRules(
      'br create --type epic --priority 2 --labels foo --description "## Requirements\nNeeds this"',
    );
    expect(violations.some((v) => v.includes('## Success criteria'))).toBe(true);
  });

  it('allows valid task with all required headers', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
    );
    expect(violations).toHaveLength(0);
  });

  it('denies --status in-progress with hyphen', () => {
    const violations = checkBrRules('br update foo --status in-progress');
    expect(violations.some((v) => v.includes('in_progress'))).toBe(true);
  });

  it('allows --status in_progress with underscore', () => {
    const violations = checkBrRules('br update foo --status in_progress');
    expect(violations).toHaveLength(0);
  });

  it('denies --status done', () => {
    const violations = checkBrRules('br update foo --status done');
    expect(violations.some((v) => v.includes('br close'))).toBe(true);
  });

  it('denies missing --labels on br create', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --description "## Goal\nDo\n## Behaviors\n- Adds X\n## Success criteria\nDone"',
    );
    expect(violations.some((v) => v.includes('--labels'))).toBe(true);
  });

  it('allows --labels present', () => {
    const violations = checkBrRules(
      'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
    );
    expect(violations).toHaveLength(0);
  });
});

describe('checkGitStagingRules', () => {
  it('denies git add .', () => {
    const violations = checkGitStagingRules('git add .');
    expect(violations.some((v) => v.includes('git add .'))).toBe(true);
  });

  it('denies git add -A', () => {
    const violations = checkGitStagingRules('git add -A');
    expect(violations.some((v) => v.includes('git add -A'))).toBe(true);
  });

  it('denies git add --all', () => {
    const violations = checkGitStagingRules('git add --all');
    expect(violations.some((v) => v.includes('git add -A'))).toBe(true);
  });

  it('allows git add with specific file', () => {
    expect(checkGitStagingRules('git add specific-file.ts')).toHaveLength(0);
  });
});

describe('checkPrBodyRules', () => {
  it('denies invented sections in PR body', () => {
    const violations = checkPrBodyRules('gh pr create --body "\n## Summary\nstuff"');
    expect(violations.some((v) => v.includes('invented sections'))).toBe(true);
  });

  it('allows PR without --body flag', () => {
    expect(checkPrBodyRules('gh pr create --title "feat: thing"')).toHaveLength(0);
  });

  it('allows non-PR commands', () => {
    expect(checkPrBodyRules('echo hello')).toHaveLength(0);
  });
});

describe('checkBrShowRequirement', () => {
  it('denies br update --design without prior br show', async () => {
    const layer = makeStubHookLayer();
    const result = await Effect.runPromise(
      checkBrShowRequirement('br update foo-123 --design bar').pipe(Effect.provide(layer)),
    );
    expect(result).toContain('br show foo-123');
  });

  it('allows br update --design when id is in br-show-log.txt', async () => {
    const layer = makeStubHookLayer({
      files: { '/test/hooks/context/br-show-log.txt': 'foo-123\n' },
    });
    const result = await Effect.runPromise(
      checkBrShowRequirement('br update foo-123 --design bar').pipe(Effect.provide(layer)),
    );
    expect(result).toBeNull();
  });

  it('returns null for non-br-update commands', async () => {
    const layer = makeStubHookLayer();
    const result = await Effect.runPromise(
      checkBrShowRequirement('echo hello').pipe(Effect.provide(layer)),
    );
    expect(result).toBeNull();
  });
});

describe('checkPrCreationGuards', () => {
  it('denies PR from default branch', async () => {
    const layer = makeStubHookLayer({
      gitResponses: {
        'rev-parse': 'main',
        'symbolic-ref': 'refs/remotes/origin/main',
        status: null,
      },
      files: { '/test/hooks/context/pr-confirmed.txt': String(Date.now()) },
    });
    const violations = await Effect.runPromise(
      checkPrCreationGuards('gh pr create').pipe(Effect.provide(layer)),
    );
    expect(violations.some((v) => v.includes('Cannot create a PR from'))).toBe(true);
  });

  it('denies PR with uncommitted changes', async () => {
    const layer = makeStubHookLayer({
      gitResponses: {
        'rev-parse': 'feature-branch',
        'symbolic-ref': 'refs/remotes/origin/main',
        status: 'M file.ts',
      },
      files: { '/test/hooks/context/pr-confirmed.txt': String(Date.now()) },
    });
    const violations = await Effect.runPromise(
      checkPrCreationGuards('gh pr create').pipe(Effect.provide(layer)),
    );
    expect(violations.some((v) => v.includes('Uncommitted changes'))).toBe(true);
  });

  it('denies PR without confirmation file', async () => {
    const layer = makeStubHookLayer({
      gitResponses: {
        'rev-parse': 'feature-branch',
        'symbolic-ref': 'refs/remotes/origin/main',
        status: '',
      },
    });
    const violations = await Effect.runPromise(
      checkPrCreationGuards('gh pr create').pipe(Effect.provide(layer)),
    );
    expect(violations.some((v) => v.includes('user confirmation'))).toBe(true);
  });

  it('denies PR with expired confirmation', async () => {
    const expiredTimestamp = String(Date.now() - 11 * 60 * 1000);
    const layer = makeStubHookLayer({
      gitResponses: {
        'rev-parse': 'feature-branch',
        'symbolic-ref': 'refs/remotes/origin/main',
        status: '',
      },
      files: { '/test/hooks/context/pr-confirmed.txt': expiredTimestamp },
    });
    const violations = await Effect.runPromise(
      checkPrCreationGuards('gh pr create').pipe(Effect.provide(layer)),
    );
    expect(violations.some((v) => v.includes('expired'))).toBe(true);
  });

  it('allows PR with valid confirmation on feature branch', async () => {
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      gitResponses: {
        'rev-parse': 'feature-branch',
        'symbolic-ref': 'refs/remotes/origin/main',
        status: '',
      },
      files: { '/test/hooks/context/pr-confirmed.txt': String(Date.now()) },
      removedFiles,
    });
    const violations = await Effect.runPromise(
      checkPrCreationGuards('gh pr create').pipe(Effect.provide(layer)),
    );
    expect(violations).toHaveLength(0);
    expect(removedFiles).toContain('/test/hooks/context/pr-confirmed.txt');
  });

  it('returns empty for non-PR commands', async () => {
    const layer = makeStubHookLayer();
    const violations = await Effect.runPromise(
      checkPrCreationGuards('echo hello').pipe(Effect.provide(layer)),
    );
    expect(violations).toHaveLength(0);
  });
});

describe('checkStopReinforcement', () => {
  it('outputs message for br close', () => {
    const result = checkStopReinforcement('br close cape-2v2.3');
    expect(result).toContain('STOP');
  });

  it('outputs message for br close without arguments', () => {
    const result = checkStopReinforcement('br close');
    expect(result).toContain('STOP');
  });

  it('returns null for non-br-close commands', () => {
    expect(checkStopReinforcement('echo hello')).toBeNull();
  });

  it('returns null for br show', () => {
    expect(checkStopReinforcement('br show cape-2v2')).toBeNull();
  });

  it('returns null for br update --status closed', () => {
    expect(checkStopReinforcement('br update cape-2v2.3 --status closed')).toBeNull();
  });

  it('returns null for empty command', () => {
    expect(checkStopReinforcement('')).toBeNull();
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

  it('denies --design on br create', async () => {
    const layer = makeStubHookLayer({
      stdin: bashStdin('br create --design foo'),
    });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expectDeny(result, '--description');
  });

  it('denies bulk git staging', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('git add .') });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expectDeny(result, 'git add .');
  });

  it('outputs additionalContext for br close', async () => {
    const layer = makeStubHookLayer({
      stdin: bashStdin('br close cape-2v2.3'),
    });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toHaveProperty('additionalContext');
    expect((result as { additionalContext: string }).additionalContext).toContain('STOP');
  });

  it('passes through fully valid br create command', async () => {
    const layer = makeStubHookLayer({
      stdin: bashStdin(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- Adds X\n## Success criteria\nThing done"',
      ),
    });
    const result = await Effect.runPromise(preToolUseBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });
});

describe('preToolUseSkill', () => {
  it.each([
    'cape:commit',
    'cape:review',
    'cape:beads',
    'cape:branch',
    'cape:brainstorm',
    'cape:write-plan',
  ])('allows non-gated skill %s', async (skill) => {
    const layer = makeStubHookLayer({ stdin: skillStdin(skill) });
    const result = await Effect.runPromise(preToolUseSkill().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
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
});

describe('hook command - PreToolUse wiring', () => {
  it('routes pre-tool-use --matcher Bash to enforce-commands', async () => {
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('br create --design foo'),
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
      stdin: bashStdin('br create --design foo'),
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

describe('isTestCommand', () => {
  it.each([
    'bun test',
    'npm test',
    'vitest',
    'npx vitest run',
    'pytest',
    'go test ./...',
    'cargo test',
    'busted',
    'python -m pytest',
    'python -m unittest',
  ])('detects "%s"', (cmd) => {
    expect(isTestCommand(cmd)).toBe(true);
  });

  it.each(['echo hello', 'git status', 'npm install', 'bun run build'])(
    'rejects "%s"',
    (cmd) => {
      expect(isTestCommand(cmd)).toBe(false);
    },
  );
});

const editStdin = (filePath: string) =>
  JSON.stringify({ tool_input: { file_path: filePath, old_string: 'old', new_string: 'new' } });

const prQuestionStdin = (
  questions: { question: string }[],
  answers: Record<string, string>,
) => JSON.stringify({ tool_input: { questions, answers } });

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

  it('tracks test command by writing tdd-state.json with green phase', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('npx vitest run'),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseBash().pipe(Effect.provide(layer)));
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeTypeOf('number');
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
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
      expect((result as { additionalContext: string }).additionalContext).toContain('test');
    });

    it('injects reminder when tests are green', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/handler.go'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
        files: {
          '/test/hooks/context/tdd-state.json': JSON.stringify({
            phase: 'green',
            timestamp: Date.now(),
          }),
        },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
    });

    it('does not inject reminder when tests are red', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
        files: {
          '/test/hooks/context/tdd-state.json': JSON.stringify({
            phase: 'red',
            timestamp: Date.now(),
          }),
        },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when editing test files', () => {
    it('does not inject reminder for .test.ts files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.test.ts'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not inject reminder for _test.go files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/pkg/handler_test.go'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not inject reminder for _spec.lua files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/tests/parser_spec.lua'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when editing non-code files', () => {
    it('does not inject reminder for .md files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/README.md'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not inject reminder for .json files', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/package.json'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when phase is not executing or debugging', () => {
    it('does not inject reminder during idle phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        brResponses: {},
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });

    it('does not inject reminder during planning phase', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        brResponses: { '--type epic': 'cape-1 epic open My Epic' },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toBeNull();
    });
  });

  describe('when editing during debugging phase', () => {
    it('injects reminder when no test state exists', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        brResponses: { '--type bug': 'cape-bug1 bug open Crash' },
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
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
        files: {
          '/test/hooks/context/tdd-state.json': JSON.stringify({
            phase: 'red',
            timestamp: staleTimestamp,
          }),
        },
      });
      const result = await Effect.runPromise(postToolUseEdit().pipe(Effect.provide(layer)));
      expect(result).toHaveProperty('additionalContext');
    });
  });

  describe('when state file is corrupted', () => {
    it('injects reminder when state file is corrupted', async () => {
      const layer = makeStubHookLayer({
        stdin: editStdin('/src/foo.ts'),
        brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
        files: { '/test/hooks/context/tdd-state.json': 'corrupted{{{' },
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

describe('postToolUseAskUserQuestion', () => {
  it('writes pr-confirmed.txt on PR confirmation', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'Ready to create the PR?' }],
        { q1: 'Yes, create the PR' },
      ),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseAskUserQuestion().pipe(Effect.provide(layer)));
    expect(writtenFiles['/test/hooks/context/pr-confirmed.txt']).toBeDefined();
    const timestamp = Number.parseInt(writtenFiles['/test/hooks/context/pr-confirmed.txt']);
    expect(Number.isNaN(timestamp)).toBe(false);
  });

  it('deletes pr-confirmed.txt on PR rejection', async () => {
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'Ready to create the PR?' }],
        { q1: 'cancel' },
      ),
      removedFiles,
    });
    await Effect.runPromise(postToolUseAskUserQuestion().pipe(Effect.provide(layer)));
    expect(removedFiles).toContain('/test/hooks/context/pr-confirmed.txt');
  });

  it('deletes pr-confirmed.txt on abort', async () => {
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'Create pull request?' }],
        { q1: 'abort' },
      ),
      removedFiles,
    });
    await Effect.runPromise(postToolUseAskUserQuestion().pipe(Effect.provide(layer)));
    expect(removedFiles).toContain('/test/hooks/context/pr-confirmed.txt');
  });

  it('deletes pr-confirmed.txt on edit', async () => {
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'Create pull request?' }],
        { q1: 'edit the description' },
      ),
      removedFiles,
    });
    await Effect.runPromise(postToolUseAskUserQuestion().pipe(Effect.provide(layer)));
    expect(removedFiles).toContain('/test/hooks/context/pr-confirmed.txt');
  });

  it('deletes pr-confirmed.txt when no answers provided', async () => {
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin([{ question: 'Create the PR?' }], {}),
      removedFiles,
    });
    await Effect.runPromise(postToolUseAskUserQuestion().pipe(Effect.provide(layer)));
    expect(removedFiles).toContain('/test/hooks/context/pr-confirmed.txt');
  });

  it('ignores non-PR questions', async () => {
    const writtenFiles: Record<string, string> = {};
    const removedFiles: string[] = [];
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'What color is the sky?' }],
        { q1: 'blue' },
      ),
      writtenFiles,
      removedFiles,
    });
    const result = await Effect.runPromise(
      postToolUseAskUserQuestion().pipe(Effect.provide(layer)),
    );
    expect(result).toBeNull();
    expect(Object.keys(writtenFiles)).toHaveLength(0);
    expect(removedFiles).toHaveLength(0);
  });

  it('detects pull request keyword in question', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'Ready to submit this pull request?' }],
        { q1: 'Yes' },
      ),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseAskUserQuestion().pipe(Effect.provide(layer)));
    expect(writtenFiles['/test/hooks/context/pr-confirmed.txt']).toBeDefined();
  });

  it('returns null on invalid JSON', async () => {
    const layer = makeStubHookLayer({ stdin: 'not json' });
    const result = await Effect.runPromise(
      postToolUseAskUserQuestion().pipe(Effect.provide(layer)),
    );
    expect(result).toBeNull();
  });

  it('returns null when questions field is missing', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: JSON.stringify({ tool_input: {} }),
      writtenFiles,
    });
    const result = await Effect.runPromise(
      postToolUseAskUserQuestion().pipe(Effect.provide(layer)),
    );
    expect(result).toBeNull();
    expect(Object.keys(writtenFiles)).toHaveLength(0);
  });
});

describe('postToolUseFailureBash', () => {
  it('writes tdd-state.json with red phase for test commands', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('npx vitest run'),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeTypeOf('number');
  });

  it('writes red phase for go test', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('go test ./...'),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('red');
  });

  it('writes red phase for pytest', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('pytest'),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('red');
  });

  it('writes red phase for bun test', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({
      stdin: bashStdin('bun test'),
      writtenFiles,
    });
    await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('red');
  });

  it('returns null for non-test commands', async () => {
    const writtenFiles: Record<string, string> = {};
    const layer = makeStubHookLayer({ stdin: bashStdin('echo hello'), writtenFiles });
    const result = await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
    expect(Object.keys(writtenFiles)).toHaveLength(0);
  });

  it('returns null on invalid JSON', async () => {
    const layer = makeStubHookLayer({ stdin: 'not json' });
    const result = await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
  });

  it('returns null on empty command', async () => {
    const layer = makeStubHookLayer({ stdin: bashStdin('') });
    const result = await Effect.runPromise(postToolUseFailureBash().pipe(Effect.provide(layer)));
    expect(result).toBeNull();
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
      brResponses: { in_progress: 'cape-abc task in_progress Do thing' },
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

  it('routes post-tool-use --matcher AskUserQuestion without output', async () => {
    const writtenFiles: Record<string, string> = {};
    const hookLayer = makeStubHookLayer({
      stdin: prQuestionStdin(
        [{ question: 'Create PR?' }],
        { q1: 'Yes' },
      ),
      writtenFiles,
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'post-tool-use', '--matcher', 'AskUserQuestion']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    expect(writtenFiles['/test/hooks/context/pr-confirmed.txt']).toBeDefined();
    consoleSpy.mockRestore();
  });

  it('routes post-tool-use-failure --matcher Bash with red phase', async () => {
    const writtenFiles: Record<string, string> = {};
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('npx vitest run'),
      writtenFiles,
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'post-tool-use-failure', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    expect(consoleSpy.mock.calls).toHaveLength(0);
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('red');
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

  it('accepts PascalCase PostToolUseFailure event name', async () => {
    const writtenFiles: Record<string, string> = {};
    const hookLayer = makeStubHookLayer({
      stdin: bashStdin('npx vitest run'),
      writtenFiles,
    });
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await Effect.runPromise(
      run(['hook', 'PostToolUseFailure', '--matcher', 'Bash']).pipe(
        Effect.provide(makeCommandLayers(hookLayer)),
      ),
    );
    const state = JSON.parse(writtenFiles['/test/hooks/context/tdd-state.json']);
    expect(state.phase).toBe('red');
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
