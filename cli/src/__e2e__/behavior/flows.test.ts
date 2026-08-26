import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { gitCommonDir } from '../../utils/git';
import { cacheFileNameFor } from '../../utils/trackerCachePath';
import { cape, capeCmd, cleanupTestRepo, gitInRepo, initTestRepo } from '../helpers';

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

describe('flow 3: session-start', () => {
  it('produces additionalContext output', () => {
    const result = cape(['hook', 'session-start'], '', env);
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.additionalContext).toEqual(expect.any(String));
    expect(parsed.additionalContext.length).toBeGreaterThan(0);
  });

  it('renders the ABU-15 banner from a seeded tracker cache with network disabled', () => {
    // The banner derives the epic from the current branch, so the simulated
    // plugin root doubles as a repo whose branch matches the cached slug.
    execFileSync('git', ['init', '-b', 'feat/abu-15-cape-v2', tmpDir]);
    // The cache file is named per repository, and the CLI resolves it from its
    // own cwd (tmpDir), not this test process's.
    writeFileSync(
      join(contextDir, cacheFileNameFor(gitCommonDir(tmpDir))),
      JSON.stringify({
        version: 1,
        timestamp: Date.now(),
        epics: {
          'ABU-15': {
            id: 'ABU-15',
            title: 'Cape V2',
            status: 'In Progress',
            gitBranchName: 'abu-15-cape-v2',
            tasks: [
              {
                id: 'ABU-16',
                title: 'Tracker seam',
                status: 'Done',
                stateType: 'completed',
              },
              {
                id: 'ABU-17',
                title: 'Session banner',
                status: 'Todo',
                stateType: 'unstarted',
              },
            ],
          },
        },
      }),
    );

    const result = cape(['hook', 'session-start'], '', {
      ...env,
      HTTP_PROXY: 'http://127.0.0.1:9',
      HTTPS_PROXY: 'http://127.0.0.1:9',
      LINEAR_API_KEY: '',
    });

    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout);
    expect(parsed.additionalContext).toContain('| Epic   ABU-15  Cape V2');
    expect(parsed.additionalContext).toContain('| Phase  build  (1/2 tasks done)');
    expect(parsed.additionalContext).toContain('| Next   ABU-17 - Session banner');
    expect(parsed.additionalContext).toContain('| Branch feat/abu-15-cape-v2');
  });
});

describe('flow 4: full commit pipeline', () => {
  let repoDir: string;

  beforeEach(() => {
    repoDir = initTestRepo('cape-commit');
    writeFileSync(join(repoDir, 'file.ts'), 'export const x = 1;\n');
  });

  afterEach(() => {
    cleanupTestRepo(repoDir);
  });

  it('commits with valid conventional message', () => {
    const msg = 'feat: add thing\n\nAdd the thing to the project.';
    const result = capeCmd(['commit', 'file.ts', '-m', msg], { cwd: repoDir });
    expect(result.status).toBe(0);

    const log = gitInRepo(repoDir, 'log', '--oneline');
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

  it('rejects sensitive files unless --allow-sensitive is passed', () => {
    writeFileSync(join(repoDir, '.env'), 'SECRET=abc\n');

    const msg = 'feat: config\n\nAdd environment configuration.';
    const rejected = capeCmd(['commit', '.env', '-m', msg], { cwd: repoDir });
    expect(rejected.status).toBe(1);
    expect(rejected.stderr).toContain('sensitive files');
    expect(rejected.stderr).toContain('.env');

    const result = capeCmd(['commit', '.env', '--allow-sensitive', '-m', msg], { cwd: repoDir });
    expect(result.status).toBe(0);

    const log = gitInRepo(repoDir, 'log', '--oneline');
    expect(log).toContain('feat: config');
  });

  it('fails with non-zero exit when file does not exist', () => {
    const result = capeCmd(['commit', 'nonexistent.ts', '-m', 'feat: ghost'], { cwd: repoDir });

    expect(result.status).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });
});

describe('flow 5: tracker cache isolation across repositories', () => {
  let repoA: string;
  let repoB: string;

  beforeEach(() => {
    repoA = initTestRepo('cape-cache-a');
    repoB = initTestRepo('cape-cache-b');
  });

  afterEach(() => {
    cleanupTestRepo(repoA);
    cleanupTestRepo(repoB);
  });

  // Two Linear workspaces can both have a team named `AI`, so the same
  // identifier means different work in different repos. One shared cache let
  // whichever repo wrote last win.
  it('keeps same-id entries from two repositories from overwriting each other', () => {
    const epic = (title: string, taskTitle: string) =>
      JSON.stringify({
        identifier: 'AI-5',
        title,
        state: { name: 'Todo', type: 'unstarted' },
        children: {
          nodes: [
            { identifier: 'AI-6', title: taskTitle, state: { name: 'Todo', type: 'unstarted' } },
          ],
        },
      });

    const wroteA = cape(['tracker', 'cache-epic', epic('Repo A epic', 'Repo A task')], '', env, {
      cwd: repoA,
    });
    const wroteB = cape(['tracker', 'cache-epic', epic('Repo B epic', 'Repo B task')], '', env, {
      cwd: repoB,
    });

    expect(wroteA.status).toBe(0);
    expect(wroteB.status).toBe(0);

    const cacheA = JSON.parse(
      readFileSync(join(contextDir, cacheFileNameFor(gitCommonDir(repoA))), 'utf-8'),
    );
    const cacheB = JSON.parse(
      readFileSync(join(contextDir, cacheFileNameFor(gitCommonDir(repoB))), 'utf-8'),
    );

    expect(cacheA.epics['AI-5'].title).toBe('Repo A epic');
    expect(cacheB.epics['AI-5'].title).toBe('Repo B epic');
  });

  // A repository git refuses to read must not look like an empty cache, since
  // every skill now orients off `tracker show`.
  it('exits nonzero instead of reporting an empty cache when git cannot answer', () => {
    writeFileSync(join(repoA, '.git', 'config'), '[core\nbroken\n');

    const shown = cape(['tracker', 'show'], '', env, { cwd: repoA });
    expect(shown.status).not.toBe(0);
    expect(shown.stdout).not.toContain('"epics"');

    const located = cape(['tracker', 'path'], '', env, { cwd: repoA });
    expect(located.status).not.toBe(0);
  });

  // cache-status is the command that caused the reported corruption, and it
  // takes a read-modify-write path that cache-epic does not.
  it('keeps a cache-status write in one repository out of the other', () => {
    const epic = (taskTitle: string) =>
      JSON.stringify({
        identifier: 'AI-5',
        title: 'Shared id',
        state: { name: 'Todo', type: 'unstarted' },
        children: {
          nodes: [
            { identifier: 'AI-6', title: taskTitle, state: { name: 'Todo', type: 'unstarted' } },
          ],
        },
      });

    cape(['tracker', 'cache-epic', epic('Repo A task')], '', env, { cwd: repoA });
    cape(['tracker', 'cache-epic', epic('Repo B task')], '', env, { cwd: repoB });

    const marked = cape(['tracker', 'cache-status', 'AI-6', 'Done', 'completed'], '', env, {
      cwd: repoA,
    });
    expect(marked.status).toBe(0);

    const readCache = (repo: string) =>
      JSON.parse(readFileSync(join(contextDir, cacheFileNameFor(gitCommonDir(repo))), 'utf-8'));

    expect(readCache(repoA).epics['AI-5'].tasks[0].status).toBe('Done');
    expect(readCache(repoB).epics['AI-5'].tasks[0].status).toBe('Todo');
  });
});
