import { Effect, Layer } from 'effect';
import { Command } from 'effect/unstable/cli';
import { describe, expect, it } from 'vitest';

import { main } from '../main';
import {
  CommitService,
  detectSensitiveFiles,
  stageAndCommit,
  validateFiles,
  validateMessage,
} from '../services/commit';
import { makeTestCommandLayers, spyConsole } from '../testUtils';

const makeTestCommitLayer = () =>
  Layer.succeed(CommitService)({
    stageAndCommit: () => Effect.succeed(undefined),
    commitNoEdit: () => Effect.succeed(undefined),
  });

const makeErrorCommitLayer = (message: string) =>
  Layer.succeed(CommitService)({
    stageAndCommit: () => Effect.fail(new Error(message)),
    commitNoEdit: () => Effect.fail(new Error(message)),
  });

const run = Command.runWith(main, { version: '0.1.0' });

const commandLayers = makeTestCommandLayers(makeTestCommitLayer());

const withBody = (subject: string, body = 'Explain the change in detail.') =>
  `${subject}\n\n${body}`;

describe('validateMessage', () => {
  it('accepts feat with scope and body', () => {
    expect(validateMessage(withBody('feat(cli): add commit command'))).toBeNull();
  });

  it('accepts fix without scope and body', () => {
    expect(validateMessage(withBody('fix: resolve crash'))).toBeNull();
  });

  it('accepts all allowed types with body', () => {
    const types = [
      'feat',
      'fix',
      'refactor',
      'docs',
      'test',
      'chore',
      'ci',
      'perf',
      'build',
      'style',
      'revert',
    ];
    for (const type of types) {
      expect(validateMessage(withBody(`${type}: description`))).toBeNull();
    }
  });

  it('accepts message with body after blank line', () => {
    expect(validateMessage('fix(hook): remove gate\n\nDelete gateWritePlan().')).toBeNull();
  });

  it('rejects subject-only message', () => {
    expect(validateMessage('feat: add thing')).toContain('commit body is required');
  });

  it('rejects body shorter than 10 characters', () => {
    expect(validateMessage('feat: add thing\n\nshort')).toContain('at least 10 characters');
  });

  it('rejects message without type prefix', () => {
    expect(validateMessage('add new feature')).not.toBeNull();
  });

  it('rejects message with invalid type', () => {
    expect(validateMessage('feature: add thing')).toBe(
      'invalid conventional commit format: "feature: add thing"',
    );
  });

  it('rejects message without description after colon', () => {
    expect(validateMessage('feat:')).not.toBeNull();
  });

  it('rejects empty message', () => {
    expect(validateMessage('')).not.toBeNull();
  });

  it('rejects message with missing space after colon', () => {
    expect(validateMessage('feat:no space')).toBe(
      'invalid conventional commit format: "feat:no space"',
    );
  });
});

describe('validateFiles', () => {
  it('accepts one or more specific files', () => {
    expect(validateFiles(['src/foo.ts', 'src/bar.ts'])).toBeNull();
  });

  it('rejects dot as bulk staging', () => {
    expect(validateFiles(['.'])).not.toBeNull();
  });

  it('rejects dot among other files', () => {
    expect(validateFiles(['src/foo.ts', '.'])).not.toBeNull();
  });
});

describe('detectSensitiveFiles', () => {
  it('detects .env files', () => {
    expect(detectSensitiveFiles(['.env', '.env.local'])).toEqual(['.env', '.env.local']);
  });

  it('detects credentials files', () => {
    expect(detectSensitiveFiles(['credentials.json'])).toEqual(['credentials.json']);
  });

  it('detects secret files', () => {
    expect(detectSensitiveFiles(['secret.yaml'])).toEqual(['secret.yaml']);
  });

  it('detects pem and key files', () => {
    expect(detectSensitiveFiles(['server.pem', 'private.key'])).toEqual([
      'server.pem',
      'private.key',
    ]);
  });

  it('returns empty for safe files', () => {
    expect(detectSensitiveFiles(['src/foo.ts', 'README.md'])).toEqual([]);
  });

  it('filters mixed safe and sensitive files', () => {
    expect(detectSensitiveFiles(['src/foo.ts', '.env', 'README.md'])).toEqual(['.env']);
  });
});

