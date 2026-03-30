import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
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

describe('br create missing flags', () => {
  it('denies br create missing --type', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --priority 2 --labels foo'),
      env,
    );
    expectDeny(result, '--type');
  });

  it('denies br create missing --priority', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --type task --labels foo'),
      env,
    );
    expectDeny(result, '--priority');
  });

  it('denies br create missing --labels', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --type task --priority 2'),
      env,
    );
    expectDeny(result, '--labels');
  });
});

describe('br create short flags', () => {
  it('allows br create with -t -p -l short flags', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create -t task -p 2 -l foo'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('br create without --description', () => {
  it('passes when --description is absent and all required flags present', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --type task --priority 2 --labels foo'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('br create --design flag', () => {
  it('denies --design on br create', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --design "## New section" --type task --priority 2 --labels foo'),
      env,
    );
    expectDeny(result, '--description');
  });
});

describe('br create description header validation', () => {
  it('denies task missing ## Goal', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type task --priority 2 --labels foo --description "## Behaviors\n- X\n## Success criteria\nDone"',
      ),
      env,
    );
    expectDeny(result, '## Goal');
  });

  it('denies task missing ## Behaviors', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Success criteria\nDone"',
      ),
      env,
    );
    expectDeny(result, '## Behaviors');
  });

  it('denies task missing ## Success criteria', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- X"',
      ),
      env,
    );
    expectDeny(result, '## Success criteria');
  });

  it('allows task with all required headers', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type task --priority 2 --labels foo --description "## Goal\nDo thing\n## Behaviors\n- X\n## Success criteria\nDone"',
      ),
      env,
    );
    expectPassThrough(result);
  });

  it('denies bug without ## Reproduction steps or ## Evidence', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type bug --priority 2 --labels foo --description "## Summary\nBroken"',
      ),
      env,
    );
    expectDeny(result, '## Reproduction steps');
  });

  it('denies epic without ## Requirements', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type epic --priority 2 --labels foo --description "## Success criteria\nDone"',
      ),
      env,
    );
    expectDeny(result, '## Requirements');
  });

  it('denies epic without ## Success criteria', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput(
        'br create --type epic --priority 2 --labels foo --description "## Requirements\nStuff"',
      ),
      env,
    );
    expectDeny(result, '## Success criteria');
  });
});

describe('br update status guards', () => {
  it('denies --status in-progress (hyphen)', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --status in-progress'),
      env,
    );
    expectDeny(result, 'in_progress');
  });

  it('denies --status done', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --status done'),
      env,
    );
    expectDeny(result, 'br close');
  });

  it('allows --status in_progress (underscore)', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --status in_progress'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('git bulk staging guards', () => {
  it('denies git add .', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], bashInput('git add .'), env);
    expectDeny(result, 'git add .');
  });

  it('denies git add -A', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git add -A'),
      env,
    );
    expectDeny(result, 'git add -A');
  });

  it('denies git add --all', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git add --all'),
      env,
    );
    expectDeny(result, 'git add -A');
  });

  it('allows git add with specific file', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git add src/foo.ts'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('gh pr create body rules', () => {
  it('denies invented sections in PR body', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "\n## Summary\nstuff"'),
      { ...env, GIT_DIR: '/dev/null' },
    );
    expectDeny(result, 'invented sections');
  });

  it('denies ## Root cause section', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "\n## Root cause\nstuff"'),
      { ...env, GIT_DIR: '/dev/null' },
    );
    expectDeny(result, 'invented sections');
  });

  it('denies ## Overview section', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "\n## Overview\nstuff"'),
      { ...env, GIT_DIR: '/dev/null' },
    );
    expectDeny(result, 'invented sections');
  });

  it('denies ## Background section', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "\n## Background\nstuff"'),
      { ...env, GIT_DIR: '/dev/null' },
    );
    expectDeny(result, 'invented sections');
  });

  it('denies ## Description section', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "\n## Description\nstuff"'),
      { ...env, GIT_DIR: '/dev/null' },
    );
    expectDeny(result, 'invented sections');
  });

  it('allows valid template headers', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --body "#### Motivation\nstuff"'),
      { ...env, GIT_DIR: '/dev/null' },
    );
    expectPassThrough(result);
  });
});

describe('gh pr create from default branch', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-repo-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', repoDir]);
    execFileSync('git', ['-C', repoDir, 'checkout', '-b', 'main']);
    execFileSync('git', ['-C', repoDir, 'commit', '--allow-empty', '-m', 'initial']);
  });

  afterEach(() => {
    spawnSync('rm', ['-rf', repoDir]);
  });

  it('denies PR creation from default branch', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "#### Motivation\nstuff"'),
      { ...env, GIT_DIR: join(repoDir, '.git'), GIT_WORK_TREE: repoDir },
    );
    expectDeny(result, 'Cannot create a PR from');
  });
});

