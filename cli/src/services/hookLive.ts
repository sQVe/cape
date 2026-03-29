import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { Effect, Layer } from 'effect';

import { HookService } from './hook';

const pluginRoot = () =>
  // eslint-disable-next-line node/no-process-env
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(new URL(import.meta.url).pathname));

const readFile = (path: string) =>
  Effect.try({
    try: () => (existsSync(path) ? readFileSync(path, 'utf-8') : null),
    catch: () => new Error(`failed to read: ${path}`),
  }).pipe(Effect.orElseSucceed(() => null));

const writeFile = (path: string, content: string) =>
  Effect.try({
    try: () => {
      writeFileSync(path, content);
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

const brQuery = (args: readonly string[]) =>
  Effect.try({
    try: () => {
      const result = execFileSync('br', [...args], {
        encoding: 'utf-8',
        timeout: 3000,
      });
      return result.trim();
    },
    catch: () => new Error('br query failed'),
  }).pipe(Effect.orElseSucceed(() => null));

const readStdin = () =>
  Effect.try({
    try: () => readFileSync(0, 'utf-8').trim(),
    catch: () => new Error('failed to read stdin'),
  }).pipe(Effect.orElseSucceed(() => ''));

const spawnGit = (args: readonly string[]) =>
  Effect.try({
    try: () => {
      const result = execFileSync('git', [...args], {
        encoding: 'utf-8',
        timeout: 3000,
      });
      return result.trim() || null;
    },
    catch: () => new Error('git command failed'),
  }).pipe(Effect.orElseSucceed(() => null));

export const HookServiceLive = Layer.succeed(HookService)({
  pluginRoot,
  readFile,
  writeFile,
  removeFile,
  ensureDir,
  brQuery,
  readStdin,
  spawnGit,
});
