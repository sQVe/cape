import { readFileSync, writeFileSync } from 'node:fs';

const version = JSON.parse(readFileSync('cli/package.json', 'utf8')).version;
if (typeof version !== 'string') throw new Error('Version not found in cli/package.json');

const only = (items, message) => {
  if (items.length !== 1) throw new Error(message);
  return items[0];
};

const replaceVersion = (json, path) => {
  only([...json.matchAll(/"version"\s*:\s*"[^"]*"/g)], `Could not locate one version in ${path}`);
  return json.replace(/("version"\s*:\s*")[^"]*"/, (_, prefix) => `${prefix}${version}"`);
};

const update = (path, transform) => {
  const current = readFileSync(path, 'utf8');
  const updated = transform(current);
  if (updated !== current) writeFileSync(path, updated);
};

const pluginPath = '.claude-plugin/plugin.json';
update(pluginPath, (json) => {
  if (JSON.parse(json).name !== 'cape') throw new Error(`Cape plugin not found in ${pluginPath}`);
  return replaceVersion(json, pluginPath);
});

const marketplacePath = '.claude-plugin/marketplace.json';
update(marketplacePath, (json) => {
  const marketplace = JSON.parse(json);
  const capePlugin = only(
    Array.isArray(marketplace.plugins)
      ? marketplace.plugins.filter(({ name }) => name === 'cape')
      : [],
    `Could not locate one cape plugin in ${marketplacePath}`,
  );
  const capeEntry = only(
    (json.match(/\{[^{}]*"name"\s*:\s*"cape"[^{}]*\}/g) ?? []).filter(
      (entry) => JSON.stringify(JSON.parse(entry)) === JSON.stringify(capePlugin),
    ),
    `Could not locate one cape plugin in ${marketplacePath}`,
  );
  return json.replace(capeEntry, replaceVersion(capeEntry, marketplacePath));
});
