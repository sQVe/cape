import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { inProcess } from '../helpers';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

describe('cape --help', () => {
  it('lists all subcommands', async () => {
    const result = await inProcess(['--help']);
    expect(result.status).toBe(0);
    for (const sub of ['br', 'check', 'commit', 'detect', 'git', 'hook', 'pr', 'validate']) {
      expect(result.stdout).toContain(sub);
    }
  });
});

describe('cape --version', () => {
  it('returns version string', async () => {
    const result = await inProcess(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^cape v\d+\.\d+\.\d+$/);
  });
});

describe('cape detect', () => {
  it('each entry has language, testFramework, linter, formatter fields', async () => {
    const result = await inProcess(['detect']);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.length).toBeGreaterThan(0);
    for (const entry of parsed) {
      expect(entry).toHaveProperty('language');
      expect(entry).toHaveProperty('testFramework');
      expect(entry).toHaveProperty('linter');
      expect(entry).toHaveProperty('formatter');
    }
  });

  it('detects typescript for the cape repo', async () => {
    const result = await inProcess(['detect']);
    const parsed = JSON.parse(result.stdout);
    const ts = parsed.find((e: { language: string }) => e.language === 'typescript');
    expect(ts).toBeDefined();
    expect(ts.testFramework).toBe('vite-plus');
  });
});

