import { NodeServices } from '@effect/platform-node';
import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import { HookService } from '../services/hook';
import {
  stubBrLayer,
  stubCheckLayer,
  stubCommitLayer,
  stubDetectLayer,
  stubGitLayer,
  stubPrLayer,
  stubConformLayer,
  stubTestLayer,
  stubValidateLayer,
} from '../testStubs';

const run = Command.runWith(main, { version: '0.1.0' });

const makeTestLayers = (
  overrides: { writtenFiles?: Record<string, string>; removedFiles?: string[] } = {},
) => {
  const { writtenFiles = {}, removedFiles = [] } = overrides;
  const hookLayer = Layer.succeed(HookService)({
    pluginRoot: () => '/test',
    readFile: () => Effect.succeed(null),
    writeFile: (path, content) => {
      writtenFiles[path] = content;
      return Effect.succeed(undefined);
    },
    removeFile: (path) => {
      removedFiles.push(path);
      return Effect.succeed(undefined);
    },
    ensureDir: () => Effect.succeed(undefined),
    brQuery: () => Effect.succeed(null),
    readStdin: () => Effect.succeed(''),
    spawnGit: () => Effect.succeed(null),
    fileExists: () => Effect.succeed(false),
  });

  return Layer.mergeAll(
    NodeServices.layer,
    stubGitLayer,
    stubDetectLayer,
    stubCheckLayer,
    stubCommitLayer,
    stubBrLayer,
    stubPrLayer,
    stubTestLayer,
    stubValidateLayer,
    stubConformLayer,
    hookLayer,
  );
};

describe('context set', () => {
  it('writes context file to hooks/context/<name>.txt', async () => {
    const writtenFiles: Record<string, string> = {};
    await Effect.runPromise(
      run(['context', 'set', 'brainstorm']).pipe(
        Effect.provide(makeTestLayers({ writtenFiles })),
      ),
    );
    expect(writtenFiles['/test/hooks/context/brainstorm.txt']).toBe('true');
  });
});

describe('context clear', () => {
  it('removes context file at hooks/context/<name>.txt', async () => {
    const removedFiles: string[] = [];
    await Effect.runPromise(
      run(['context', 'clear', 'brainstorm']).pipe(
        Effect.provide(makeTestLayers({ removedFiles })),
      ),
    );
    expect(removedFiles).toContain('/test/hooks/context/brainstorm.txt');
  });
});
