import { readFileSync, writeFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('cli/package.json', 'utf8')).version;
const versionPattern = /("name"\s*:\s*"cape"[\s\S]*?"version"\s*:\s*")[^"]+/;

for (const path of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json']) {
  const current = readFileSync(path, 'utf8');
  if (!versionPattern.test(current)) throw new Error(`Cape version not found in ${path}`);
  const updated = current.replace(versionPattern, `$1${version}`);
  if (updated !== current) writeFileSync(path, updated);
}
