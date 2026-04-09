import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { readFileUtf8, tryReadFileUtf8 } from './fs';

describe('readFileUtf8', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cape-fs-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the file contents as a utf-8 string', () => {
    const path = join(tempDir, 'hello.txt');
    writeFileSync(path, 'héllo, wörld');
    expect(readFileUtf8(path)).toBe('héllo, wörld');
  });

  it('throws when the file does not exist', () => {
    const missing = join(tempDir, 'nope.txt');
    expect(() => readFileUtf8(missing)).toThrow();
  });
});

describe('tryReadFileUtf8', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cape-fs-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the file contents on success', () => {
    const path = join(tempDir, 'hello.txt');
    writeFileSync(path, 'hello');
    expect(tryReadFileUtf8(path)).toBe('hello');
  });

  it('returns null when the file does not exist', () => {
    expect(tryReadFileUtf8(join(tempDir, 'missing.txt'))).toBeNull();
  });
});
