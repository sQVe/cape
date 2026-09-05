import { readFileSync, writeFileSync } from 'node:fs';

// Claude Code loads the plugin manifests directly and cannot import a version at load time, so the
// release bump propagates by rewriting them from cli/package.json.
const { version } = JSON.parse(readFileSync('cli/package.json', 'utf8'));
if (typeof version !== 'string') throw new Error('Version not found in cli/package.json');

// Both manifests are staged before either is written: a throw partway through would otherwise
// leave one bumped and one stale, which is the drift this script exists to prevent.
const staged = [];
for (const path of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const target = Array.isArray(manifest.plugins)
    ? manifest.plugins.find((plugin) => plugin.name === 'cape')
    : manifest;
  if (target?.name !== 'cape') throw new Error(`Cape plugin not found in ${path}`);

  target.version = version;
  staged.push([path, `${JSON.stringify(manifest, null, 2)}\n`]);
}

for (const [path, content] of staged) writeFileSync(path, content);
