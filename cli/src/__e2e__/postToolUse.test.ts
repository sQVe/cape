import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cape } from './helpers';

let tmpDir: string;
let contextDir: string;
let env: Record<string, string>;

beforeEach(() => {
  tmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-ptu-XXXXXX')], {
    encoding: 'utf-8',
  }).trim();
  contextDir = join(tmpDir, 'hooks', 'context');
  mkdirSync(contextDir, { recursive: true });
  env = { CLAUDE_PLUGIN_ROOT: tmpDir };
});

afterEach(() => {
  spawnSync('rm', ['-rf', tmpDir]);
});

describe('PostToolUse/Bash', () => {
  it('produces no state changes for non-br-show, non-test commands', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'ls -la' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'br-show-log.txt'))).toBe(false);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('produces no state changes for git commands', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'git status' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'br-show-log.txt'))).toBe(false);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('appends multiple br show ids to the log', () => {
    const ids = ['cape-abc', 'cape-def', 'cape-ghi'];
    for (const id of ids) {
      const stdin = JSON.stringify({
        tool_input: { command: `br show ${id}` },
      });
      cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    }

    const log = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    for (const id of ids) {
      expect(log).toContain(id);
    }
    const lines = log.trim().split('\n');
    expect(lines).toHaveLength(3);
  });

  it('ignores br show with no ID argument', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'br show' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'br-show-log.txt'))).toBe(false);
  });

  it('handles malformed JSON input gracefully', () => {
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], 'not json', env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'br-show-log.txt'))).toBe(false);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('returns null output (no stdout) for all commands', () => {
    const commands = ['ls -la', 'br show cape-1'];
    for (const command of commands) {
      const stdin = JSON.stringify({ tool_input: { command } });
      const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
      expect(result.stdout).toBe('');
    }
  });
});

// All Edit E2E tests hit the early-return path because no flow-phase.json exists.
// The TDD reminder output path is only testable at the unit level (in hook.test.ts).
describe('PostToolUse/Edit', () => {
  it('skips .test.ts files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'src/services/hook.test.ts' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips _test.go files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'internal/hook/handler_test.go' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips _spec.lua files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'lua/plugin/init_spec.lua' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips .spec.tsx files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'src/components/Button.spec.tsx' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips __tests__ directory files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'src/__tests__/utils.ts' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips .md files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'docs/README.md' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips .json files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'package.json' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('skips .yaml files', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: '.github/workflows/ci.yaml' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('produces no output for non-code file regardless of flow phase', () => {
    const stdin = JSON.stringify({
      tool_input: { file_path: 'README.md' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('produces no output when no file_path in input', () => {
    const stdin = JSON.stringify({
      tool_input: {},
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], stdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});


describe('context directory creation', () => {
  it('creates context directory when it does not exist for br show', () => {
    spawnSync('rm', ['-rf', contextDir]);
    expect(existsSync(contextDir)).toBe(false);

    const stdin = JSON.stringify({
      tool_input: { command: 'br show cape-new' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    expect(existsSync(contextDir)).toBe(true);
    const log = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    expect(log).toContain('cape-new');
  });

});

