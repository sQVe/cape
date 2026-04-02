import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

const BINARY = join(import.meta.dirname, '..', '..', 'dist', 'index.mjs');
const REPO_ROOT = join(import.meta.dirname, '..', '..', '..');

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
