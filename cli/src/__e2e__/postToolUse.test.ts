import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
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
    env: { ...process.env, ...env }, // eslint-disable-line node/no-process-env
    timeout: 10_000,
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    status: result.status ?? 1,
  };
};

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

  it('writes green TDD state for pytest', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'pytest tests/' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes green TDD state for go test', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'go test ./...' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes green TDD state for cargo test', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'cargo test' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes green TDD state for busted', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'busted spec/' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes green TDD state for bun test', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'bun test' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes green TDD state for python -m pytest', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'python -m pytest -v' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes green TDD state for npm test', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'npm test' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('handles br show and test command in separate calls', () => {
    const showStdin = JSON.stringify({
      tool_input: { command: 'br show cape-xyz' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], showStdin, env);

    const testStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], testStdin, env);

    const log = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    expect(log).toContain('cape-xyz');

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('handles malformed JSON input gracefully', () => {
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], 'not json', env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'br-show-log.txt'))).toBe(false);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('writes both br show log and TDD state for compound command', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'br show cape-abc && npx vitest run' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);

    const log = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    expect(log).toContain('cape-abc');

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('returns null output (no stdout) for all commands', () => {
    const commands = ['ls -la', 'br show cape-1', 'npx vitest run'];
    for (const command of commands) {
      const stdin = JSON.stringify({ tool_input: { command } });
      const result = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
      expect(result.stdout).toBe('');
    }
  });
});

// All Edit E2E tests hit the early-return path because `br` queries return no
// executing/debugging flow context. The TDD reminder output path is only testable
// at the unit level (in hook.test.ts). These tests verify graceful no-op behavior,
// not reminder emission.
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

describe('PostToolUseFailure/Bash', () => {
  it('writes red TDD state for npx vitest failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes red TDD state for pytest failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'pytest -x tests/' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes red TDD state for go test failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'go test ./...' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes red TDD state for cargo test failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'cargo test' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('writes red TDD state for busted failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'busted spec/' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('produces no state change for non-test command failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'ls /nonexistent' },
    });
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('produces no state change for build command failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'npm run build' },
    });
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('produces no state change for git command failure', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'git push origin main' },
    });
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('returns no stdout for all cases', () => {
    const commands = ['npx vitest run', 'ls /nonexistent', 'cargo test'];
    for (const command of commands) {
      const stdin = JSON.stringify({ tool_input: { command } });
      const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);
      expect(result.stdout).toBe('');
    }
  });

  it('handles malformed JSON input gracefully', () => {
    const result = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], 'not json', env);
    expect(result.status).toBe(0);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
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

  it('creates context directory when it does not exist for test command', () => {
    spawnSync('rm', ['-rf', contextDir]);

    const stdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);

    expect(existsSync(contextDir)).toBe(true);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(true);
  });

  it('creates context directory when it does not exist for test failure', () => {
    spawnSync('rm', ['-rf', contextDir]);

    const stdin = JSON.stringify({
      tool_input: { command: 'pytest' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);

    expect(existsSync(contextDir)).toBe(true);
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(true);
  });
});

describe('TDD state transitions', () => {
  it('transitions from red to green on test pass', () => {
    const failStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], failStdin, env);

    let state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);

    const passStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], passStdin, env);

    state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('transitions from green to red on test failure', () => {
    const passStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], passStdin, env);

    let state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
    expect(state.timestamp).toBeGreaterThan(0);

    const failStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], failStdin, env);

    state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
    expect(state.timestamp).toBeGreaterThan(0);
  });

  it('overwrites timestamp on each transition', () => {
    const stdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });

    cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], stdin, env);
    const first = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));

    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], stdin, env);
    const second = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));

    expect(second.timestamp).toBeGreaterThanOrEqual(first.timestamp);
    expect(second.phase).toBe('green');
  });
});
