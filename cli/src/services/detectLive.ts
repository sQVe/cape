import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { Effect, Layer } from 'effect';
import { parse as parseToml } from 'smol-toml';

import type { DirectoryProbe } from './detect';
import { DetectService, buildSourceTestMap, detectEcosystems, isRecord } from './detect';

const createProbe = (directory: string): DirectoryProbe => ({
  fileExists: (name) => existsSync(join(directory, name)),
  directoryExists: (name) => {
    try {
      return statSync(join(directory, name)).isDirectory();
    } catch {
      return false;
    }
  },
  readConfig: (name) => {
    try {
      const content = readFileSync(join(directory, name), 'utf-8');
      const parsed: unknown = name.endsWith('.toml') ? parseToml(content) : JSON.parse(content);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },
});

const detect = () =>
  Effect.try({
    try: () => {
      const results = detectEcosystems(createProbe(process.cwd()));
      if (results.length === 0) {
        throw new Error('no ecosystem detected');
      }
      return results;
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('detection failed', { cause: error }),
  });

const skipDirs = new Set([
  'node_modules',
  '.git',
  '.venv',
  '__pycache__',
  'vendor',
  'dist',
  'build',
]);

const listFilesRecursive = (directory: string, base: string = directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(directory, entry.name);
    if (entry.isDirectory() && !skipDirs.has(entry.name)) {
      files.push(...listFilesRecursive(fullPath, base));
    } else if (entry.isFile()) {
      files.push(relative(base, fullPath));
    }
  }
  return files;
};

const mapDirectory = (directory: string) =>
  Effect.try({
    try: () => {
      const ecosystems = detectEcosystems(createProbe(directory));
      if (ecosystems.length === 0) {
        throw new Error('no ecosystem detected');
      }
      const files = listFilesRecursive(directory);
      return buildSourceTestMap(ecosystems, files);
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('mapping failed', { cause: error }),
  });

export const DetectServiceLive = Layer.succeed(DetectService)({
  detect,
  mapDirectory,
});
