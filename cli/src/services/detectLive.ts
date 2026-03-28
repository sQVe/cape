import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { Effect, Layer } from 'effect';
import { parse as parseToml } from 'smol-toml';

import type { DirectoryProbe } from './detect';
import { DetectService, detectEcosystems, isRecord } from './detect';

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

export const DetectServiceLive = Layer.succeed(DetectService)({ detect });
