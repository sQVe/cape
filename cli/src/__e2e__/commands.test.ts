import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BINARY = join(import.meta.dirname, '..', '..', 'dist', 'index.mjs');
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

const cape = (
  args: string[],
  options: { cwd?: string } = {},
): { stdout: string; stderr: string; status: number } => {
  const result = spawnSync('node', [BINARY, ...args], {
    encoding: 'utf-8',
    cwd: options.cwd ?? REPO_ROOT,
    timeout: 10_000,
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    status: result.status ?? 1,
  };
};

describe('cape --help', () => {
  it('lists all subcommands', () => {
    const result = cape(['--help']);
    expect(result.status).toBe(0);
    for (const sub of ['br', 'check', 'commit', 'detect', 'git', 'hook', 'pr', 'validate']) {
      expect(result.stdout).toContain(sub);
    }
  });
});

describe('cape --version', () => {
  it('returns version string', () => {
    const result = cape(['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout).toMatch(/^cape v\d+\.\d+\.\d+$/);
  });
});

describe('cape detect', () => {
  it('each entry has language, testFramework, linter, formatter fields', () => {
    const result = cape(['detect']);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.length).toBeGreaterThan(0);
    for (const entry of parsed) {
      expect(entry).toHaveProperty('language');
      expect(entry).toHaveProperty('testFramework');
      expect(entry).toHaveProperty('linter');
      expect(entry).toHaveProperty('formatter');
    }
  });

  it('detects typescript for the cape repo', () => {
    const result = cape(['detect']);
    const parsed = JSON.parse(result.stdout);
    const ts = parsed.find((e: { language: string }) => e.language === 'typescript');
    expect(ts).toBeDefined();
    expect(ts.testFramework).toBe('vitest');
  });
});

describe('cape git context', () => {
  it('returns valid JSON with all expected fields', () => {
    const result = cape(['git', 'context']);
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

  it('exits 1 outside a git repo', () => {
    const nonGitDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-nogit-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    const result = cape(['git', 'context'], { cwd: nonGitDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('error');
  });
});

describe('cape br close-check', () => {
  it('cape br --help lists close-check subcommand', () => {
    const result = cape(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('close-check');
  });
});

describe('cape epic verify', () => {
  it('cape --help lists epic subcommand', () => {
    const result = cape(['--help']);
    expect(result.stdout).toContain('epic');
  });

  it('cape epic --help lists verify subcommand', () => {
    const result = cape(['epic', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('verify');
  });
});

describe('cape br template', () => {
  it('outputs epic template with required sections', () => {
    const result = cape(['br', 'template', '--type', 'epic']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## Requirements');
    expect(result.stdout).toContain('## Success criteria');
    expect(result.stdout).toContain('## Anti-patterns');
    expect(result.stdout).toContain('## Approach');
  });

  it('outputs task template', () => {
    const result = cape(['br', 'template', '--type', 'task']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## Goal');
    expect(result.stdout).toContain('## Behaviors');
  });

  it('outputs bug template', () => {
    const result = cape(['br', 'template', '--type', 'bug']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('## Reproduction steps');
  });

  it('exits 1 for unknown type', () => {
    const result = cape(['br', 'template', '--type', 'unknown']);
    expect(result.status).toBe(1);
  });
});

describe('cape git validate-branch', () => {
  it('validates a well-formed branch name', () => {
    const result = cape(['git', 'validate-branch', 'feat/my-feature']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
  });

  it('rejects a branch that already exists', () => {
    const result = cape(['git', 'validate-branch', 'main']);
    expect(result.status).toBe(1);
    const parsed = JSON.parse(result.stdout.split('\n')[0]!);
    expect(parsed.valid).toBe(false);
    expect(parsed.errors.some((e: string) => e.includes('already exists'))).toBe(true);
  });

  it('warns on missing prefix', () => {
    const result = cape(['git', 'validate-branch', 'no-prefix-branch']);
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

  it('outputs unstaged diff by default', () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 2;\n');
    const result = cape(['git', 'diff'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('file.ts');
  });

  it('outputs staged diff', () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 3;\n');
    execFileSync('git', ['-C', repoDir, 'add', 'file.ts']);
    const result = cape(['git', 'diff', 'staged'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('file.ts');
  });

  it('outputs empty when no changes', () => {
    const result = cape(['git', 'diff'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('');
  });

  it('exits 1 outside a git repo', () => {
    const nonGitDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-nodiff-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    const result = cape(['git', 'diff'], { cwd: nonGitDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('error');
  });
});

describe('cape validate', () => {
  it('returns JSON with passed and failed counts', () => {
    const result = cape(['validate']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed).toHaveProperty('passed');
    expect(parsed).toHaveProperty('failed');
    expect(parsed).toHaveProperty('results');
    expect(typeof parsed.passed).toBe('number');
    expect(typeof parsed.failed).toBe('number');
    expect(parsed.passed).toBeGreaterThan(0);
  });

  it('filters to only skill files with "skills" argument', () => {
    const result = cape(['validate', 'skills']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    for (const entry of parsed.results) {
      expect(entry.file).toMatch(/^skills\//);
    }
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it('filters to only agent files with "agents" argument', () => {
    const result = cape(['validate', 'agents']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    for (const entry of parsed.results) {
      expect(entry.file).toMatch(/^agents\//);
    }
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it('filters to only command files with "commands" argument', () => {
    const result = cape(['validate', 'commands']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    for (const entry of parsed.results) {
      expect(entry.file).toMatch(/^commands\//);
    }
    expect(parsed.results.length).toBeGreaterThan(0);
  });

  it('exits 1 for a malformed skill file', () => {
    const badDir = join(REPO_ROOT, 'skills', '_test_bad');
    const badFile = join(badDir, 'SKILL.md');
    mkdirSync(badDir, { recursive: true });
    writeFileSync(badFile, 'no frontmatter no tags\n');

    try {
      const result = cape(['validate', badFile]);
      expect(result.status).toBe(1);
      const jsonLine = result.stdout.split('\n')[0]!;
      const parsed = JSON.parse(jsonLine);
      expect(parsed.failed).toBe(1);
      expect(parsed.results[0].errors.length).toBeGreaterThan(0);
    } finally {
      rmSync(badDir, { recursive: true, force: true });
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

  it('exits 1 with no files argument', () => {
    const result = cape(['commit', '-m', 'feat: x'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });

  it('succeeds with valid file and message in a temp git repo', () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 1;\n');
    const result = cape(['commit', 'file.ts', '-m', 'feat: add thing'], { cwd: repoDir });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.message).toBe('feat: add thing');
    expect(parsed.files).toContain('file.ts');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: add thing');
  });

  it('warns on stderr about sensitive files', () => {
    writeFileSync(join(repoDir, '.env'), 'SECRET=123\n');
    const result = cape(['commit', '.env', '-m', 'feat: config'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain('sensitive');
    expect(result.stderr).toContain('.env');

    const log = execFileSync('git', ['-C', repoDir, 'log', '--oneline'], {
      encoding: 'utf-8',
    });
    expect(log).toContain('feat: config');
  });

  it('rejects invalid conventional commit message', () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const y = 2;\n');
    const result = cape(['commit', 'file.ts', '-m', 'bad message'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });

  it('rejects bulk staging with dot', () => {
    writeFileSync(join(repoDir, 'file.ts'), 'export const z = 3;\n');
    const result = cape(['commit', '.', '-m', 'feat: bulk'], { cwd: repoDir });
    expect(result.status).toBe(1);
  });
});
