import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BINARY = join(import.meta.dirname, '..', '..', 'dist', 'index.mjs');

const cape = (
  args: string[],
  stdin: string,
  env: Record<string, string>,
): { stdout: string; stderr: string; status: number } => {
  const result = spawnSync('node', [BINARY, ...args], {
    input: stdin,
    encoding: 'utf-8',
    env: { ...process.env, ...env },
    timeout: 10_000,
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    status: result.status ?? 1,
  };
};

let tmpDir: string;
let env: Record<string, string>;

beforeEach(() => {
  tmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-proto-XXXXXX')], {
    encoding: 'utf-8',
  }).trim();
  mkdirSync(join(tmpDir, 'hooks', 'context'), { recursive: true });
  env = { CLAUDE_PLUGIN_ROOT: tmpDir };
});

afterEach(() => {
  spawnSync('rm', ['-rf', tmpDir]);
});

describe('empty stdin', () => {
  it('pre-tool-use Bash exits 0 with no output', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], '', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use Bash exits 0 with no output', () => {
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], '', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use-failure Bash exits 0 with no output', () => {
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], '', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('user-prompt-submit exits 0 with approve', () => {
    const result = cape(['hook', 'user-prompt-submit'], '', env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('approve');
  });
});

describe('invalid JSON stdin', () => {
  it('pre-tool-use Bash exits 0 with no output', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], 'not json {{{', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use Bash exits 0 with no output', () => {
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], '{broken', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use-failure Bash exits 0 with no output', () => {
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], '<<<>>>', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('user-prompt-submit exits 0 with approve on garbage input', () => {
    const result = cape(['hook', 'user-prompt-submit'], 'garbage', env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('approve');
  });

  it('pre-tool-use Skill exits 0 with no output', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], 'not json', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('valid JSON but missing expected fields', () => {
  it('pre-tool-use Bash with empty object exits 0 silently', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], '{}', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('pre-tool-use Bash with tool_input but no command exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: {} });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('pre-tool-use Bash with tool_input.command as null exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: null } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('pre-tool-use Skill with tool_input but no skill exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: {} });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use Edit with empty object exits 0 silently', () => {
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], '{}', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use AskUserQuestion with empty object exits 0 silently', () => {
    const result = cape(['hook', 'post-tool-use', '--matcher', 'AskUserQuestion'], '{}', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('user-prompt-submit with empty prompt approves', () => {
    const stdin = JSON.stringify({ prompt: '' });
    const result = cape(['hook', 'user-prompt-submit'], stdin, env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('approve');
  });

  it('user-prompt-submit with missing prompt field approves', () => {
    const stdin = JSON.stringify({ other: 'data' });
    const result = cape(['hook', 'user-prompt-submit'], stdin, env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.decision).toBe('approve');
  });
});

describe('unknown event names', () => {
  it('unknown-event exits 0 with no output', () => {
    const result = cape(['hook', 'unknown-event'], '{}', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('completely-made-up exits 0 with no output', () => {
    const result = cape(['hook', 'completely-made-up'], '{}', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('empty-string-like event exits 0 with no output', () => {
    const result = cape(['hook', 'x'], '{}', env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('unknown matchers', () => {
  it('pre-tool-use with unknown matcher exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'echo hello' } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'UnknownTool'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use with unknown matcher exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'echo hello' } });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'UnknownTool'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use-failure with unknown matcher exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'npx vitest run' } });
    const result = cape(
      ['hook', 'post-tool-use-failure', '--matcher', 'UnknownTool'],
      stdin,
      env,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('event name normalization', () => {
  it('PascalCase PreToolUse works the same as kebab-case', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'git add .' } });

    const kebab = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    const pascal = cape(['hook', 'PreToolUse', '--matcher', 'Bash'], stdin, env);

    expect(kebab.status).toBe(0);
    expect(pascal.status).toBe(0);
    expect(kebab.stdout).toBe(pascal.stdout);
    expect(JSON.parse(kebab.stdout).hookSpecificOutput.permissionDecision).toBe('deny');
  });

  it('PascalCase PostToolUse works the same as kebab-case', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'npx vitest run' } });

    const kebab = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    const pascal = cape(['hook', 'PostToolUse', '--matcher', 'Bash'], stdin, env);

    expect(kebab.status).toBe(0);
    expect(pascal.status).toBe(0);
  });

  it('PascalCase SessionStart works the same as kebab-case', () => {
    const kebab = cape(['hook', 'session-start'], '', env);
    const pascal = cape(['hook', 'SessionStart'], '', env);

    expect(kebab.status).toBe(0);
    expect(pascal.status).toBe(0);
    expect(JSON.parse(kebab.stdout)).toHaveProperty('additionalContext');
    expect(JSON.parse(pascal.stdout)).toHaveProperty('additionalContext');
  });
});

describe('encoding edge cases', () => {
  it('handles unicode in command without crashing', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'echo héllo wörld 日本語' } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('handles emoji in command without crashing', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'echo 🚀🔥' } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('handles escaped null byte in JSON', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'echo \x00test' } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
  });

  it('handles very long command without crashing', () => {
    const longArg = 'a'.repeat(50_000);
    const stdin = JSON.stringify({ tool_input: { command: `echo ${longArg}` } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('missing --matcher flag', () => {
  it('pre-tool-use without --matcher exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'echo hello' } });
    const result = cape(['hook', 'pre-tool-use'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use without --matcher exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'npx vitest run' } });
    const result = cape(['hook', 'post-tool-use'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use-failure without --matcher exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 'npx vitest run' } });
    const result = cape(['hook', 'post-tool-use-failure'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('no event argument', () => {
  it('exits non-zero with usage error', () => {
    const result = cape(['hook'], '', env);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('Missing required argument');
  });
});

describe('non-string field types', () => {
  it('pre-tool-use Bash with numeric command exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: 42 } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('pre-tool-use Bash with array command exits 0 silently', () => {
    const stdin = JSON.stringify({ tool_input: { command: ['echo', 'hello'] } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('pre-tool-use Skill with numeric skill name passes through', () => {
    const stdin = JSON.stringify({ tool_input: { skill: 123 } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('post-tool-use Edit with numeric file_path passes through', () => {
    const stdin = JSON.stringify({ tool_input: { file_path: 999 } });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('pre-tool-use Skill with ungated skill', () => {
  it('allows non-gated cape skill', () => {
    const stdin = JSON.stringify({ tool_input: { skill: 'cape:brainstorm' } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('allows non-cape skill', () => {
    const stdin = JSON.stringify({ tool_input: { skill: 'other:something' } });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});