describe('br close stop-reinforcement', () => {
  it('produces additionalContext for br close', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br close cape-2v2.3'),
      env,
    );
    expect(result.status).toBe(0);
    expect(result.stdout).not.toBe('');
    const parsed = JSON.parse(result.stdout);
    expect(parsed.additionalContext).toContain('STOP');
    expect(parsed.additionalContext).toContain('checkpoint');
  });

  it('produces additionalContext for br close without arguments', () => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Bash'], bashInput('br close'), env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.additionalContext).toContain('STOP');
    expect(parsed.additionalContext).toContain('checkpoint');
  });
});

describe('br show requirement', () => {
  it('allows br update --design when br-show-log.txt contains the ID', () => {
    writeFileSync(join(contextDir, 'br-show-log.txt'), 'cape-abc\n');
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --design "## New"'),
      env,
    );
    expectPassThrough(result);
  });

  it('denies br update --design when br-show-log.txt is missing', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --design "## New"'),
      env,
    );
    expectDeny(result, 'br show');
  });

  it('denies br update --design when br-show-log.txt has different IDs', () => {
    writeFileSync(join(contextDir, 'br-show-log.txt'), 'cape-xyz\ncape-def\n');
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br update cape-abc --design "## New"'),
      env,
    );
    expectDeny(result, 'br show');
  });
});

describe('PR creation sub-guards', () => {
  it('denies when there are uncommitted changes', () => {
    const repoDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-dirty-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', repoDir]);
    execFileSync('git', ['-C', repoDir, 'checkout', '-b', 'feature']);
    execFileSync('git', ['-C', repoDir, 'commit', '--allow-empty', '-m', 'initial']);
    writeFileSync(join(repoDir, 'dirty.txt'), 'uncommitted');

    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('gh pr create --title "feat: test" --body "stuff"'),
      { ...env, GIT_DIR: join(repoDir, '.git'), GIT_WORK_TREE: repoDir },
    );
    expectDeny(result, 'Uncommitted');
    spawnSync('rm', ['-rf', repoDir]);
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
  ])('allows non-gated skill %s', (skill) => {
    const result = cape(['hook', 'pre-tool-use', '--matcher', 'Skill'], skillInput(skill), env);
    expectPassThrough(result);
  });
});

describe('skill gate: write-plan requires brainstorm artifact', () => {
  it('denies write-plan when brainstorm-summary.txt is absent', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:write-plan'),
      env,
    );
    expectDeny(result, 'brainstorm');
  });

  it('allows write-plan when brainstorm-summary.txt exists', () => {
    writeFileSync(join(contextDir, 'brainstorm-summary.txt'), 'true');
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:write-plan'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('skill gate: internal skills require active workflow', () => {
  it('denies expand-task when workflow-active.txt is absent', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:expand-task'),
      env,
    );
    expectDeny(result, 'internal');
  });

  it('allows expand-task when workflow-active.txt exists', () => {
    writeFileSync(join(contextDir, 'workflow-active.txt'), 'true');
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:expand-task'),
      env,
    );
    expectPassThrough(result);
  });

  it('denies test-driven-development when workflow-active.txt is absent', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:test-driven-development'),
      env,
    );
    expectDeny(result, 'internal');
  });

  it('allows test-driven-development when workflow-active.txt exists', () => {
    writeFileSync(join(contextDir, 'workflow-active.txt'), 'true');
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Skill'],
      skillInput('cape:test-driven-development'),
      env,
    );
    expectPassThrough(result);
  });
});

describe('multiple violations accumulate into one deny', () => {
  it('reports all missing flags in one deny for br create', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --design "stuff"'),
      env,
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
    const reason = parsed.hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain('--description');
    expect(reason).toContain('--type');
    expect(reason).toContain('--priority');
    expect(reason).toContain('--labels');
  });

  it('reports both header and flag violations together', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('br create --type task --priority 2 --description "## Goal\nDo thing"'),
      env,
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.hookSpecificOutput.permissionDecision).toBe('deny');
    const reason = parsed.hookSpecificOutput.permissionDecisionReason;
    expect(reason).toContain('--labels');
    expect(reason).toContain('## Behaviors');
    expect(reason).toContain('## Success criteria');
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

  it('allows git commit', () => {
    const result = cape(
      ['hook', 'pre-tool-use', '--matcher', 'Bash'],
      bashInput('git commit -m "feat: test"'),
      env,
    );
    expectPassThrough(result);
  });
});
