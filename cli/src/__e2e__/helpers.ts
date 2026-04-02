import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

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
import { TestServiceLive } from '../services/testLive';
import { ValidateServiceLive } from '../services/validateLive';

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
  TestServiceLive,
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
    timeout: 10_000,
  });
  return {
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
    status: result.status ?? 1,
  };
};

const runWith = Command.runWith(main, { version: '0.1.0' });

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
