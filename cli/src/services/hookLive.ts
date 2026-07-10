import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';

import { Effect, Layer } from 'effect';

import { pluginRoot } from '../pluginRoot';
import { tryReadFileUtf8, writeFileAtomic } from '../utils/fs';
import { HookService } from './hook';

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

const fileExists = (path: string) => Effect.succeed(existsSync(path));

export const HookServiceLive = Layer.succeed(HookService)({
  pluginRoot,
  readFile,
  writeFile,
  removeFile,
  ensureDir,
  readStdin,
  spawnGit,
  fileExists,
});
