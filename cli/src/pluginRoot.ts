import { dirname } from 'node:path';

export const pluginRoot = () =>
  // eslint-disable-next-line node/no-process-env
  process.env.CLAUDE_PLUGIN_ROOT ?? dirname(dirname(dirname(new URL(import.meta.url).pathname)));
