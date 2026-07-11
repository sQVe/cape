import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { pluginRoot } from '../pluginRoot';
import { tryReadFileUtf8, writeFileAtomic } from '../utils/fs';
import { HookService } from './hook';
import type { GitSpawnResult } from './hook';

const readFile = (path: string) =>
  Effect.try({
    try: () => tryReadFileUtf8(path),
    catch: () => new Error(`failed to read: ${path}`),
  }).pipe(Effect.orElseSucceed(() => null));

const writeFile = (path: string, content: string) =>
  Effect.try({
    try: () => {
      writeFileAtomic(path, content);
    },
    catch: () => new Error(`failed to write: ${path}`),
  }).pipe(Effect.orElseSucceed(() => undefined));

const removeFile = (path: string) =>
  Effect.try({
    try: () => {
      rmSync(path, { force: true });
    },
    catch: () => new Error(`failed to remove: ${path}`),
  }).pipe(Effect.orElseSucceed(() => undefined));

const ensureDir = (path: string) =>
  Effect.try({
    try: () => {
      mkdirSync(path, { recursive: true });
    },
    catch: () => new Error(`failed to mkdir: ${path}`),
  }).pipe(Effect.orElseSucceed(() => undefined));

const readStdin = () =>
  Effect.try({
    try: () => readFileSync(0, 'utf-8').trim(),
    catch: () => new Error('failed to read stdin'),
  }).pipe(Effect.orElseSucceed(() => ''));

const spawnGit = (args: readonly string[], cwd?: string) =>
  Effect.try({
    try: () => {
      const result = execFileSync('git', [...args], {
        encoding: 'utf-8',
        timeout: 3000,
        cwd,
      });
      return result.trim() || null;
    },
    catch: () => new Error('git command failed'),
  }).pipe(Effect.orElseSucceed(() => null));

// A nonzero exit means git ran and answered (e.g. not a repo); anything else
// (timeout, missing binary) means we don't know — callers must not treat the
// two alike, or a transient failure redirects state to the wrong file.
const spawnGitChecked = (args: readonly string[], cwd?: string) =>
  Effect.sync((): GitSpawnResult => {
    try {
      const stdout = execFileSync('git', [...args], {
        encoding: 'utf-8',
        timeout: 3000,
        cwd,
      });
      return { kind: 'ok', stdout: stdout.trim() };
    } catch (error) {
      const status = (error as { status?: unknown }).status;
      if (typeof status === 'number' && status !== 0) {
        return { kind: 'exit-nonzero' };
      }
      return { kind: 'unavailable' };
    }
  });

const fileExists = (path: string) => Effect.succeed(existsSync(path));

export const HookServiceLive = Layer.succeed(HookService)({
  pluginRoot,
  readFile,
  writeFile,
  removeFile,
  ensureDir,
  readStdin,
  spawnGit,
  spawnGitChecked,
  fileExists,
});
