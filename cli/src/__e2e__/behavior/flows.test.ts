import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cape, capeCmd } from '../helpers';

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

describe('flow 2: TDD reminder on Edit', () => {
  it('produces no TDD reminder without flowPhase in state', () => {
    writeFileSync(
      join(contextDir, 'state.json'),
      JSON.stringify({ tddState: { phase: 'red', timestamp: Date.now() } }),
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
  it('clears tddState from state.json with --clear-logs', () => {
    writeFileSync(join(contextDir, 'br-show-log.txt'), 'cape-old\n');
    writeFileSync(
      join(contextDir, 'state.json'),
      JSON.stringify({ tddState: { phase: 'red', timestamp: 0 } }),
    );

    const result = cape(['hook', 'session-start', '--clear-logs'], '', env);
    expect(result.status).toBe(0);

    const brLog = readFileSync(join(contextDir, 'br-show-log.txt'), 'utf-8');
    expect(brLog).toBe('');
    expect(existsSync(join(contextDir, 'state.json'))).toBe(false);
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
    const msg = 'feat: add thing\n\nAdd the thing to the project.';
    const result = capeCmd(['commit', 'file.ts', '-m', msg], { cwd: repoDir });
    expect(result.status).toBe(0);

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: add thing');
  });

  it('rejects invalid message format', () => {
    const result = capeCmd(['commit', 'file.ts', '-m', 'bad message'], { cwd: repoDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('invalid conventional commit format');
  });

  it('rejects bulk staging with dot', () => {
    const result = capeCmd(['commit', '.', '-m', 'feat: bulk'], { cwd: repoDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('bulk staging with');
  });

  it('warns on sensitive files but still commits', () => {
    writeFileSync(join(repoDir, '.env'), 'SECRET=abc\n');

    const msg = 'feat: config\n\nAdd environment configuration.';
    const result = capeCmd(['commit', '.env', '-m', msg], { cwd: repoDir });

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('sensitive files');
    expect(result.stderr).toContain('.env');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: config');
  });

  it('fails with non-zero exit when file does not exist', () => {
    const result = capeCmd(['commit', 'nonexistent.ts', '-m', 'feat: ghost'], { cwd: repoDir });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });
});
