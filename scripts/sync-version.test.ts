import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./sync-version.mjs', import.meta.url));
const tempDirs = [];

const manifests = (marketplace) => {
  const root = mkdtempSync(join(tmpdir(), 'cape-sync-version-'));
  tempDirs.push(root);
  mkdirSync(join(root, 'cli'));
  mkdirSync(join(root, '.claude-plugin'));
  writeFileSync(join(root, 'cli/package.json'), '{\n  "version": "2.3.4"\n}\n');
  writeFileSync(
    join(root, '.claude-plugin/plugin.json'),
    '{\n  "name": "cape",\n  "version": "1.0.0"\n}\n',
  );
  writeFileSync(join(root, '.claude-plugin/marketplace.json'), marketplace);
  return root;
};

const read = (root, name) => readFileSync(join(root, '.claude-plugin', name), 'utf8');

afterEach(() => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true })));

describe('sync-version', () => {
  it('bumps only the cape plugin entry', () => {
    // The outer marketplace object is also named cape, and a foreign plugin is listed first:
    // both are fields a looser match would rewrite instead.
    const root = manifests(
      '{\n  "name": "cape",\n  "version": "0.0.1",\n  "plugins": [\n    {\n      "name": "other",\n      "version": "1.0.0"\n    },\n    {\n      "name": "cape",\n      "version": "1.0.0"\n    }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });

    expect(read(root, 'plugin.json')).toBe('{\n  "name": "cape",\n  "version": "2.3.4"\n}\n');
    const marketplace = JSON.parse(read(root, 'marketplace.json'));
    expect(marketplace.version).toBe('0.0.1');
    expect(marketplace.plugins).toEqual([
      { name: 'other', version: '1.0.0' },
      { name: 'cape', version: '2.3.4' },
    ]);
  });

  it('bumps an entry holding nested fields', () => {
    const root = manifests(
      '{\n  "name": "cape",\n  "plugins": [\n    {\n      "name": "cape",\n      "version": "1.0.0",\n      "author": {\n        "name": "sqve"\n      }\n    }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });

    expect(JSON.parse(read(root, 'marketplace.json')).plugins[0]).toEqual({
      name: 'cape',
      version: '2.3.4',
      author: { name: 'sqve' },
    });
  });

  it('leaves values holding replacement patterns intact', () => {
    const root = manifests(
      '{\n  "name": "cape",\n  "plugins": [\n    {\n      "name": "cape",\n      "description": "Save $& more",\n      "version": "1.0.0"\n    }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });

    expect(JSON.parse(read(root, 'marketplace.json')).plugins[0].description).toBe('Save $& more');
  });

  it('writes nothing when one manifest has no cape entry', () => {
    const marketplace = '{\n  "name": "cape",\n  "plugins": [\n    {\n      "name": "other"\n    }\n  ]\n}\n';
    const root = manifests(marketplace);
    const plugin = read(root, 'plugin.json');

    expect(() => execFileSync(process.execPath, [script], { cwd: root, stdio: 'pipe' })).toThrow();

    expect(read(root, 'plugin.json')).toBe(plugin);
    expect(read(root, 'marketplace.json')).toBe(marketplace);
  });

  it('is idempotent', () => {
    const root = manifests(
      '{\n  "name": "cape",\n  "plugins": [\n    {\n      "name": "cape",\n      "version": "1.0.0"\n    }\n  ]\n}\n',
    );

    execFileSync(process.execPath, [script], { cwd: root });
    const first = read(root, 'marketplace.json');
    execFileSync(process.execPath, [script], { cwd: root });

    expect(read(root, 'marketplace.json')).toBe(first);
  });
});
