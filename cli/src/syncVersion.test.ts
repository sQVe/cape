import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, '../../scripts/sync-version.mjs');
const tempDirs: string[] = [];

afterEach(() => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true })));

describe('sync-version', () => {
  it('updates cape manifest versions without changing their formatting', () => {
    const root = mkdtempSync(join(tmpdir(), 'cape-sync-version-'));
    tempDirs.push(root);
    mkdirSync(join(root, 'cli'));
    mkdirSync(join(root, '.claude-plugin'));
    writeFileSync(join(root, 'cli/package.json'), '{\n  "version": "2.3.4"\n}\n');
    writeFileSync(
      join(root, '.claude-plugin/plugin.json'),
      '{\n  "name": "cape",\n  "version": "1.0.0"\n}\n',
    );
    writeFileSync(
      join(root, '.claude-plugin/marketplace.json'),
      '{\n  "plugins": [\n    { "name": "other", "version": "1.0.0" },\n    { "name": "cape", "version": "1.0.0" }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });
    const plugin = readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8');
    const marketplace = readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8');
    expect(plugin).toBe('{\n  "name": "cape",\n  "version": "2.3.4"\n}\n');
    expect(marketplace).toBe(
      '{\n  "plugins": [\n    { "name": "other", "version": "1.0.0" },\n    { "name": "cape", "version": "2.3.4" }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });
    expect(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')).toBe(plugin);
    expect(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8')).toBe(marketplace);
  });
});
