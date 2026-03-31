import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { logEvent } from './eventLog';

describe('logEvent', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'cape-test-'));
    vi.stubEnv('CLAUDE_PLUGIN_ROOT', tempDir);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('appends a JSONL line with ts and cmd', () => {
    logEvent('commit');
    const content = readFileSync(join(tempDir, 'hooks/context/events.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0]);
    expect(entry.cmd).toBe('commit');
    expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('includes detail when provided', () => {
    logEvent('hook.pre-tool-use', 'deny: no tests');
    const content = readFileSync(join(tempDir, 'hooks/context/events.jsonl'), 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry.detail).toBe('deny: no tests');
  });

  it('omits detail key when not provided', () => {
    logEvent('commit');
    const content = readFileSync(join(tempDir, 'hooks/context/events.jsonl'), 'utf-8');
    const entry = JSON.parse(content.trim());
    expect(entry).not.toHaveProperty('detail');
  });

  it('appends multiple events', () => {
    logEvent('commit');
    logEvent('check');
    logEvent('conform');
    const content = readFileSync(join(tempDir, 'hooks/context/events.jsonl'), 'utf-8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]).cmd).toBe('commit');
    expect(JSON.parse(lines[1]).cmd).toBe('check');
    expect(JSON.parse(lines[2]).cmd).toBe('conform');
  });

  it('creates hooks/context directory if missing', () => {
    const contextDir = join(tempDir, 'hooks/context');
    expect(existsSync(contextDir)).toBe(false);
    logEvent('commit');
    expect(existsSync(contextDir)).toBe(true);
  });

  it('does not throw when path is unwritable', () => {
    vi.stubEnv('CLAUDE_PLUGIN_ROOT', '/nonexistent/readonly/path');
    expect(() =>{  logEvent('commit'); }).not.toThrow();
  });
});
