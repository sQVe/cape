import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cape, cleanupTestRepo, initTestRepo } from '../helpers';

const bashInput = (command: string) => JSON.stringify({ tool_input: { command } });

const expectDeny = (result: { stdout: string; status: number }, reasonSubstring: string) => {
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
  expect(parsed.hookSpecificOutput.permissionDecisionReason).toContain(reasonSubstring);
  return parsed;
};

const expectPassThrough = (result: { stdout: string; status: number }) => {
  expect(result.status).toBe(0);
  expect(result.stdout).toBe('');
};

let tmpDir: string;
let contextDir: string;
let env: Record<string, string>;

beforeEach(() => {
  tmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-pre-XXXXXX')], {
    encoding: 'utf-8',
  }).trim();
  contextDir = join(tmpDir, 'hooks', 'context');
  mkdirSync(contextDir, { recursive: true });
  env = { CLAUDE_PLUGIN_ROOT: tmpDir };
});

afterEach(() => {
  spawnSync('rm', ['-rf', tmpDir]);
});

describe('redirect tier', () => {
  it('denies raw git commit', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git commit -m "feat: add"'),
      env,
    );
    expectDeny(result, 'cape commit');
  });

  // it('denies raw gh pr create', ...)
  // it('denies raw git checkout -b', ...)
  // it('denies raw git switch -c', ...)
  // it('denies raw git branch <name>', ...)
});

describe('block tier', () => {
  it('blocks gh pr merge', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr merge 42'),
      env,
    );
    expectDeny(result, 'merge');
  });

  it('blocks gh pr close', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr close 42'),
      env,
    );
    expectDeny(result, 'close');
  });

  it('blocks git commit --amend', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git commit --amend'),
      env,
    );
    expectDeny(result, 'amend');
  });

  it('blocks git commit --amend even with -m', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git commit -m "fix" --amend'),
      env,
    );
    expectDeny(result, 'amend');
  });
});

describe('push branch check', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = initTestRepo('cape-repo');
  });

  afterEach(() => {
    cleanupTestRepo(repoDir);
  });

  it('denies push from default branch', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git push origin main'),
      { ...env, GIT_DIR: join(repoDir, '.git'), GIT_WORK_TREE: repoDir },
    );
    expectDeny(result, 'Push from `main` is blocked');
  });
});

describe('stripQuotedContent prevents false positives', () => {
  it('does not false-positive on br create inside double quotes', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('echo "br create should not trigger"'),
      env,
    );
    expectPassThrough(result);
  });

  it('does not false-positive on git commit inside single quotes', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput("echo 'git commit should not trigger'"),
      env,
    );
    expectPassThrough(result);
  });

  it('does not false-positive on patterns inside heredocs', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('cat <<EOF\nbr create\ngit commit\nEOF'),
      env,
    );
    expectPassThrough(result);
  });

  it('does not false-positive on br create inside --description value', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --description "br create is mentioned here"'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('pass-through for benign commands', () => {
  it('allows echo', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('echo hello'),
      env,
    );
    expectPassThrough(result);
  });

  it('allows npm install', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('npm install'),
      env,
    );
    expectPassThrough(result);
  });

  it('allows br show', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br show cape-abc'),
      env,
    );
    expectPassThrough(result);
  });

  it('allows br list', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], bashInput('br list'), env);
    expectPassThrough(result);
  });

  it('allows git status', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git status'),
      env,
    );
    expectPassThrough(result);
  });

  it('allows git branch -d (deletion)', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git branch -d old-branch'),
      env,
    );
    expectPassThrough(result);
  });
});
