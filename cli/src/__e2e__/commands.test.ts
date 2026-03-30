import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
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

  it('requires an id argument', () => {
    const result = cape(['br', 'close-check']);
    expect(result.status).not.toBe(0);
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

  it('requires an id argument', () => {
    const result = cape(['epic', 'verify']);
    expect(result.status).not.toBe(0);
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

  it('exits 1 with error for invalid scope', () => {
    const result = cape(['git', 'diff', 'bogus'], { cwd: repoDir });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('invalid scope');
  });

  it('outputs branch diff against main', () => {
    execFileSync('git', ['-C', repoDir, 'checkout', '-b', 'feat/test-branch']);
    writeFileSync(join(repoDir, 'new.ts'), 'export const y = 1;\n');
    execFileSync('git', ['-C', repoDir, 'add', 'new.ts']);
    execFileSync('git', ['-C', repoDir, 'commit', '-m', 'add new']);

    const result = cape(['git', 'diff', 'branch'], { cwd: repoDir });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('new.ts');
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

  it('exits 1 for unknown file type', () => {
    const valTmpDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-val-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    const unknownFile = join(valTmpDir, 'random.txt');
    writeFileSync(unknownFile, 'not a skill or agent\n');

    try {
      const result = cape(['validate', unknownFile]);
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

  it('succeeds with multiple files', () => {
    writeFileSync(join(repoDir, 'a.ts'), 'export const a = 1;\n');
    writeFileSync(join(repoDir, 'b.ts'), 'export const b = 2;\n');

    const result = cape(['commit', 'a.ts', 'b.ts', '-m', 'feat: add two files'], {
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
  it('cape --help lists check subcommand', () => {
    const result = cape(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('check');
  });

  it('exits 1 in a repo with no detected ecosystem', () => {
    const emptyDir = execFileSync('mktemp', ['-d', join(tmpdir(), 'cape-check-XXXXXX')], {
      encoding: 'utf-8',
    }).trim();
    execFileSync('git', ['init', emptyDir]);
    execFileSync('git', ['-C', emptyDir, 'commit', '--allow-empty', '-m', 'initial']);

    try {
      const result = cape(['check'], { cwd: emptyDir });
      expect(result.status).not.toBe(0);
    } finally {
      spawnSync('rm', ['-rf', emptyDir]);
    }
  });
});

describe('cape pr', () => {
  describe('template', () => {
    it('returns JSON with sections array', () => {
      const result = cape(['pr', 'template']);
      expect(result.status).toBe(0);
      const parsed = JSON.parse(result.stdout);
      expect(parsed).toHaveProperty('sections');
      expect(Array.isArray(parsed.sections)).toBe(true);
      expect(parsed.sections.length).toBeGreaterThan(0);
    });

    it('includes source field indicating repo or default', () => {
      const result = cape(['pr', 'template']);
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

    it('exits 1 when no file or --stdin provided', () => {
      const result = cape(['pr', 'validate']);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain('provide <file> or --stdin');
    });

    it('validates a PR body file with all sections present', () => {
      const template = cape(['pr', 'template']);
      const parsed = JSON.parse(template.stdout);
      const body = parsed.sections.map((s: string) => `#### ${s}\n\nContent here.\n`).join('\n');
      const bodyFile = join(tmpDir, 'pr-body.md');
      writeFileSync(bodyFile, body);

      const result = cape(['pr', 'validate', bodyFile]);
      expect(result.status).toBe(0);
      const validated = JSON.parse(result.stdout);
      expect(validated.valid).toBe(true);
      expect(validated.missing).toEqual([]);
    });

    it('reports missing sections for empty body', () => {
      const bodyFile = join(tmpDir, 'empty-pr.md');
      writeFileSync(bodyFile, 'No sections here.\n');

      const result = cape(['pr', 'validate', bodyFile]);
      expect(result.status).toBe(1);
      const validated = JSON.parse(result.stdout.split('\n')[0]!);
      expect(validated.valid).toBe(false);
      expect(validated.missing.length).toBeGreaterThan(0);
    });

    it('reports extra sections not in template', () => {
      const template = cape(['pr', 'template']);
      const parsed = JSON.parse(template.stdout);
      const body = [
        ...parsed.sections.map((s: string) => `#### ${s}\n\nContent.\n`),
        '#### Bonus section\n\nExtra.\n',
      ].join('\n');
      const bodyFile = join(tmpDir, 'extra-pr.md');
      writeFileSync(bodyFile, body);

      const result = cape(['pr', 'validate', bodyFile]);
      expect(result.status).toBe(0);
      const validated = JSON.parse(result.stdout);
      expect(validated.valid).toBe(true);
      expect(validated.extra).toContain('Bonus section');
    });
  });
});

describe('cape context', () => {
  it('rejects invalid context name with uppercase', () => {
    const result = cape(['context', 'set', 'InvalidName']);
    expect(result.stderr).toContain('Invalid context name');
  });

  it('rejects invalid context name with spaces', () => {
    const result = cape(['context', 'set', 'bad name']);
    expect(result.stderr).toContain('Invalid context name');
  });

  it('rejects invalid context name with underscores', () => {
    const result = cape(['context', 'set', 'bad_name']);
    expect(result.stderr).toContain('Invalid context name');
  });

  it('accepts valid lowercase-hyphen context name', () => {
    const contextFile = join(REPO_ROOT, 'cli', 'hooks', 'context', 'my-context-123.txt');
    const result = cape(['context', 'set', 'my-context-123']);
    try {
      expect(result.stderr).not.toContain('Invalid context name');
    } finally {
      try {
        unlinkSync(contextFile);
      } catch {
        /* cleanup */
      }
    }
  });

  it('clear rejects invalid context name', () => {
    const result = cape(['context', 'clear', 'BAD']);
    expect(result.stderr).toContain('Invalid context name');
  });
});

describe('cape br validate', () => {
  it('exits 1 when neither id nor --type provided', () => {
    const result = cape(['br', 'validate']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('provide either <id> or --type');
  });
});

describe('cape br design', () => {
  it('cape br --help lists design subcommand', () => {
    const result = cape(['br', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('design');
  });
});

describe('cape detect --map', () => {
  it('returns JSON mapping source files to test files', () => {
    const result = cape(['detect', '--map', '.']);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(typeof parsed).toBe('object');
    expect(Object.keys(parsed).length).toBeGreaterThan(0);
  });

  it('values are either a test path or null', () => {
    const result = cape(['detect', '--map', '.']);
    const parsed = JSON.parse(result.stdout);
    for (const value of Object.values(parsed)) {
      expect(value === null || typeof value === 'string').toBe(true);
    }
  });
});
