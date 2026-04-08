import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cape, cleanupTestRepo, initTestRepo } from '../helpers';

const bashInput = (command: string) => JSON.stringify({ tool_input: { command } });

const skillInput = (skill: string) => JSON.stringify({ tool_input: { skill } });

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

const expectWarn = (result: { stdout: string; status: number }, contextSubstring: string) => {
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout);
  expect(parsed.additionalContext).toContain(contextSubstring);
  return parsed;
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

  // Re-enable as each cape command is implemented:
  // it('denies raw br create', ...)
  // it('denies raw br q', ...)
  // it('denies raw br update --status', ...)
  // it('allows br update without --status', ...)
  it('denies raw br close', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br close cape-2v2.3'),
      env,
    );
    expectDeny(result, 'cape br close');
  });

  it('passes through cape br close', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('cape br close cape-2v2.3'),
      env,
    );
    expectPassThrough(result);
  });
  // it('denies raw gh pr create', ...)
  // it('denies raw git checkout -b', ...)
  // it('denies raw git switch -c', ...)
  // it('denies raw git branch <name>', ...)
});

describe('block tier', () => {
  it('blocks git push --force', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git push --force origin main'),
      env,
    );
    expectDeny(result, 'Force push');
  });

  it('blocks git push -f', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git push -f'),
      env,
    );
    expectDeny(result, 'Force push');
  });

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

describe('warn tier', () => {
  it('warns on git reset --hard', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git reset --hard HEAD~1'),
      env,
    );
    expectWarn(result, 'reset --hard');
  });

  it('warns on git checkout --', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git checkout -- src/foo.ts'),
      env,
    );
    expectWarn(result, 'checkout --');
  });

  it('warns on git clean -f', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git clean -f'),
      env,
    );
    expectWarn(result, 'clean -f');
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
    expectDeny(result, 'Cannot push');
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
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br list'),
      env,
    );
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

  it('does not block git push --force-with-lease as force push', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git push --force-with-lease origin feat'),
      env,
    );
    if (result.stdout) {
      const parsed = JSON.parse(result.stdout);
      expect(parsed.hookSpecificOutput?.permissionDecisionReason ?? '').not.toContain(
        'Force push',
      );
    }
  });
});

describe('skill gate: non-gated skills pass through', () => {
  it.each([
    'cape:commit',
    'cape:review',
    'cape:beads',
    'cape:branch',
    'cape:brainstorm',
    'cape:pr',
    'cape:refactor',
    'cape:write-plan',
  ])('allows non-gated skill %s', (skill) => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], skillInput(skill), env);
    expectPassThrough(result);
  });
});

describe('skill gate: internal skills require active workflow', () => {
  it('denies expand-task when workflowActive is absent from state.json', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:expand-task'),
      env,
    );
    expectDeny(result, 'internal');
  });

  it('allows expand-task when workflowActive exists in state.json', () => {
    writeFileSync(
      join(contextDir, 'state.json'),
      JSON.stringify({ workflowActive: { value: true, timestamp: Date.now() } }),
    );
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:expand-task'),
      env,
    );
    expectPassThrough(result);
  });

  it('denies test-driven-development when workflowActive is absent from state.json', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:test-driven-development'),
      env,
    );
    expectDeny(result, 'internal');
  });

  it('allows test-driven-development when workflowActive exists in state.json', () => {
    writeFileSync(
      join(contextDir, 'state.json'),
      JSON.stringify({ workflowActive: { value: true, timestamp: Date.now() } }),
    );
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:test-driven-development'),
      env,
    );
    expectPassThrough(result);
  });
});
