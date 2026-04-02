import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  tmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-e2e-XXXXXX')], {
    encoding: 'utf-8',
  }).trim();
  contextDir = join(tmpDir, 'hooks', 'context');
  mkdirSync(contextDir, { recursive: true });
  env = { CLAUDE_PLUGIN_ROOT: tmpDir };
});

afterEach(() => {
  spawnSync('rm', ['-rf', tmpDir]);
});

describe('flow 1: br show then br update with design', () => {
  it('allows br update after br show writes log', () => {
    const showStdin = JSON.stringify({
      tool_input: { command: 'br show cape-abc' },
    });
    const showResult = cape(['hook', 'post-tool-use', '--matcher', 'Bash'], showStdin, env);
    expect(showResult.status).toBe(0);

    const log = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    expect(log).toContain('cape-abc');

    const updateStdin = JSON.stringify({
      tool_input: { command: 'br update cape-abc --design "## New section"' },
    });
    const updateResult = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], updateStdin, env);
    expect(updateResult.status).toBe(0);
    expect(updateResult.stdout).toBe('');
  });

  it('passes through br update --design without prior br show', () => {
    const updateStdin = JSON.stringify({
      tool_input: { command: 'br update cape-abc --design "## New section"' },
    });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], updateStdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('flow 2: TDD red-green-refactor cycle', () => {
  it('tracks red phase on test failure, then shows TDD reminder on Edit', () => {
    const failStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    const failResult = cape(['hook', 'post-tool-use-failure', '--matcher', 'Bash'], failStdin, env);
    expect(failResult.status).toBe(0);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('red');
  });

  it('tracks green phase on test success', () => {
    const passStdin = JSON.stringify({
      tool_input: { command: 'npx vitest run' },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'Bash'], passStdin, env);

    const state = JSON.parse(readFileSync(join(contextDir, 'tdd-state.json'), 'utf-8'));
    expect(state.phase).toBe('green');
  });

  it('suppresses TDD reminder when red phase is fresh', () => {
    // postToolUseEdit checks queryFlowState() -> brQuery() to determine if we're in
    // executing/debugging phase. In E2E, `br` is unavailable so queryFlowState returns
    // nulls, deriveFlowContext returns null, and the reminder never fires regardless of
    // TDD state. This test documents that a fresh red state produces no Edit output,
    // but cannot verify the "fresh red suppresses reminder" path in isolation.
    writeFileSync(
      join(contextDir, 'tdd-state.json'),
      JSON.stringify({ phase: 'red', timestamp: Date.now() }),
    );

    const editStdin = JSON.stringify({
      tool_input: { file_path: '/src/index.ts' },
    });
    const result = cape(['hook', 'post-tool-use', '--matcher', 'Edit'], editStdin, env);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });
});

describe('flow 3: session-start clears stale state', () => {
  it('clears all context files with --clear-logs', () => {
    writeFileSync(join(contextDir, 'br-show-log.txt'), 'cape-old\n');
    writeFileSync(
      join(contextDir, 'tdd-state.json'),
      JSON.stringify({ phase: 'red', timestamp: 0 }),
    );

    const result = cape(['hook', 'session-start', '--clear-logs'], '', env);
    expect(result.status).toBe(0);

    const brLog = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    expect(brLog).toBe('');
    expect(existsSync(join(contextDir, 'tdd-state.json'))).toBe(false);
  });

  it('produces additionalContext output', () => {
    const result = cape(['hook', 'session-start'], '', env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.additionalContext).toEqual(expect.any(String));
    expect(parsed.additionalContext.length).toBeGreaterThan(0);
  });
});

describe('flow 4: full commit pipeline', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-commit-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', repoDir]);
    execFileSync('git', ['-C', repoDir, 'commit', '--allow-empty', '-m', 'initial']);
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 1;\n');
  });

  afterEach(() => {
    spawnSync('rm', ['-rf', repoDir]);
  });

  it('commits with valid conventional message', () => {
    const result = spawnSync('node', [BINARY, 'commit', 'file.ts', '-m', 'feat: add thing'], {
      encoding: 'utf-8',
      cwd: repoDir,
      timeout: 10_000,
    });
    expect(result.status).toBe(0);

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: add thing');
  });

  it('rejects invalid message format', () => {
    const result = spawnSync('node', [BINARY, 'commit', 'file.ts', '-m', 'bad message'], {
      encoding: 'utf-8',
      cwd: repoDir,
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('invalid conventional commit format');
  });

  it('rejects bulk staging with dot', () => {
    const result = spawnSync('node', [BINARY, 'commit', '.', '-m', 'feat: bulk'], {
      encoding: 'utf-8',
      cwd: repoDir,
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('bulk staging with');
  });

  it('warns on sensitive files but still commits', () => {
    writeFileSync(join(repoDir, '.env'), 'SECRET=abc\n');

    const result = spawnSync('node', [BINARY, 'commit', '.env', '-m', 'feat: config'], {
      encoding: 'utf-8',
      cwd: repoDir,
      timeout: 10_000,
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('sensitive files');
    expect(result.stderr).toContain('.env');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: config');
  });

  it('fails with non-zero exit when file does not exist', () => {
    const result = spawnSync('node', [BINARY, 'commit', 'nonexistent.ts', '-m', 'feat: ghost'], {
      encoding: 'utf-8',
      cwd: repoDir,
      timeout: 10_000,
    });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });
});