describe('cape git context', () => {
  it('returns valid JSON with all expected fields', async () => {
    const result = await inProcess(['git', 'context']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('mainBranch');
    expect(parsed).toHaveProperty('currentBranch');
    expect(parsed).toHaveProperty('status');
    expect(parsed).toHaveProperty('diffStat');
    expect(parsed).toHaveProperty('recentLog');
    expect(Array.isArray(parsed.status)).toBe(true);
    expect(Array.isArray(parsed.recentLog)).toBe(true);
  });

  it('exits 1 outside a git repo', async () => {
    const nonGitDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-nogit-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    const result = await inProcess(['git', 'context'], { cwd: nonGitDir });
    spawnSync('rm', ['-rf', nonGitDir]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('error');
  });
});

describe('cape br close-check', () => {
  it('cape br --help lists close-check subcommand', async () => {
    const result = await inProcess(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('close-check');
  });

  it('requires an id argument', async () => {
    const result = await inProcess(['br', 'close-check']);
    expect(result.status).not.toBe(0);
  });
});

describe('cape br close', () => {
  it('cape br --help lists close subcommand', async () => {
    const result = await inProcess(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('close');
  });

  it('requires an id argument', async () => {
    const result = await inProcess(['br', 'close']);
    expect(result.status).not.toBe(0);
  });
});

describe('cape br create', () => {
  it('cape br --help lists create subcommand', async () => {
    const result = await inProcess(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('create');
  });

  it('errors when --type is missing', async () => {
    const result = await inProcess(['br', 'create', 'Test', '--priority', 'P1', '--labels', 'hitl']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--type is required');
  });

  it('errors when --priority is missing', async () => {
    const result = await inProcess(['br', 'create', 'Test', '--type', 'task', '--labels', 'hitl']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--priority is required');
  });

  it('errors when --labels is missing', async () => {
    const result = await inProcess(['br', 'create', 'Test', '--type', 'task', '--priority', 'P1']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--labels is required');
  });

  it('rejects --design flag', async () => {
    const result = await inProcess([
      'br',
      'create',
      'Test',
      '--type',
      'task',
      '--priority',
      'P1',
      '--labels',
      'hitl',
      '--design',
      'content',
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('cape br design');
  });
});

describe('cape epic verify', () => {
  it('cape --help lists epic subcommand', async () => {
    const result = await inProcess(['--help']);
    expect(result.stdout).toContain('epic');
  });

  it('cape epic --help lists verify subcommand', async () => {
    const result = await inProcess(['epic', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('verify');
  });

  it('requires an id argument', async () => {
    const result = await inProcess(['epic', 'verify']);
    expect(result.status).not.toBe(0);
  });
});

describe('cape br template', () => {
  it('outputs epic template with required sections', async () => {
    const result = await inProcess(['br', 'template', '--type', 'epic']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## Requirements');
    expect(result.stdout).toContain('## Success criteria');
    expect(result.stdout).toContain('## Anti-patterns');
    expect(result.stdout).toContain('## Approach');
  });

  it('outputs task template', async () => {
    const result = await inProcess(['br', 'template', '--type', 'task']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## Goal');
    expect(result.stdout).toContain('## Behaviors');
  });

  it('outputs bug template', async () => {
    const result = await inProcess(['br', 'template', '--type', 'bug']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## Reproduction steps');
  });

  it('exits 1 for unknown type', async () => {
    const result = await inProcess(['br', 'template', '--type', 'unknown']);
    expect(result.status).toBe(1);
  });
});

describe('cape git validate-branch', () => {
  it('validates a well-formed branch name', async () => {
    const result = await inProcess(['git', 'validate-branch', 'feat/my-feature']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
  });

  it('rejects a branch that already exists', async () => {
    const result = await inProcess(['git', 'validate-branch', 'main']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout.split('\n')[0]!);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.some((e: string) => e.includes('already exists'))).toBe(true);
  });

  it('warns on missing prefix', async () => {
    const result = await inProcess(['git', 'validate-branch', 'no-prefix-branch']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout.split('\n')[0]!);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.some((e: string) => e.includes('prefix'))).toBe(true);
  });
});

describe('cape git diff', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-diff-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', repoDir]);
    execFileSync('git', ['-C', repoDir, 'commit', '--allow-empty', '-m', 'initial']);
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 1;\n');
    execFileSync('git', ['-C', repoDir, 'add', 'file.ts']);
    execFileSync('git', ['-C', repoDir, 'commit', '-m', 'add file']);
  });

  afterEach(() => {
    spawnSync('rm', ['-rf', repoDir]);
  });

  it('outputs unstaged diff by default', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 2;\n');
    const result = await inProcess(['git', 'diff'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('file.ts');
  });

  it('outputs staged diff', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 3;\n');
    execFileSync('git', ['-C', repoDir, 'add', 'file.ts']);
    const result = await inProcess(['git', 'diff', 'staged'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('file.ts');
  });

  it('outputs empty when no changes', async () => {
    const result = await inProcess(['git', 'diff'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 1 outside a git repo', async () => {
    const nonGitDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-nodiff-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    const result = await inProcess(['git', 'diff'], { cwd: nonGitDir });
    spawnSync('rm', ['-rf', nonGitDir]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('error');
  });

  it('exits 1 with error for invalid scope', async () => {
    const result = await inProcess(['git', 'diff', 'bogus'], { cwd: repoDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('invalid scope');
  });

  it('outputs branch diff against main', async () => {
    execFileSync('git', ['-C', repoDir, 'checkout', '-b', 'feat/test-branch']);
    writeFileSync(join(repoDir, 'new.ts'), 'export const y = 1;\n');
    execFileSync('git', ['-C', repoDir, 'add', 'new.ts']);
    execFileSync('git', ['-C', repoDir, 'commit', '-m', 'add new']);

    const result = await inProcess(['git', 'diff', 'branch'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('new.ts');
  });
});

describe('cape validate', () => {
  it('returns JSON with passed and failed counts', async () => {
    const result = await inProcess(['validate']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('passed');
    expect(parsed).toHaveProperty('failed');
    expect(parsed).toHaveProperty('results');
    expect(typeof parsed.passed).toBe('number');
    expect(typeof parsed.failed).toBe('number');
    expect(parsed.passed).toBeGreaterThan(0);
  });

  it('filters to only skill files with "skills" argument', async () => {
    const result = await inProcess(['validate', 'skills']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    for (const entry of parsed.results) {
      expect(entry.file).toMatch(/^skills\//);
    }
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it('filters to only agent files with "agents" argument', async () => {
    const result = await inProcess(['validate', 'agents']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    for (const entry of parsed.results) {
      expect(entry.file).toMatch(/^agents\//);
    }
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it('filters to only command files with "commands" argument', async () => {
    const result = await inProcess(['validate', 'commands']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    for (const entry of parsed.results) {
      expect(entry.file).toMatch(/^commands\//);
    }
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it('exits 1 for a malformed skill file', async () => {
    const badDir = join(REPO_ROOT, 'skills', '_test_bad');
    const badFile = join(badDir, 'SKILL.md');
    mkdirSync(badDir, { recursive: true });
    writeFileSync(badFile, 'no frontmatter no tags\n');

    try {
      const result = await inProcess(['validate', badFile]);
      expect(result.status).toBe(1);
      const jsonLine = result.stdout.split('\n')[0]!;
      const parsed = JSON.parse(jsonLine);
      expect(parsed.failed).toBe(1);
      expect(parsed.results[0].errors.length).toBeGreaterThan(0);
    } finally {
      rmSync(badDir, { recursive: true, force: true });
    }
  });

  it('exits 1 for unknown file type', async () => {
    const valTmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-val-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    const unknownFile = join(valTmpDir, 'random.txt');
    writeFileSync(unknownFile, 'not a skill or agent\n');

    try {
      const result = await inProcess(['validate', unknownFile]);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('Unknown file type');
    } finally {
      spawnSync('rm', ['-rf', valTmpDir]);
    }
  });
});

describe('cape commit', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-cmd-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', repoDir]);
    execFileSync('git', ['-C', repoDir, 'commit', '--allow-empty', '-m', 'initial']);
  });

  afterEach(() => {
    spawnSync('rm', ['-rf', repoDir]);
  });

  it('exits 1 with no files argument', async () => {
    const result = await inProcess(['commit', '-m', 'feat: x'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });

  it('succeeds with valid file and message in a temp git repo', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 1;\n');
    const msg = 'feat: add thing\n\nAdd the thing to the project.';
    const result = await inProcess(['commit', 'file.ts', '-m', msg], {
      cwd: repoDir,
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.message).toBe(msg);
    expect(parsed.files).toContain('file.ts');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: add thing');
  });

  it('warns on stderr about sensitive files', async () => {
    writeFileSync(join(repoDir, '.env'), 'SECRET=123\n');
    const msg = 'feat: config\n\nAdd environment configuration.';
    const result = await inProcess(['commit', '.env', '-m', msg], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('sensitive');
    expect(result.stderr).toContain('.env');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: config');
  });

  it('rejects invalid conventional commit message', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const y = 2;\n');
    const result = await inProcess(['commit', 'file.ts', '-m', 'bad message'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });

  it('rejects bulk staging with dot', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const z = 3;\n');
    const result = await inProcess(['commit', '.', '-m', 'feat: bulk'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });

  it('succeeds with multiple files', async () => {
    writeFileSync(join(repoDir, 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(repoDir, 'b.ts'), 'export const b = 2;\n');

    const msg = 'feat: add two files\n\nAdd both source files.';
    const result = await inProcess(['commit', 'a.ts', 'b.ts', '-m', msg], {
      cwd: repoDir,
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.files).toContain('a.ts');
    expect(parsed.files).toContain('b.ts');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: add two files');
  });
});

describe('cape check', () => {
  it('cape --help lists check subcommand', async () => {
    const result = await inProcess(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('check');
  });

  it('exits 1 in a repo with no detected ecosystem', async () => {
    const emptyDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-check-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', emptyDir]);
    execFileSync('git', ['-C', emptyDir, 'commit', '--allow-empty', '-m', 'initial']);

    try {
      const result = await inProcess(['check'], { cwd: emptyDir });
      expect(result.status).not.toBe(0);
    } finally {
      spawnSync('rm', ['-rf', emptyDir]);
    }
  });
});

describe('cape pr', () => {
  describe('template', () => {
    it('returns JSON with sections array', async () => {
      const result = await inProcess(['pr', 'template']);
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('sections');
      expect(Array.isArray(parsed.sections)).toBe(true);
      expect(parsed.sections.length).toBeGreaterThan(0);
    });

    it('includes source field indicating repo or default', async () => {
      const result = await inProcess(['pr', 'template']);
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(['repo', 'default']).toContain(parsed.source);
    });
  });

  describe('validate', () => {
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-pr-XXXXXX')], {
        encoding: 'utf-8',
      }).trim();
    });

    afterEach(() => {
      spawnSync('rm', ['-rf', tmpDir]);
    });

    it('exits 1 when no file or --stdin provided', async () => {
      const result = await inProcess(['pr', 'validate']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('provide <file> or --stdin');
    });

    it('validates a PR body file with all sections present', async () => {
      const template = await inProcess(['pr', 'template']);
      const parsed = JSON.parse(template.stdout);
      const body = parsed.sections.map((s: string) => `#### ${s}\n\nContent here.\n`).join('\n');
      const bodyFile = join(tmpDir, 'pr-body.md');
      writeFileSync(bodyFile, body);

      const result = await inProcess(['pr', 'validate', bodyFile]);
      expect(result.status).toBe(0);
      const validated = JSON.parse(result.stdout);
      expect(validated.valid).toBe(true);
      expect(validated.missing).toEqual([]);
    });

    it('reports missing sections for empty body', async () => {
      const bodyFile = join(tmpDir, 'empty-pr.md');
      writeFileSync(bodyFile, 'No sections here.\n');

      const result = await inProcess(['pr', 'validate', bodyFile]);
      expect(result.status).toBe(1);
      const validated = JSON.parse(result.stdout.split('\n')[0]!);
      expect(validated.valid).toBe(false);
      expect(validated.missing.length).toBeGreaterThan(0);
    });

    it('reports extra sections not in template', async () => {
      const template = await inProcess(['pr', 'template']);
      const parsed = JSON.parse(template.stdout);
      const body = [
        ...parsed.sections.map((s: string) => `#### ${s}\n\nContent.\n`),
        '#### Bonus section\n\nExtra.\n',
      ].join('\n');
      const bodyFile = join(tmpDir, 'extra-pr.md');
      writeFileSync(bodyFile, body);

      const result = await inProcess(['pr', 'validate', bodyFile]);
      expect(result.status).toBe(0);
      const validated = JSON.parse(result.stdout);
      expect(validated.valid).toBe(true);
      expect(validated.extra).toContain('Bonus section');
    });
  });
});

describe('cape state', () => {
  const stateJsonPath = join(REPO_ROOT, 'cli', 'hooks', 'context', 'state.json');

  afterEach(() => {
    try {
      unlinkSync(stateJsonPath);
    } catch {
      /* cleanup */
    }
  });

  it('set writes a key to state.json', async () => {
    const result = await inProcess(['state', 'set', 'testKey', '{"foo":"bar"}']);
    expect(result.status).toBe(0);
  });

  it('list shows available keys when state.json is absent', async () => {
    const result = await inProcess(['state', 'list']);
    expect(result.stdout).toContain('Active state: None');
    expect(result.stdout).toContain('Available keys');
  });

  it('clear is a no-op when key is absent', async () => {
    const result = await inProcess(['state', 'clear', 'nonExistent']);
    expect(result.status).toBe(0);
  });

  it('reset removes state.json', async () => {
    await inProcess(['state', 'set', 'testKey']);
    const result = await inProcess(['state', 'reset']);
    expect(result.status).toBe(0);
  });
});

describe('cape br validate', () => {
  it('exits 1 when neither id nor --type provided', async () => {
    const result = await inProcess(['br', 'validate']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('provide either <id> or --type');
  });
});

describe('cape br design', () => {
  it('cape br --help lists design subcommand', async () => {
    const result = await inProcess(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('design');
  });
});

describe('cape detect --map', () => {
  it('returns JSON mapping source files to test files', async () => {
    const result = await inProcess(['detect', '--map', '.']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(typeof parsed).toBe('object');
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  it('values are either a test path or null', async () => {
    const result = await inProcess(['detect', '--map', '.']);
    const parsed = JSON.parse(result.stdout);
    for (const value of Object.values(parsed)) {
      expect(value === null || typeof value === 'string').toBe(true);
    }
  });
});

describe('cape br update', () => {
  it('cape br --help lists update subcommand', async () => {
    const result = await inProcess(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('update');
  });

  it('requires an id argument', async () => {
    const result = await inProcess(['br', 'update']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('id');
  });

  it('rejects hyphenated status values', async () => {
    const result = await inProcess(['br', 'update', 'bd-test', '--status', 'in-progress']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('in_progress');
  });

  it('rejects done as status and redirects to cape br close', async () => {
    const result = await inProcess(['br', 'update', 'bd-test', '--status', 'done']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('cape br close');
  });
});

describe('cape pr create', () => {
  it('cape pr --help lists create subcommand', async () => {
    const result = await inProcess(['pr', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('create');
  });

  it('requires --title flag', async () => {
    const result = await inProcess(['pr', 'create', '--body', 'body text']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--title');
  });

  it('requires --body flag', async () => {
    const result = await inProcess(['pr', 'create', '--title', 'My PR']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('--body');
  });
});

describe('cape git create-branch', () => {
  it('cape git --help lists create-branch subcommand', async () => {
    const result = await inProcess(['git', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('create-branch');
  });

  it('requires a name argument', async () => {
    const result = await inProcess(['git', 'create-branch']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('name');
  });

  it('rejects names without conventional prefix', async () => {
    const result = await inProcess(['git', 'create-branch', 'no-prefix-here']);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('feat');
  });
});

describe('cape test', () => {
  it('cape --help lists test subcommand', async () => {
    const result = await inProcess(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('test');
  });

  it('cape test --help describes TDD state output', async () => {
    const result = await inProcess(['test', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('TDD state');
  });
});
