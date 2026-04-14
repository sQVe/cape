import { execFileSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { vi } from 'vitest';

import { main } from '../main';
import { BrValidateServiceLive } from '../services/brValidateLive';
import { CheckServiceLive } from '../services/checkLive';
import { CommitServiceLive } from '../services/commitLive';
import { ConformServiceLive } from '../services/conformLive';
import { DetectServiceLive } from '../services/detectLive';
import { GitServiceLive } from '../services/gitLive';
import { HookServiceLive } from '../services/hookLive';
import { PrServiceLive } from '../services/prLive';
import { ValidateServiceLive } from '../services/validateLive';

const GIT_ENV = {
  ...process.env, // eslint-disable-line node/no-process-env
  GIT_AUTHOR_NAME: 'test',
  GIT_AUTHOR_EMAIL: 'test@test.com',
  GIT_COMMITTER_NAME: 'test',
  GIT_COMMITTER_EMAIL: 'test@test.com',
  // Isolate from the user's git config so gpgsign, hooks, or aliases can't
  // make e2e tests flaky or depend on the dev's machine.
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_SYSTEM: '/dev/null',
};

export const initTestRepo = (prefix = 'cape-repo'): string => {
  const dir = execFileSync('mktemp', ['-d', join(tmpdir(), `${prefix}-XXXXXX`)], {
    encoding: 'utf-8',
    timeout: 5_000,
  }).trim();
  execFileSync('git', ['init', '-b', 'main', dir], { timeout: 5_000 });
  execFileSync(
    'git',
    ['-C', dir, '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-m', 'initial'],
    { env: GIT_ENV, timeout: 5_000 },
  );
  return dir;
};

export const gitInRepo = (repoDir: string, ...args: string[]) =>
  execFileSync('git', ['-C', repoDir, '-c', 'commit.gpgsign=false', ...args], {
    env: GIT_ENV,
    encoding: 'utf-8',
    timeout: 5_000,
  });

export const cleanupTestRepo = (dir: string) => {
  spawnSync('rm', ['-rf', dir]);
};

const BINARY = join(import.meta.dirname, '..', '..', 'dist', 'index.mjs');
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

const liveCommandLayers = Layer.mergeAll(
  NodeServices.layer,
  BrValidateServiceLive,
  CheckServiceLive,
  CommitServiceLive,
  ConformServiceLive,
  DetectServiceLive,
  GitServiceLive,
  HookServiceLive,
  PrServiceLive,
  ValidateServiceLive,
);

export const cape = (
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

export const capeCmd = (
  args: string[],
  options: { cwd?: string } = {},
): { stdout: string; stderr: string; status: number } => {
  const result = spawnSync('node', [BINARY, ...args], {
    encoding: 'utf-8',
    cwd: options.cwd ?? REPO_ROOT,
    env: GIT_ENV,
    timeout: 10_000,
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    status: result.status ?? 1,
  };
};

const runWith = Command.runWith(main, { version: '1.6.2' });

export const inProcess = async (
  args: string[],
  options: { cwd?: string } = {},
): Promise<{ stdout: string; stderr: string; status: number }> => {
  const origCwd = process.cwd();
  if (options.cwd) {
    process.chdir(options.cwd);
  }

  const stdoutLines: string[] = [];
  const stderrLines: string[] = [];
  const outSpy = vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    stdoutLines.push(a.join(' '));
  });
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    stderrLines.push(a.join(' '));
  });

  let status = 0;
  try {
    await Effect.runPromise(runWith(args).pipe(Effect.provide(liveCommandLayers)));
  } catch {
    status = 1;
  } finally {
    outSpy.mockRestore();
    errSpy.mockRestore();
    if (options.cwd) {
      process.chdir(origCwd);
    }
  }

  return {
    stdout: stdoutLines.join('\n').trim(),
    stderr: stderrLines.join('\n').trim(),
    status,
  };
};
