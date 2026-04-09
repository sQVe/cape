import { globSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { Effect, Layer } from 'effect';

import { tryReadFileUtf8 } from '../utils/fs';
import { gitRoot } from '../utils/git';
import { ConformService, parseRuleFile } from './conform';

const discoverRules = () =>
  Effect.try({
    try: () => {
      const rules = [];
      const home = homedir();
      const root = gitRoot();

      const sources = [
        join(home, '.claude', 'CLAUDE.md'),
        ...globSync(join(home, '.claude', 'rules', '*.md')),
        join(root, 'CLAUDE.md'),
        ...globSync(join(root, '.claude', 'rules', '*.md')),
      ];

      for (const source of sources) {
        const raw = tryReadFileUtf8(source);
        if (raw == null) continue;

        rules.push(parseRuleFile(source, raw));
      }

      return rules;
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('rule discovery failed', { cause: error }),
  });

const readFiles = (paths: string[]) =>
  Effect.try({
    try: () => {
      const root = gitRoot();

      return paths
        .map((path) => {
          const content = tryReadFileUtf8(join(root, path));
          return content != null ? { path, content } : null;
        })
        .filter((f) => f != null);
    },
    catch: (error) =>
      error instanceof Error ? error : new Error('file read failed', { cause: error }),
  });

export const ConformServiceLive = Layer.succeed(ConformService)({ discoverRules, readFiles });
