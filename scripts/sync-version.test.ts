import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./sync-version.mjs', import.meta.url));
const tempDirs: string[] = [];

afterEach(() => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true })));

describe('sync-version', () => {
  it('updates only the cape plugin version without changing formatting', () => {
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
      '{\n  "name": "cape",\n  "plugins": [\n    { "name": "other", "version": "1.0.0" },\n    { "name": "cape", "version": "1.0.0" }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });
    const plugin = readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8');
    const marketplace = readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8');
    expect(plugin).toBe('{\n  "name": "cape",\n  "version": "2.3.4"\n}\n');
    expect(marketplace).toBe(
      '{\n  "name": "cape",\n  "plugins": [\n    { "name": "other", "version": "1.0.0" },\n    { "name": "cape", "version": "2.3.4" }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });
    expect(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')).toBe(plugin);
    expect(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8')).toBe(marketplace);
  });

  it('writes nothing when one manifest cannot be located', () => {
    const root = mkdtempSync(join(tmpdir(), 'cape-sync-version-'));
    tempDirs.push(root);
    mkdirSync(join(root, 'cli'));
    mkdirSync(join(root, '.claude-plugin'));
    writeFileSync(join(root, 'cli/package.json'), '{\n  "version": "2.3.4"\n}\n');
    const plugin = '{\n  "name": "cape",\n  "version": "1.0.0"\n}\n';
    // A nested object in the cape entry defeats the brace-matching regex, so the marketplace
    // transform throws after the plugin transform has already succeeded.
    const marketplace =
      '{\n  "name": "cape",\n  "plugins": [\n    { "name": "cape", "version": "1.0.0", "meta": { "a": 1 } }\n  ]\n}\n';
    writeFileSync(join(root, '.claude-plugin/plugin.json'), plugin);
    writeFileSync(join(root, '.claude-plugin/marketplace.json'), marketplace);

    expect(() => execFileSync(process.execPath, [script], { cwd: root, stdio: 'pipe' })).toThrow();

    expect(readFileSync(join(root, '.claude-plugin/plugin.json'), 'utf8')).toBe(plugin);
    expect(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8')).toBe(marketplace);
  });
});