describe('stageAndCommit', () => {
  it('propagates service errors', async () => {
    await expect(
      Effect.runPromise(
        stageAndCommit(['file.ts'], 'feat: thing').pipe(
          Effect.provide(makeErrorCommitLayer('git failed')),
        ),
      ),
    ).rejects.toThrow('git failed');
  });
});

describe('commit command wiring', () => {
  it('is wired as a subcommand of cape', async () => {
    await Effect.runPromise(run(['commit', '--help']).pipe(Effect.provide(commandLayers)));
  });

  it('commits with valid message and files', async () => {
    const console_ = spyConsole();
    const msg = 'feat: add thing\n\nAdd the thing to the project.';
    await Effect.runPromise(
      run(['commit', 'src/foo.ts', '-m', msg]).pipe(Effect.provide(commandLayers)),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({
      message: msg,
      files: ['src/foo.ts'],
    });
    console_.restore();
  });

  it('commits multiple files', async () => {
    const console_ = spyConsole();
    const msg = 'fix: two files\n\nFix both files at once.';
    await Effect.runPromise(
      run(['commit', 'a.ts', 'b.ts', '-m', msg]).pipe(Effect.provide(commandLayers)),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ message: msg, files: ['a.ts', 'b.ts'] });
    console_.restore();
  });

  it('joins multiple -m flags with blank line', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['commit', 'src/foo.ts', '-m', 'feat: add thing', '-m', 'Add the thing to the project.']).pipe(
        Effect.provide(commandLayers),
      ),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({
      message: 'feat: add thing\n\nAdd the thing to the project.',
      files: ['src/foo.ts'],
    });
    console_.restore();
  });

  it('rejects invalid commit message with exit error', async () => {
    await expect(
      Effect.runPromise(
        run(['commit', 'file.ts', '-m', 'bad message']).pipe(Effect.provide(commandLayers)),
      ),
    ).rejects.toThrow('invalid conventional commit format');
  });

  it('rejects subject-only commit message', async () => {
    await expect(
      Effect.runPromise(
        run(['commit', 'file.ts', '-m', 'feat: no body']).pipe(Effect.provide(commandLayers)),
      ),
    ).rejects.toThrow('commit body is required');
  });

  it('rejects bulk staging with dot', async () => {
    await expect(
      Effect.runPromise(
        run(['commit', '.', '-m', 'feat: bulk\n\nBulk staging attempt.']).pipe(
          Effect.provide(commandLayers),
        ),
      ),
    ).rejects.toThrow('bulk staging');
  });

  it('warns on sensitive files to stderr but still commits', async () => {
    const console_ = spyConsole();
    const msg = 'feat: add config\n\nAdd environment configuration.';
    await Effect.runPromise(
      run(['commit', '.env', '-m', msg]).pipe(Effect.provide(commandLayers)),
    );
    expect(console_.errorOutput()).toContain('warning: sensitive files');
    expect(console_.errorOutput()).toContain('.env');
    const result = JSON.parse(console_.output());
    expect(result.message).toBe(msg);
    console_.restore();
  });

  it('commits with --no-edit for merge commits', async () => {
    const console_ = spyConsole();
    await Effect.runPromise(
      run(['commit', '--no-edit']).pipe(Effect.provide(commandLayers)),
    );
    const result = JSON.parse(console_.output());
    expect(result).toEqual({ noEdit: true });
    console_.restore();
  });

  it('rejects when no files and no --no-edit', async () => {
    await expect(
      Effect.runPromise(
        run(['commit', '-m', 'feat: thing\n\nSome body text here.']).pipe(
          Effect.provide(commandLayers),
        ),
      ),
    ).rejects.toThrow('at least one file is required');
  });

  it('rejects when no message and no --no-edit', async () => {
    await expect(
      Effect.runPromise(
        run(['commit', 'file.ts']).pipe(Effect.provide(commandLayers)),
      ),
    ).rejects.toThrow('--message is required');
  });

  it('rejects when service fails', async () => {
    const msg = 'feat: thing\n\nAdd the thing to the project.';
    const layers = makeTestCommandLayers(makeErrorCommitLayer('commit failed'));
    await expect(
      Effect.runPromise(
        run(['commit', 'file.ts', '-m', msg]).pipe(Effect.provide(layers)),
      ),
    ).rejects.toThrow('commit failed');
  });
});
