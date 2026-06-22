import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { cleanupTestRepo, gitInRepo, initTestRepo, inProcess } from '../helpers';

const REPO_ROOT = join(import.meta.dirname, '..', '..', '..', '..');

describe('cape --help', () => {
  it('lists all subcommands', async () => {
    const result = await inProcess(['--help']);
    expect(result.status).toBe(0);
    for (const sub of ['check', 'commit', 'git', 'hook', 'pr', 'validate']) {
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
  });
});

describe('cape git diff', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = initTestRepo('cape-diff');
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 1;\n');
    gitInRepo(repoDir, 'add', 'file.ts');
    gitInRepo(repoDir, 'commit', '-m', 'add file');
  });

  afterEach(() => {
    cleanupTestRepo(repoDir);
  });

  it('outputs unstaged diff by default', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 2;\n');
    const result = await inProcess(['git', 'diff'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('file.ts');
  });

  it('outputs staged diff', async () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 3;\n');
    gitInRepo(repoDir, 'add', 'file.ts');
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
  });

  it('exits 1 with error for invalid scope', async () => {
    const result = await inProcess(['git', 'diff', 'bogus'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });

  it('outputs branch diff against main', async () => {
    gitInRepo(repoDir, 'checkout', '-b', 'feat/test-branch');
    writeFileSync(join(repoDir, 'new.ts'), 'export const y = 1;\n');
    gitInRepo(repoDir, 'add', 'new.ts');
    gitInRepo(repoDir, 'commit', '-m', 'add new');

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
    } finally {
      spawnSync('rm', ['-rf', valTmpDir]);
    }
  });
});

describe('cape commit', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = initTestRepo('cape-cmd');
  });

  afterEach(() => {
    cleanupTestRepo(repoDir);
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

    const log = gitInRepo(repoDir, 'log', '--oneline');
    expect(log).toContain('feat: add thing');
  });

  it('warns on stderr about sensitive files', async () => {
    writeFileSync(join(repoDir, '.env'), 'SECRET=123\n');
    const msg = 'feat: config\n\nAdd environment configuration.';
    const result = await inProcess(['commit', '.env', '-m', msg], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stderr.length).toBeGreaterThan(0);

    const log = gitInRepo(repoDir, 'log', '--oneline');
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

    const log = gitInRepo(repoDir, 'log', '--oneline');
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
    const emptyDir = initTestRepo('cape-check');

    try {
      const result = await inProcess(['check'], { cwd: emptyDir });
      expect(result.status).not.toBe(0);
    } finally {
      cleanupTestRepo(emptyDir);
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
  const stateJsonPath = join(REPO_ROOT, 'hooks', 'context', 'state.json');

  const cleanState = () => {
    try {
      unlinkSync(stateJsonPath);
    } catch {
      /* cleanup */
    }
  };

  beforeEach(cleanState);
  afterEach(cleanState);

  it('set writes a key to state.json', async () => {
    const result = await inProcess(['state', 'set', 'testKey', '{"foo":"bar"}']);
    expect(result.status).toBe(0);
  });

  it('list shows available keys when state.json is absent', async () => {
    const result = await inProcess(['state', 'list']);
    expect(result.status).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(0);
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

describe('cape pr create', () => {
  it('cape pr --help lists create subcommand', async () => {
    const result = await inProcess(['pr', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('create');
  });

  it('requires --title flag', async () => {
    const result = await inProcess(['pr', 'create', '--body', 'body text']);
    expect(result.status).not.toBe(0);
  });

  it('requires --body flag', async () => {
    const result = await inProcess(['pr', 'create', '--title', 'My PR']);
    expect(result.status).not.toBe(0);
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
  });

  it('rejects names without conventional prefix', async () => {
    const result = await inProcess(['git', 'create-branch', 'no-prefix-here']);
    expect(result.status).not.toBe(0);
  });
});

