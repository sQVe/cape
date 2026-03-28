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

  it('denies br update without prior br show', () => {
    const updateStdin = JSON.stringify({
      tool_input: { command: 'br update cape-abc --design "## New section"' },
    });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], updateStdin, env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain('br show');
  });
});

describe('flow 2: PR confirmation gate with TTL', () => {
  it('allows PR creation after user confirmation', () => {
    const confirmStdin = JSON.stringify({
      tool_input: {
        questions: [{ question: 'Ready to create the PR?' }],
        answers: { q1: 'yes' },
      },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'AskUserQuestion'], confirmStdin, env);
    expect(existsSync(join(contextDir, 'pr-confirmed.txt'))).toBe(true);

    const prStdin = JSON.stringify({
      tool_input: { command: 'gh pr create --title "feat: test" --body "#### Motivation\nstuff"' },
    });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], prStdin, {
      ...env,
      GIT_DIR: '/dev/null',
    });
    expect(result.status).toBe(0);
  });

  it('denies PR creation after TTL expiry', () => {
    writeFileSync(join(contextDir, 'pr-confirmed.txt'), String(Date.now() - 11 * 60 * 1000));

    const prStdin = JSON.stringify({
      tool_input: { command: 'gh pr create --title "feat: test" --body "stuff"' },
    });
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], prStdin, env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain('expired');
  });

  it('deletes confirmation on rejection', () => {
    writeFileSync(join(contextDir, 'pr-confirmed.txt'), String(Date.now()));

    const rejectStdin = JSON.stringify({
      tool_input: {
        questions: [{ question: 'Create the PR?' }],
        answers: { q1: 'cancel' },
      },
    });
    cape(['hook', 'post-tool-use', '--matcher', 'AskUserQuestion'], rejectStdin, env);
    expect(existsSync(join(contextDir, 'pr-confirmed.txt'))).toBe(false);
  });
});

describe('flow 3: TDD red-green-refactor cycle', () => {
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
});

describe('flow 4: session-start clears stale state', () => {
  it('clears all context files with --clear-logs', () => {
    writeFileSync(join(contextDir, 'br-show-log.txt'), 'cape-old\n');
    writeFileSync(
      join(contextDir, 'tdd-state.json'),
      JSON.stringify({ phase: 'red', timestamp: 0 }),
    );
    writeFileSync(join(contextDir, 'pr-confirmed.txt'), '123');

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
    expect(parsed).toHaveProperty('additionalContext');
  });
});

describe('flow 5: full commit pipeline', () => {
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
  });

  it('rejects bulk staging with dot', () => {
    const result = spawnSync('node', [BINARY, 'commit', '.', '-m', 'feat: bulk'], {
      encoding: 'utf-8',
      cwd: repoDir,
      timeout: 10_000,
    });
    expect(result.status).toBe(1);
  });
});
