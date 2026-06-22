import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cape } from '../helpers';

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

// All Edit E2E tests hit the early-return path because no flowPhase exists in state.json.
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
